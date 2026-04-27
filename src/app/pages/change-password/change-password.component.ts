import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './change-password.component.html',
  styleUrls: ['./change-password.component.scss'],
})
export class ChangePasswordComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  currentPassword = signal('');
  newPassword = signal('');
  confirmPassword = signal('');
  showPasswords = signal(false);
  loading = signal(false);
  error = signal<string | null>(null);
  success = signal<string | null>(null);

  user = this.auth.user;

  async submit(): Promise<void> {
    this.error.set(null);
    this.success.set(null);

    const current = this.currentPassword();
    const next = this.newPassword();
    const confirm = this.confirmPassword();

    if (!current || !next || !confirm) {
      this.error.set('أكمل كل الحقول');
      return;
    }
    if (next.length < 8) {
      this.error.set('كلمة السر الجديدة يجب أن تكون 8 أحرف على الأقل');
      return;
    }
    if (next !== confirm) {
      this.error.set('تأكيد كلمة السر غير مطابق');
      return;
    }

    this.loading.set(true);
    try {
      await this.auth.changePassword(current, next);
      this.success.set('تم تغيير كلمة السر بنجاح');
      this.currentPassword.set('');
      this.newPassword.set('');
      this.confirmPassword.set('');
      setTimeout(() => this.router.navigate(['/dashboard']), 500);
    } catch (err: unknown) {
      this.error.set(this.extractError(err));
    } finally {
      this.loading.set(false);
    }
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    this.router.navigate(['/login']);
  }

  private extractError(err: unknown): string {
    if (typeof err === 'object' && err !== null && 'error' in err) {
      const body = (err as { error?: { error?: string } }).error;
      if (body && typeof body === 'object' && typeof body.error === 'string') {
        return body.error;
      }
    }
    return 'تعذر تغيير كلمة السر';
  }
}
