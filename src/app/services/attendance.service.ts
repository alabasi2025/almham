import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { AttendanceDashboard } from '../models/attendance.model';

@Injectable({ providedIn: 'root' })
export class AttendanceService {
  private http = inject(HttpClient);
  private apiUrl = '/api/attendance';

  dashboard = signal<AttendanceDashboard | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);

  openSessionsCount = computed(() => this.dashboard()?.summary.openSessions ?? 0);
  todayAcceptedEventsCount = computed(() => this.dashboard()?.summary.todayAcceptedEvents ?? 0);
  todayRejectedEventsCount = computed(() => this.dashboard()?.summary.todayRejectedEvents ?? 0);

  loadDashboard(): void {
    this.loading.set(true);
    this.error.set(null);

    this.http.get<AttendanceDashboard>(`${this.apiUrl}/dashboard`).subscribe({
      next: (dashboard) => {
        this.dashboard.set(dashboard);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('خطأ في جلب لوحة الحضور:', err);
        this.error.set(err?.error?.error ?? 'تعذر تحميل بيانات الحضور');
        this.loading.set(false);
      },
    });
  }
}
