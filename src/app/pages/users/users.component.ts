import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import { UserService, UserRow } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { StationService } from '../../services/station.service';
import { shortenStationName } from '../../utils/station-name';

type RoleFilter = 'all' | 'admin' | 'accountant' | 'station_manager' | 'technician' | 'cashier' | 'pending_pw';
type ViewMode = 'cards' | 'table';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.scss'],
})
export class UsersComponent implements OnInit {
  users = inject(UserService);
  auth = inject(AuthService);
  stationService = inject(StationService);

  // ---------- state ----------
  searchQuery = signal('');
  roleFilter = signal<RoleFilter>('all');
  viewMode = signal<ViewMode>('cards');

  // Reset password modal
  resetUser = signal<UserRow | null>(null);
  newPassword = signal('');
  resetBusy = signal(false);
  resetError = signal<string | null>(null);
  resetSuccess = signal(false);

  async ngOnInit() {
    await this.users.loadAll();
    if (this.stationService.stations().length === 0) {
      this.stationService.loadAll();
    }
  }

  // ---------- KPIs ----------
  totalCount = computed(() => this.users.users().length);
  activeCount = computed(() => this.users.users().filter((u) => u.isActive).length);
  inactiveCount = computed(() => this.users.users().filter((u) => !u.isActive).length);
  pendingPasswordCount = computed(() =>
    this.users.users().filter((u) => u.mustChangePassword && u.isActive).length,
  );

  adminCount = computed(() => this.users.users().filter((u) => u.role === 'admin').length);
  managerCount = computed(() => this.users.users().filter((u) => u.role === 'station_manager').length);
  techCount = computed(() => this.users.users().filter((u) => u.role === 'technician').length);

  countByRole(role: UserRow['role']): number {
    return this.users.users().filter((u) => u.role === role).length;
  }

  // ---------- filtering ----------
  filtered = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const rf = this.roleFilter();

    return this.users.users().filter((u) => {
      if (rf === 'pending_pw') {
        if (!u.mustChangePassword || !u.isActive) return false;
      } else if (rf !== 'all' && u.role !== rf) {
        return false;
      }

      if (!q) return true;
      return (
        u.username.toLowerCase().includes(q) ||
        (u.employeeName ?? '').toLowerCase().includes(q) ||
        (u.stationName ?? '').toLowerCase().includes(q) ||
        (u.employeeRole ?? '').toLowerCase().includes(q)
      );
    });
  });

  // ---------- helpers ----------
  roleLabel(role: string): string {
    return this.auth.roleLabel(role);
  }

  initials(name: string | null | undefined): string {
    if (!name) return '؟';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0][0];
    return parts[0][0] + parts[1][0];
  }

  avatarColor(role: string): string {
    const map: Record<string, string> = {
      admin: 'linear-gradient(135deg, #f59e0b, #d97706)',
      accountant: 'linear-gradient(135deg, #3b82f6, #2563eb)',
      station_manager: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
      technician: 'linear-gradient(135deg, #10b981, #059669)',
      cashier: 'linear-gradient(135deg, #ec4899, #db2777)',
    };
    return map[role] ?? 'linear-gradient(135deg, #64748b, #475569)';
  }

  shortStation(name: string | null): string {
    return shortenStationName(name);
  }

  formatDate(iso: string | null): string {
    if (!iso) return 'لم يسجّل دخول';
    try {
      return new Intl.DateTimeFormat('ar-YE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(iso));
    } catch {
      return new Date(iso).toLocaleString();
    }
  }

  // ---------- actions ----------
  async toggle(u: UserRow) {
    const action = u.isActive ? 'تعطيل' : 'تفعيل';
    if (!confirm(`هل تريد ${action} حساب "${u.username}"؟`)) return;
    try {
      await this.users.toggleActive(u.id);
    } catch (err: unknown) {
      alert(this.extractError(err) || `تعذّر ${action} الحساب`);
    }
  }

  openReset(u: UserRow) {
    this.resetUser.set(u);
    this.newPassword.set('');
    this.resetError.set(null);
    this.resetSuccess.set(false);
  }

  closeReset() {
    this.resetUser.set(null);
    this.newPassword.set('');
    this.resetError.set(null);
    this.resetSuccess.set(false);
  }

  async confirmReset() {
    const u = this.resetUser();
    if (!u) return;
    const pw = this.newPassword();
    if (pw.length < 8) {
      this.resetError.set('كلمة السر يجب أن تكون 8 أحرف على الأقل');
      return;
    }
    this.resetBusy.set(true);
    this.resetError.set(null);
    try {
      await this.users.resetPassword(u.id, pw);
      this.resetSuccess.set(true);
      await this.users.loadAll();
    } catch (err: unknown) {
      this.resetError.set(this.extractError(err) || 'فشل إعادة التعيين');
    } finally {
      this.resetBusy.set(false);
    }
  }

  clearFilters() {
    this.searchQuery.set('');
    this.roleFilter.set('all');
  }

  refresh() {
    this.users.loadAll();
  }

  private extractError(err: unknown): string | null {
    if (typeof err === 'object' && err !== null && 'error' in err) {
      const body = (err as { error?: { error?: string } }).error;
      if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
        return body.error;
      }
    }
    return null;
  }
}
