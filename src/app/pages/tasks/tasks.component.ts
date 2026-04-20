import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { TaskService } from '../../services/task.service';
import { StationService } from '../../services/station.service';
import { EmployeeService } from '../../services/employee.service';
import { Task } from '../../models/task.model';

type TaskStatus = 'pending' | 'in-progress' | 'completed' | 'cancelled';
type TaskPriority = 'high' | 'medium' | 'low';
type StatusFilter = TaskStatus | 'all';
type PriorityFilter = TaskPriority | 'all';
type ViewMode = 'kanban' | 'cards' | 'table';

@Component({
  selector: 'app-tasks',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './tasks.component.html',
  styleUrls: ['./tasks.component.scss'],
})
export class TasksComponent {
  taskService = inject(TaskService);
  stationService = inject(StationService);
  employeeService = inject(EmployeeService);

  // ---------- Kanban columns config ----------
  readonly kanbanColumns: { status: TaskStatus; label: string; icon: string }[] = [
    { status: 'pending', label: 'معلّقة', icon: 'pending_actions' },
    { status: 'in-progress', label: 'قيد التنفيذ', icon: 'autorenew' },
    { status: 'completed', label: 'مكتملة', icon: 'check_circle' },
    { status: 'cancelled', label: 'ملغاة', icon: 'cancel' },
  ];

  // ---------- state ----------
  showForm = signal(false);
  editingId = signal<string | null>(null);
  searchQuery = signal('');
  statusFilter = signal<StatusFilter>('all');
  priorityFilter = signal<PriorityFilter>('all');
  viewMode = signal<ViewMode>('kanban');

  form: Partial<Task> = this.emptyForm();

  // ---------- computed ----------
  filteredTasks = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const status = this.statusFilter();
    const prio = this.priorityFilter();

    return this.taskService.tasks().filter((t) => {
      if (status !== 'all' && t.status !== status) return false;
      if (prio !== 'all' && t.priority !== prio) return false;
      if (!q) return true;
      const empName = this.getEmployeeName(t.employeeId).toLowerCase();
      const stName = this.getStationName(t.stationId).toLowerCase();
      return (
        t.title?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        empName.includes(q) ||
        stName.includes(q)
      );
    });
  });

  completionRate = computed(() => {
    const total = this.taskService.tasks().length;
    if (!total) return 0;
    const done = this.taskService.tasks().filter((t) => t.status === 'completed').length;
    return Math.round((done / total) * 100);
  });

  overdueCount = computed(() =>
    this.taskService.tasks().filter((t) => this.isOverdue(t)).length,
  );

  // ---------- helpers ----------
  private emptyForm(): Partial<Task> {
    return {
      title: '', description: '', type: 'maintenance', priority: 'medium',
      status: 'pending', stationId: '', employeeId: '', dueDate: '',
    };
  }

  countByStatus(status: TaskStatus): number {
    return this.taskService.tasks().filter((t) => t.status === status).length;
  }

  countByPriority(p: TaskPriority): number {
    return this.taskService.tasks().filter((t) => t.priority === p).length;
  }

  kanbanTasks(status: TaskStatus): Task[] {
    // Uses the same search + priority filter as filteredTasks but overrides status
    const q = this.searchQuery().trim().toLowerCase();
    const prio = this.priorityFilter();
    return this.taskService.tasks().filter((t) => {
      if (t.status !== status) return false;
      if (prio !== 'all' && t.priority !== prio) return false;
      if (!q) return true;
      const empName = this.getEmployeeName(t.employeeId).toLowerCase();
      const stName = this.getStationName(t.stationId).toLowerCase();
      return (
        t.title?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        empName.includes(q) ||
        stName.includes(q)
      );
    });
  }

  isOverdue(t: Task): boolean {
    if (!t.dueDate) return false;
    if (t.status === 'completed' || t.status === 'cancelled') return false;
    const due = new Date(t.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due < today;
  }

  nextLabel(status: TaskStatus): string {
    if (status === 'pending') return 'ابدأ';
    if (status === 'in-progress') return 'اكتمل';
    return '';
  }

  advance(t: Task): void {
    let next: TaskStatus | null = null;
    if (t.status === 'pending') next = 'in-progress';
    else if (t.status === 'in-progress') next = 'completed';
    if (next) this.taskService.update(t.id, { status: next });
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

  edit(task: Task): void {
    this.form = { ...task };
    this.editingId.set(task.id);
    this.showForm.set(true);
  }

  save(): void {
    if (!this.form.title) return;
    const id = this.editingId();
    if (id) {
      this.taskService.update(id, this.form);
    } else {
      this.taskService.add(this.form as Omit<Task, 'id' | 'createdAt'>);
    }
    this.cancelForm();
  }

  delete(id: string): void {
    const t = this.taskService.tasks().find((x) => x.id === id);
    if (!t) return;
    if (confirm(`هل أنت متأكد من حذف المهمة "${t.title}"؟`)) {
      this.taskService.delete(id);
    }
  }

  refresh(): void {
    this.taskService.loadAll();
    this.stationService.loadAll();
    this.employeeService.loadAll();
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.statusFilter.set('all');
    this.priorityFilter.set('all');
  }

  // ---------- label helpers ----------
  getStationName(id: string): string {
    const s = this.stationService.getById(id);
    if (!s) return 'غير محدد';
    return s.name
      .replace(/^محطة\s+/, '')
      .replace(/\s+لتوليد\s+و?توزيع\s+الكهرباء\s*$/, '')
      .replace(/\s+لتوليد\s+الكهرباء\s*$/, '')
      .replace(/\s+لتوزيع\s+الكهرباء\s*$/, '');
  }

  getEmployeeName(id: string): string {
    return this.employeeService.employees().find((e) => e.id === id)?.name ?? 'غير محدد';
  }

  getTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      maintenance: 'build',
      inspection: 'fact_check',
      repair: 'handyman',
      installation: 'construction',
    };
    return icons[type] ?? 'task';
  }

  getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      maintenance: 'صيانة', inspection: 'فحص', repair: 'إصلاح', installation: 'تركيب',
    };
    return labels[type] ?? type;
  }

  getPriorityLabel(priority: string): string {
    const labels: Record<string, string> = {
      high: 'عالية', medium: 'متوسطة', low: 'منخفضة',
    };
    return labels[priority] ?? priority;
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'pending': 'معلّقة', 'in-progress': 'قيد التنفيذ',
      'completed': 'مكتملة', 'cancelled': 'ملغاة',
    };
    return labels[status] ?? status;
  }
}
