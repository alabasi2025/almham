import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Task } from '../models/task.model';

@Injectable({ providedIn: 'root' })
export class TaskService {
  private http = inject(HttpClient);
  private apiUrl = '/api/tasks';

  tasks = signal<Task[]>([]);

  pendingCount = computed(() => this.tasks().filter((t) => t.status === 'pending').length);
  inProgressCount = computed(() => this.tasks().filter((t) => t.status === 'in-progress').length);
  completedCount = computed(() => this.tasks().filter((t) => t.status === 'completed').length);
  highPriorityCount = computed(() => this.tasks().filter((t) => t.priority === 'high' && t.status !== 'completed').length);

  constructor() {
    this.loadAll();
  }

  loadAll(): void {
    this.http.get<Task[]>(this.apiUrl).subscribe({
      next: (data) => this.tasks.set(data),
      error: (err) => console.error('خطأ في جلب المهام:', err),
    });
  }

  add(task: Omit<Task, 'id' | 'createdAt'>): void {
    this.http.post<Task>(this.apiUrl, task).subscribe({
      next: (created) => {
        this.tasks.update((list) => [...list, created]);
      },
      error: (err) => console.error('خطأ في إضافة المهمة:', err),
    });
  }

  update(id: string, data: Partial<Task>): void {
    this.http.put<Task>(`${this.apiUrl}/${id}`, data).subscribe({
      next: (updated) => {
        this.tasks.update((list) =>
          list.map((t) => (t.id === id ? updated : t))
        );
      },
      error: (err) => console.error('خطأ في تعديل المهمة:', err),
    });
  }

  delete(id: string): void {
    this.http.delete(`${this.apiUrl}/${id}`).subscribe({
      next: () => {
        this.tasks.update((list) => list.filter((t) => t.id !== id));
      },
      error: (err) => console.error('خطأ في حذف المهمة:', err),
    });
  }

  getByStation(stationId: string): Task[] {
    return this.tasks().filter((t) => t.stationId === stationId);
  }

  getByEmployee(employeeId: string): Task[] {
    return this.tasks().filter((t) => t.employeeId === employeeId);
  }
}
