import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

import { StationService } from '../../services/station.service';
import { EmployeeService } from '../../services/employee.service';
import { FuelService } from '../../services/fuel.service';
import { Station } from '../../models/station.model';
import { Employee } from '../../models/employee.model';

type StatusFilter = 'all' | 'active' | 'maintenance' | 'inactive';
type ViewMode = 'cards' | 'table';

@Component({
  selector: 'app-stations',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './stations.component.html',
  styleUrls: ['./stations.component.scss'],
})
export class StationsComponent {
  stationService = inject(StationService);
  employeeService = inject(EmployeeService);
  fuelService = inject(FuelService);
  private router = inject(Router);

  // ---------- state ----------
  showForm = signal(false);
  editingId = signal<string | null>(null);
  searchQuery = signal('');
  statusFilter = signal<StatusFilter>('all');
  viewMode = signal<ViewMode>('cards');

  form: Partial<Station> = this.emptyForm();

  // ---------- computed KPIs ----------
  totalCapacityMW = computed(() => {
    const total = this.stationService.stations().reduce((sum, s) => sum + (s.capacity || 0), 0);
    return (total / 1000).toFixed(1);
  });

  activeCapacityMW = computed(() => {
    const total = this.stationService.stations()
      .filter((s) => s.status === 'active')
      .reduce((sum, s) => sum + (s.capacity || 0), 0);
    return (total / 1000).toFixed(1);
  });

  activePercent = computed(() => {
    const total = this.stationService.stations().length;
    if (!total) return 0;
    return Math.round((this.stationService.activeCount() / total) * 100);
  });

  maxCapacity = computed(() => {
    const caps = this.stationService.stations().map((s) => s.capacity || 0);
    return caps.length ? Math.max(...caps, 1) : 1;
  });

  filteredStations = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const status = this.statusFilter();

    return this.stationService.stations().filter((s) => {
      if (status !== 'all' && s.status !== status) return false;
      if (!q) return true;
      return (
        s.name?.toLowerCase().includes(q) ||
        s.location?.toLowerCase().includes(q) ||
        s.type?.toLowerCase().includes(q)
      );
    });
  });

  constructor() {
    // Load fuel-related data for counts
    this.fuelService.loadGenerators().catch(() => {});
    this.fuelService.loadTanks().catch(() => {});
  }

  // ---------- helpers ----------
  private emptyForm(): Partial<Station> {
    return {
      name: '',
      location: '',
      capacity: 0,
      type: 'توليد',
      status: 'active',
      latitude: null,
      longitude: null,
    };
  }

  shortName(name: string): string {
    if (!name) return '';
    return name
      .replace(/^محطة\s+/, '')
      .replace(/\s+لتوليد\s+و?توزيع\s+الكهرباء\s*$/, '')
      .replace(/\s+لتوليد\s+الكهرباء\s*$/, '')
      .replace(/\s+لتوزيع\s+الكهرباء\s*$/, '');
  }

  getTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      'توليد': 'bolt',
      'توزيع': 'hub',
      'نقل': 'swap_horiz',
      'تحويل': 'transform',
    };
    return icons[type] ?? 'electrical_services';
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      active: 'نشطة',
      maintenance: 'صيانة',
      inactive: 'متوقفة',
    };
    return labels[status] ?? status;
  }

  capacityPercent(s: Station): number {
    const max = this.maxCapacity();
    if (!max) return 0;
    return Math.min(100, Math.round(((s.capacity || 0) / max) * 100));
  }

  generatorsCount(stationId: string): number {
    return this.fuelService.generators().filter((g) => g.stationId === stationId).length;
  }

  tanksCount(stationId: string): number {
    return this.fuelService.tanks().filter((t) => t.stationId === stationId).length;
  }

  employeesCount(stationId: string): number {
    return this.employeeService.employees().filter((e) => e.stationId === stationId).length;
  }

  stationManager(stationId: string): Employee | undefined {
    return this.employeeService.employees().find(
      (e) => e.stationId === stationId && (e.role?.includes('مدير') ?? false),
    );
  }

  // ---------- CRUD ----------
  openForm(): void {
    this.form = this.emptyForm();
    this.editingId.set(null);
    this.showForm.set(true);
  }

  cancelForm(): void {
    this.showForm.set(false);
    this.editingId.set(null);
  }

  edit(station: Station): void {
    this.form = { ...station };
    this.editingId.set(station.id);
    this.showForm.set(true);
  }

  save(): void {
    if (!this.form.name || !this.form.location) return;

    // Normalize coordinates
    const payload: Partial<Station> = {
      ...this.form,
      capacity: Number(this.form.capacity) || 0,
      latitude: this.form.latitude != null && this.form.latitude !== '' ? this.form.latitude : null,
      longitude: this.form.longitude != null && this.form.longitude !== '' ? this.form.longitude : null,
    };

    const id = this.editingId();
    if (id) {
      this.stationService.update(id, payload);
    } else {
      this.stationService.add(payload as Omit<Station, 'id' | 'createdAt'>);
    }
    this.cancelForm();
  }

  delete(id: string): void {
    const s = this.stationService.stations().find((x) => x.id === id);
    if (!s) return;
    if (confirm(`هل أنت متأكد من حذف محطة "${this.shortName(s.name)}"؟\nسيتم حذف البيانات المرتبطة نهائياً.`)) {
      this.stationService.delete(id);
    }
  }

  refresh(): void {
    this.stationService.loadAll();
    this.employeeService.loadAll();
    this.fuelService.loadGenerators().catch(() => {});
    this.fuelService.loadTanks().catch(() => {});
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.statusFilter.set('all');
  }

  // ---------- navigation ----------
  goFuel(stationId: string): void {
    this.router.navigate(['/fuel'], { queryParams: { station: stationId } });
  }

  goGenerators(stationId: string): void {
    this.router.navigate(['/stations/generators'], { queryParams: { station: stationId } });
  }

  goEmployees(stationId: string): void {
    this.router.navigate(['/employees'], { queryParams: { station: stationId } });
  }

  goMap(s: Station): void {
    this.router.navigate(['/maps'], {
      queryParams: {
        focus: s.id,
        lat: s.latitude,
        lng: s.longitude,
      },
    });
  }

  goMapPicker(): void {
    this.cancelForm();
    this.router.navigate(['/maps']);
  }
}
