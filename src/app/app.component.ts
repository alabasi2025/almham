import { Component, HostListener, OnInit, computed, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { AuthService } from './services/auth.service';
import { SidebarLayoutService } from './services/sidebar-layout.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent],
  template: `
    @if (showShell()) {
      <div class="app-layout" [class.sidebar-collapsed]="sidebarCollapsed()">
        <app-sidebar />
        <main class="main-content">
          <router-outlet />
        </main>
      </div>
    } @else {
      <router-outlet />
    }
  `,
  styles: [`
    .app-layout {
      display: flex;
      min-height: 100vh;
    }

    .main-content {
      flex: 1;
      min-width: 0;
      width: 100%;
      margin-right: 280px;
      padding: 0;
      background: linear-gradient(135deg, #f8f9fc 0%, #f1f3f9 100%);
      overflow-x: hidden;
      transition: margin-right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
    }

    .app-layout.sidebar-collapsed .main-content {
      margin-right: 88px;
    }

    .main-content::before {
      content: '';
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 300px;
      background: radial-gradient(circle at 50% 0%, rgba(139, 92, 246, 0.05), transparent 70%);
      pointer-events: none;
      z-index: 0;
    }

    @media (max-width: 1024px) {
      .main-content,
      .app-layout.sidebar-collapsed .main-content {
        margin-right: 0;
        padding-top: 0;
      }

      .main-content::before {
        height: 200px;
      }
    }

    @media (max-width: 768px) {
      .main-content {
        margin-right: 0;
      }
    }

    @media (max-width: 480px) {
      .main-content::before {
        height: 150px;
      }
    }
  `],
})
export class AppComponent implements OnInit {
  private router = inject(Router);
  private auth = inject(AuthService);
  private sidebarLayout = inject(SidebarLayoutService);

  sidebarCollapsed = this.sidebarLayout.isCollapsed;

  private currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  showShell = computed(() => {
    const url = this.currentUrl() ?? '';
    return !url.startsWith('/login') && !url.startsWith('/change-password') && this.auth.isAuthenticated();
  });

  async ngOnInit() {
    await this.auth.loadCurrentUser();
  }

  @HostListener('document:wheel', ['$event'])
  preventNumberInputWheelChange(event: WheelEvent): void {
    if (!this.isNumberInput(event.target)) {
      return;
    }

    if (document.activeElement === event.target) {
      event.preventDefault();
    }
  }

  @HostListener('document:keydown', ['$event'])
  preventNumberInputArrowChange(event: KeyboardEvent): void {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
      return;
    }

    if (this.isNumberInput(event.target)) {
      event.preventDefault();
    }
  }

  private isNumberInput(target: EventTarget | null): target is HTMLInputElement {
    return target instanceof HTMLInputElement && target.type === 'number';
  }
}
