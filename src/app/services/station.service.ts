import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Station } from '../models/station.model';

@Injectable({ providedIn: 'root' })
export class StationService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3000/api/stations';

  stations = signal<Station[]>([]);

  activeCount = computed(() => this.stations().filter((s) => s.status === 'active').length);
  maintenanceCount = computed(() => this.stations().filter((s) => s.status === 'maintenance').length);
  inactiveCount = computed(() => this.stations().filter((s) => s.status === 'inactive').length);

  constructor() {
    this.loadAll();
  }

  loadAll(): void {
    console.log('🔄 جاري جلب المحطات من:', this.apiUrl);
    this.http.get<Station[]>(this.apiUrl).subscribe({
      next: (data) => {
        console.log('✅ تم استلام المحطات:', data);
        this.stations.set(data);
      },
      error: (err) => {
        console.error('❌ خطأ في جلب المحطات:', err);
      },
    });
  }

  add(station: Omit<Station, 'id' | 'createdAt'>): void {
    this.http.post<Station>(this.apiUrl, station).subscribe({
      next: (created) => {
        this.stations.update((list) => [...list, created]);
      },
      error: (err) => console.error('خطأ في إضافة المحطة:', err),
    });
  }

  update(id: string, data: Partial<Station>): void {
    this.http.put<Station>(`${this.apiUrl}/${id}`, data).subscribe({
      next: (updated) => {
        this.stations.update((list) =>
          list.map((s) => (s.id === id ? updated : s))
        );
      },
      error: (err) => console.error('خطأ في تعديل المحطة:', err),
    });
  }

  delete(id: string): void {
    this.http.delete(`${this.apiUrl}/${id}`).subscribe({
      next: () => {
        this.stations.update((list) => list.filter((s) => s.id !== id));
      },
      error: (err) => console.error('خطأ في حذف المحطة:', err),
    });
  }

  getById(id: string): Station | undefined {
    return this.stations().find((s) => s.id === id);
  }
}
