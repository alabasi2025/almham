import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Employee } from '../models/employee.model';

@Injectable({ providedIn: 'root' })
export class EmployeeService {
  private http = inject(HttpClient);
  private apiUrl = '/api/employees';

  employees = signal<Employee[]>([]);

  activeCount = computed(() => this.employees().filter((e) => e.status === 'active').length);

  constructor() {
    this.loadAll();
  }

  loadAll(): void {
    this.http.get<Employee[]>(this.apiUrl).subscribe({
      next: (data) => this.employees.set(data),
      error: (err) => console.error('خطأ في جلب الموظفين:', err),
    });
  }

  add(employee: Omit<Employee, 'id' | 'createdAt'>): void {
    this.http.post<Employee>(this.apiUrl, employee).subscribe({
      next: (created) => {
        this.employees.update((list) => [...list, created]);
      },
      error: (err) => console.error('خطأ في إضافة الموظف:', err),
    });
  }

  update(id: string, data: Partial<Employee>): void {
    this.http.put<Employee>(`${this.apiUrl}/${id}`, data).subscribe({
      next: (updated) => {
        this.employees.update((list) =>
          list.map((e) => (e.id === id ? updated : e))
        );
      },
      error: (err) => console.error('خطأ في تعديل الموظف:', err),
    });
  }

  delete(id: string): void {
    this.http.delete(`${this.apiUrl}/${id}`).subscribe({
      next: () => {
        this.employees.update((list) => list.filter((e) => e.id !== id));
      },
      error: (err) => console.error('خطأ في حذف الموظف:', err),
    });
  }

  getByStation(stationId: string): Employee[] {
    return this.employees().filter((e) => e.stationId === stationId);
  }
}
