import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  username = signal('');
  password = signal('');
  error = signal<string | null>(null);
  loading = signal(false);
  showPassword = signal(false);

  async submit(): Promise<void> {
    const u = this.username().trim();
    const p = this.password();
    if (!u || !p) {
      this.error.set('أدخل اسم المستخدم وكلمة السر');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    try {
      await this.auth.login(u, p);
      this.router.navigate(['/dashboard']);
    } catch (err: unknown) {
      const msg = this.extractError(err);
      this.error.set(msg);
    } finally {
      this.loading.set(false);
    }
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
