import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, LoginUserOption } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);

  usersList = signal<LoginUserOption[]>([]);
  selectedUserId = signal<string>('');

  password = signal('');
  error = signal<string | null>(null);
  loading = signal(false);
  showPassword = signal(false);

  ngOnInit(): void {
    void this.loadUsers();
  }

  private async loadUsers(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const list = await this.auth.listUsersForLogin();
      this.usersList.set(list);
      if (list.length > 0) {
        this.selectedUserId.set(list[0].id);
      }
      setTimeout(() => {
        const el = document.getElementById('login-password') as HTMLInputElement | null;
        el?.focus();
      }, 100);
    } catch {
      this.error.set('تعذّر تحميل قائمة المستخدمين');
    } finally {
      this.loading.set(false);
    }
  }

  async submit(): Promise<void> {
    const userId = this.selectedUserId();
    const p = this.password();
    const user = this.usersList().find((u) => u.id === userId);

    if (!user) {
      this.error.set('اختر مستخدماً من القائمة');
      return;
    }
    if (!p) {
      this.error.set('أدخل كلمة السر');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    try {
      const loggedInUser = await this.auth.login(user.username, p);
      this.router.navigate([loggedInUser.mustChangePassword ? '/change-password' : '/dashboard']);
    } catch (err: unknown) {
      this.error.set(this.extractError(err));
    } finally {
      this.loading.set(false);
    }
  }

  userDisplay(u: LoginUserOption): string {
    if (u.employeeName) return `${u.employeeName} (${u.username})`;
    return u.username;
  }

  roleLabel(role: string): string {
    return this.auth.roleLabel(role);
  }

  private extractError(err: unknown): string {
    if (typeof err === 'object' && err !== null && 'error' in err) {
      const body = (err as { error?: { error?: string } }).error;
      if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
        return body.error;
      }
    }
    return 'تعذّر تسجيل الدخول، تحقّق من البيانات';
  }
}
