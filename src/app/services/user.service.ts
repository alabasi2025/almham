import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface UserRow {
  id: string;
  username: string;
  role: 'admin' | 'accountant' | 'station_manager' | 'technician' | 'cashier';
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  employeeId: string | null;
  employeeName: string | null;
  employeeRole: string | null;
  stationId: string | null;
  stationName: string | null;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(HttpClient);
  private api = '/api/users';

  users = signal<UserRow[]>([]);
  loading = signal(false);

  async loadAll(): Promise<void> {
    this.loading.set(true);
    try {
      const rows = await firstValueFrom(this.http.get<UserRow[]>(this.api));
      this.users.set(rows);
    } finally {
      this.loading.set(false);
    }
  }

  async toggleActive(id: string): Promise<void> {
    await firstValueFrom(this.http.post(`${this.api}/${id}/toggle-active`, {}));
    await this.loadAll();
  }

  async resetPassword(id: string, newPassword: string): Promise<void> {
    await firstValueFrom(this.http.post(`${this.api}/${id}/reset-password`, { newPassword }));
  }

  async changeRole(
    id: string,
    role: UserRow['role'],
    stationId: string | null,
  ): Promise<void> {
    await firstValueFrom(this.http.post(`${this.api}/${id}/change-role`, { role, stationId }));
    await this.loadAll();
  }
}
