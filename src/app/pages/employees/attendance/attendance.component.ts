import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Employee } from '../../../models/employee.model';
import { Station } from '../../../models/station.model';
import { AttendanceEventRow, AttendanceOpenSession } from '../../../models/attendance.model';
import { AttendanceService } from '../../../services/attendance.service';
import { EmployeeService } from '../../../services/employee.service';
import { StationService } from '../../../services/station.service';

type LocationStatus = 'idle' | 'checking' | 'inside' | 'outside' | 'missing-station' | 'unsupported' | 'denied' | 'error';

interface StationAttendanceRow {
  station: Station;
  shortName: string;
  employeesCount: number;
  hasCoordinates: boolean;
  openSessionsCount: number;
  radiusMeters: number;
  trackingIntervalMinutes: number;
}

@Component({
  selector: 'app-attendance',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './attendance.component.html',
  styleUrls: ['./attendance.component.scss'],
})
export class AttendanceComponent {
  employeeService = inject(EmployeeService);
  stationService = inject(StationService);
  attendance = inject(AttendanceService);

  selectedEmployeeId = signal('');
  selectedStationId = signal('');
  radiusMeters = signal(100);
  locationStatus = signal<LocationStatus>('idle');
  locationMessage = signal('لم يتم فحص الموقع بعد');
  checkedDistance = signal<number | null>(null);
  currentLatitude = signal<number | null>(null);
  currentLongitude = signal<number | null>(null);
  currentAccuracy = signal<number | null>(null);

  constructor() {
    this.attendance.loadDashboard();
  }

  activeEmployees = computed(() =>
    this.employeeService.employees().filter((employee) => employee.status === 'active'),
  );

  stationRows = computed<StationAttendanceRow[]>(() =>
    this.stationService.stations().map((station) => ({
      station,
      shortName: this.shortStationName(station.name),
      employeesCount: this.countEmployeesByStation(station.id),
      hasCoordinates: this.hasStationCoordinates(station),
      openSessionsCount: this.countOpenSessionsByStation(station.id),
      radiusMeters: this.attendanceSettingByStation().get(station.id)?.radiusMeters ?? 100,
      trackingIntervalMinutes: Math.round((this.attendanceSettingByStation().get(station.id)?.trackingIntervalSeconds ?? 300) / 60),
    })),
  );

  geofencedStationsCount = computed(() =>
    this.stationRows().filter((row) => row.hasCoordinates).length,
  );

  hqEmployeesCount = computed(() =>
    this.activeEmployees().filter((employee) => !employee.stationId).length,
  );

  openSessions = computed(() => this.attendance.dashboard()?.openSessions ?? []);

  recentEvents = computed(() => this.attendance.dashboard()?.recentEvents ?? []);

  attendanceSettingByStation = computed(() =>
    new Map((this.attendance.dashboard()?.settings ?? []).map((setting) => [setting.stationId, setting])),
  );

  selectedEmployee = computed(() =>
    this.activeEmployees().find((employee) => employee.id === this.selectedEmployeeId()) ?? null,
  );

  selectedStation = computed(() =>
    this.stationService.stations().find((station) => station.id === this.selectedStationId()) ?? null,
  );

  canCheckLocation = computed(() =>
    Boolean(this.selectedEmployeeId() && this.selectedStationId() && this.locationStatus() !== 'checking'),
  );

  checkLocation(): void {
    const station = this.selectedStation();
    if (!station || !this.hasStationCoordinates(station)) {
      this.setLocationResult('missing-station', 'المحطة لا تحتوي على إحداثيات GPS', null);
      return;
    }

    if (!navigator.geolocation) {
      this.setLocationResult('unsupported', 'المتصفح لا يدعم تحديد الموقع', null);
      return;
    }

    this.locationStatus.set('checking');
    this.locationMessage.set('جاري فحص موقع الجهاز...');
    this.checkedDistance.set(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const stationLat = this.toNumber(station.latitude);
        const stationLng = this.toNumber(station.longitude);
        if (stationLat === null || stationLng === null) {
          this.setLocationResult('missing-station', 'إحداثيات المحطة غير مكتملة', null);
          return;
        }

        const distance = this.distanceMeters(
          position.coords.latitude,
          position.coords.longitude,
          stationLat,
          stationLng,
        );

        this.currentLatitude.set(position.coords.latitude);
        this.currentLongitude.set(position.coords.longitude);
        this.currentAccuracy.set(Math.round(position.coords.accuracy));

        if (distance <= this.radiusMeters()) {
          this.setLocationResult('inside', `داخل نطاق ${this.radiusMeters()} متر`, distance);
        } else {
          this.setLocationResult('outside', `خارج نطاق ${this.radiusMeters()} متر`, distance);
        }
      },
      (error) => {
        const denied = error.code === error.PERMISSION_DENIED;
        this.setLocationResult(
          denied ? 'denied' : 'error',
          denied ? 'تم رفض إذن الموقع' : 'تعذر قراءة موقع الجهاز',
          null,
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  }

  statusLabel(): string {
    const labels: Record<LocationStatus, string> = {
      idle: 'لم يفحص',
      checking: 'جاري الفحص',
      inside: 'داخل النطاق',
      outside: 'خارج النطاق',
      'missing-station': 'إحداثيات ناقصة',
      unsupported: 'غير مدعوم',
      denied: 'مرفوض',
      error: 'خطأ',
    };
    return labels[this.locationStatus()];
  }

  refreshDashboard(): void {
    this.attendance.loadDashboard();
  }

  eventTypeLabel(type: AttendanceEventRow['type']): string {
    return type === 'check_in' ? 'حضور' : 'انصراف';
  }

  eventSourceLabel(source: AttendanceEventRow['source']): string {
    const labels: Record<AttendanceEventRow['source'], string> = {
      mobile: 'الجوال',
      zkteco: 'البصمة',
      manager: 'المدير',
    };
    return labels[source];
  }

  eventStatusLabel(status: AttendanceEventRow['status']): string {
    return status === 'accepted' ? 'مقبول' : 'مرفوض';
  }

  sessionDuration(session: AttendanceOpenSession): string {
    const started = new Date(session.startedAt).getTime();
    const minutes = Math.max(0, Math.floor((Date.now() - started) / 60000));
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (hours === 0) return `${rest} دقيقة`;
    return `${hours} ساعة و${rest} دقيقة`;
  }

  formatDateTime(value: string): string {
    return new Intl.DateTimeFormat('ar-YE', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  employeeStationLabel(employee: Employee): string {
    if (!employee.stationId) return 'الإدارة العامة';
    const station = this.stationService.getById(employee.stationId);
    return station ? this.shortStationName(station.name) : 'محطة غير معروفة';
  }

  shortStationName(name: string): string {
    return name
      .replace(/^محطة\s+/, '')
      .replace(/\s+لتوليد\s+و?توزيع\s+الكهرباء\s*$/, '')
      .replace(/\s+لتوليد\s+الكهرباء\s*$/, '')
      .replace(/\s+لتوزيع\s+الكهرباء\s*$/, '');
  }

  private setLocationResult(status: LocationStatus, message: string, distance: number | null): void {
    this.locationStatus.set(status);
    this.locationMessage.set(message);
    this.checkedDistance.set(distance === null ? null : Math.round(distance));
  }

  private countEmployeesByStation(stationId: string): number {
    return this.activeEmployees().filter((employee) => employee.stationId === stationId).length;
  }

  private countOpenSessionsByStation(stationId: string): number {
    return this.openSessions().filter((session) => session.stationId === stationId).length;
  }

  private hasStationCoordinates(station: Station): boolean {
    return this.toNumber(station.latitude) !== null && this.toNumber(station.longitude) !== null;
  }

  private toNumber(value: string | number | null | undefined): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const earthRadiusMeters = 6371000;
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private toRadians(value: number): number {
    return (value * Math.PI) / 180;
  }
}
