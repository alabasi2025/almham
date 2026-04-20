import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface AuthUser {
  id: string;
  username: string;
  role: 'admin' | 'accountant' | 'station_manager' | 'technician' | 'cashier';
  employeeId: string | null;
  stationId: string | null;
  mustChangePassword: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private api = '/api/auth';

  private _user = signal<AuthUser | null>(null);
  private _loading = signal(true);

  user = computed(() => this._user());
  isAuthenticated = computed(() => this._user() !== null);
  isLoading = computed(() => this._loading());

  isAdmin = computed(() => this._user()?.role === 'admin');
  canManageUsers = computed(() => {
    const role = this._user()?.role;
    return role === 'admin' || role === 'accountant';
  });

  async loadCurrentUser(): Promise<void> {
    this._loading.set(true);
    try {
      const res = await firstValueFrom(
        this.http.get<{ user: AuthUser }>(`${this.api}/me`, { withCredentials: true }),
      );
      this._user.set(res.user);
    } catch {
      this._user.set(null);
    } finally {
      this._loading.set(false);
    }
  }

  async login(username: string, password: string): Promise<AuthUser> {
    const res = await firstValueFrom(
      this.http.post<{ user: AuthUser }>(
        `${this.api}/login`,
        { username, password },
        { withCredentials: true },
      ),
    );
    this._user.set(res.user);
    return res.user;
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${this.api}/logout`, {}, { withCredentials: true }),
      );
    } finally {
      this._user.set(null);
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await firstValueFrom(
      this.http.post(
        `${this.api}/change-password`,
        { currentPassword, newPassword },
        { withCredentials: true },
      ),
    );
    const u = this._user();
    if (u) this._user.set({ ...u, mustChangePassword: false });
  }

  roleLabel(role?: string | null): string {
    const labels: Record<string, string> = {
      admin: 'مدير عام',
      accountant: 'محاسب',
      station_manager: 'مدير محطة',
      technician: 'فنّي',
      cashier: 'صرّاف',
    };
    return role ? labels[role] ?? role : '';
  }
}
