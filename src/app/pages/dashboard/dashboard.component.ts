import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { StationService } from '../../services/station.service';
import { EmployeeService } from '../../services/employee.service';
import { TaskService } from '../../services/task.service';
import { FuelService } from '../../services/fuel.service';
import { Task } from '../../models/task.model';
import { shortenStationName } from '../../utils/station-name';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MatIconModule, RouterLink, BaseChartDirective],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent {
  stationService = inject(StationService);
  employeeService = inject(EmployeeService);
  taskService = inject(TaskService);
  fuelService = inject(FuelService);

  private _now = signal(new Date());

  constructor() {
    // Refresh time every minute for greeting/date
    setInterval(() => this._now.set(new Date()), 60_000);
    this.fuelService.loadGenerators().catch(() => {});
    this.fuelService.loadTanks().catch(() => {});
    this.fuelService.loadSuppliers().catch(() => {});
  }

  // ---------- Greeting / date ----------
  greeting = computed(() => {
    const h = this._now().getHours();
    if (h < 12) return 'صباح الخير،';
    if (h < 17) return 'مساء الخير،';
    return 'مساءكم مبارك،';
  });

  today = computed(() => {
    const d = this._now();
    try {
      return new Intl.DateTimeFormat('ar-YE', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(d);
    } catch {
      return d.toLocaleDateString();
    }
  });

  // ---------- KPIs ----------
  completionRate = computed(() => {
    const total = this.taskService.tasks().length;
    if (total === 0) return 0;
    return Math.round((this.taskService.completedCount() / total) * 100);
  });

  totalCapacityMW = computed(() => {
    const total = this.stationService.stations().reduce((sum, s) => sum + (s.capacity || 0), 0);
    return (total / 1000).toFixed(1);
  });

  recentTasks = computed<Task[]>(() => {
    return [...this.taskService.tasks()]
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
      .slice(0, 6);
  });

  // ---------- helpers ----------
  percent(part: number, total: number): number {
    if (!total) return 0;
    return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
  }

  generatorsOf(stationId: string): number {
    return this.fuelService.generators().filter((g) => g.stationId === stationId).length;
  }

  employeesOf(stationId: string): number {
    return this.employeeService.employees().filter((e) => e.stationId === stationId).length;
  }

  shortName(name: string): string {
    return shortenStationName(name, '');
  }

  // ---------- Charts ----------
  doughnutOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    cutout: '72%',
    plugins: { legend: { display: false } },
  };

  get taskChartData(): ChartConfiguration<'doughnut'>['data'] {
    return {
      labels: ['معلّقة', 'قيد التنفيذ', 'مكتملة'],
      datasets: [{
        data: [
          this.taskService.pendingCount(),
          this.taskService.inProgressCount(),
          this.taskService.completedCount(),
        ],
        backgroundColor: ['#64748b', '#2563eb', '#10b981'],
        borderWidth: 0,
        spacing: 3,
        borderRadius: 4,
      }],
    };
  }

  get stationChartData(): ChartConfiguration<'doughnut'>['data'] {
    return {
      labels: ['نشطة', 'صيانة', 'متوقفة'],
      datasets: [{
        data: [
          this.stationService.activeCount(),
          this.stationService.maintenanceCount(),
          this.stationService.inactiveCount(),
        ],
        backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
        borderWidth: 0,
        spacing: 3,
        borderRadius: 4,
      }],
    };
  }

  // ---------- label helpers ----------
  getStationName(id: string): string {
    const s = this.stationService.getById(id);
    return s ? this.shortName(s.name) : 'غير محدد';
  }

  getEmployeeName(id: string): string {
    return this.employeeService.employees().find((e) => e.id === id)?.name ?? 'غير محدد';
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      active: 'نشطة', maintenance: 'صيانة', inactive: 'متوقفة',
    };
    return labels[status] ?? status;
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'pending': 'معلّقة', 'in-progress': 'قيد التنفيذ',
      'completed': 'مكتملة', 'cancelled': 'ملغاة',
    };
    return labels[status] ?? status;
  }

  priorityLabel(p: string): string {
    const labels: Record<string, string> = {
      high: 'عالية', medium: 'متوسطة', low: 'منخفضة',
    };
    return labels[p] ?? p;
  }

  getTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      maintenance: 'build',
      inspection: 'fact_check',
      repair: 'handyman',
      installation: 'construction',
    };
    return icons[type] ?? 'assignment';
  }
}
