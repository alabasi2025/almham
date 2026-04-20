import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { EmployeeService } from '../../services/employee.service';
import { StationService } from '../../services/station.service';
import { Employee } from '../../models/employee.model';

type StationFilter = 'all' | 'hq' | string;
type ViewMode = 'cards' | 'table';

@Component({
  selector: 'app-employees',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './employees.component.html',
  styleUrls: ['./employees.component.scss'],
})
export class EmployeesComponent {
  employeeService = inject(EmployeeService);
  stationService = inject(StationService);

  // ---------- state ----------
  showForm = signal(false);
  editingId = signal<string | null>(null);
  searchQuery = signal('');
  stationFilter = signal<StationFilter>('all');
  viewMode = signal<ViewMode>('cards');

  form: Partial<Employee> = this.emptyForm();

  // ---------- computed ----------
  inactiveCount = computed(() =>
    this.employeeService.employees().filter((e) => e.status === 'inactive').length,
  );

  activePercent = computed(() => {
    const total = this.employeeService.employees().length;
    if (!total) return 0;
    return Math.round((this.employeeService.activeCount() / total) * 100);
  });

  hqCount = computed(() =>
    this.employeeService.employees().filter((e) => !e.stationId).length,
  );

  managersCount = computed(() =>
    this.employeeService.employees().filter((e) =>
      e.role && /مدير|مشرف/.test(e.role),
    ).length,
  );

  techsCount = computed(() =>
    this.employeeService.employees().filter((e) =>
      e.role && /مهندس|فني/.test(e.role),
    ).length,
  );

  filteredEmployees = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const filter = this.stationFilter();

    return this.employeeService.employees().filter((e) => {
      // Station filter
      if (filter === 'hq' && e.stationId) return false;
      if (filter !== 'all' && filter !== 'hq' && e.stationId !== filter) return false;

      // Search
      if (!q) return true;
      return (
        e.name?.toLowerCase().includes(q) ||
        e.role?.toLowerCase().includes(q) ||
        e.phone?.toLowerCase().includes(q) ||
        e.email?.toLowerCase().includes(q)
      );
    });
  });

  // ---------- helpers ----------
  private emptyForm(): Partial<Employee> {
    return { name: '', role: 'فني كهرباء', phone: '', email: '', stationId: null, status: 'active' };
  }

  countByStation(stationId: string): number {
    return this.employeeService.employees().filter((e) => e.stationId === stationId).length;
  }

  shortName(name: string): string {
    if (!name) return '';
    return name
      .replace(/^محطة\s+/, '')
      .replace(/\s+لتوليد\s+و?توزيع\s+الكهرباء\s*$/, '')
      .replace(/\s+لتوليد\s+الكهرباء\s*$/, '')
      .replace(/\s+لتوزيع\s+الكهرباء\s*$/, '');
  }

  initials(name: string): string {
    if (!name) return '؟';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0][0];
    return parts[0][0] + parts[1][0];
  }

  avatarColor(name: string): string {
    const palette = [
      'linear-gradient(135deg, #0891b2, #0e7490)',
      'linear-gradient(135deg, #10b981, #059669)',
      'linear-gradient(135deg, #8b5cf6, #7c3aed)',
      'linear-gradient(135deg, #ec4899, #db2777)',
      'linear-gradient(135deg, #f59e0b, #d97706)',
      'linear-gradient(135deg, #3b82f6, #2563eb)',
      'linear-gradient(135deg, #14b8a6, #0d9488)',
      'linear-gradient(135deg, #ef4444, #dc2626)',
    ];
    let hash = 0;
    for (const ch of name) hash = (hash << 5) - hash + ch.charCodeAt(0);
    return palette[Math.abs(hash) % palette.length];
  }

  getStationName(id: string | null | undefined): string {
    if (!id) return 'الإدارة العامة';
    const s = this.stationService.getById(id);
    return s ? this.shortName(s.name) : 'الإدارة العامة';
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

  edit(emp: Employee): void {
    this.form = { ...emp };
    this.editingId.set(emp.id);
    this.showForm.set(true);
  }

  save(): void {
    if (!this.form.name || !this.form.phone) return;
    const payload: Partial<Employee> = {
      ...this.form,
      stationId: this.form.stationId ?? null,
    };

    const id = this.editingId();
    if (id) {
      this.employeeService.update(id, payload);
    } else {
      this.employeeService.add(payload as Omit<Employee, 'id' | 'createdAt'>);
    }
    this.cancelForm();
  }

  delete(id: string): void {
    const emp = this.employeeService.employees().find((e) => e.id === id);
    if (!emp) return;
    if (confirm(`هل أنت متأكد من حذف الموظف "${emp.name}"؟`)) {
      this.employeeService.delete(id);
    }
  }

  refresh(): void {
    this.employeeService.loadAll();
    this.stationService.loadAll();
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.stationFilter.set('all');
  }
}
