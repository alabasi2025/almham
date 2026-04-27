import { Injectable, computed, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SidebarLayoutService {
  private readonly collapsed = signal(this.readStoredState());

  isCollapsed = computed(() => this.collapsed());

  toggleCollapsed(): void {
    this.setCollapsed(!this.collapsed());
  }

  setCollapsed(value: boolean): void {
    this.collapsed.set(value);
    this.writeStoredState(value);
  }

  private readStoredState(): boolean {
    try {
      return localStorage.getItem('almham.sidebarCollapsed') === 'true';
    } catch {
      return false;
    }
  }

  private writeStoredState(value: boolean): void {
    try {
      localStorage.setItem('almham.sidebarCollapsed', String(value));
    } catch {
      // Ignore storage errors in restricted browser modes.
    }
  }
}
