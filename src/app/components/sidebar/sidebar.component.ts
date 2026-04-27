import { Component, computed, inject, signal, ElementRef, OnDestroy, AfterViewInit, Renderer2, effect } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';
import { StationService } from '../../services/station.service';
import { EmployeeService } from '../../services/employee.service';
import { TaskService } from '../../services/task.service';
import { AuthService } from '../../services/auth.service';
import { SidebarLayoutService } from '../../services/sidebar-layout.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterModule, RouterLink, RouterLinkActive, CommonModule],
  template: `
    <!-- Mobile Menu Toggle — Animated Hamburger / X -->
    <button
      class="mobile-menu-toggle"
      [class.active]="isSidebarOpen()"
      (click)="toggleSidebar()"
      aria-label="القائمة">
      <div class="hamburger-box">
        <span class="hamburger-bar bar-top"></span>
        <span class="hamburger-bar bar-mid"></span>
        <span class="hamburger-bar bar-bot"></span>
      </div>
    </button>

    <!-- Overlay for mobile -->
    <div
      class="sidebar-overlay"
      [class.active]="isSidebarOpen()"
      (click)="closeSidebar()">
    </div>

    <aside
      class="sidebar"
      [class.collapsed]="isSidebarCollapsed()"
      [class.mobile-open]="isSidebarOpen()"
      [class.mobile-animating]="isMobileAnimating()"
      (click)="onSidebarClick($event)"
      (touchstart)="onTouchStart($event)"
      (touchmove)="onTouchMove($event)"
      (touchend)="onTouchEnd($event)">
      <!-- Brand Header -->
      <div class="brand-header">
        <div class="brand-logo">
          <div class="logo-bg">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        </div>
        <div class="brand-text">
          <h3>أنظمة العباسي</h3>
          <span>المتخصصة</span>
        </div>
        <button
          type="button"
          class="sidebar-collapse-toggle"
          (click)="toggleSidebarCollapse($event)"
          [attr.aria-label]="isSidebarCollapsed() ? 'فتح القائمة الجانبية' : 'طي القائمة الجانبية'"
          [attr.title]="isSidebarCollapsed() ? 'فتح القائمة' : 'طي القائمة'">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
      </div>

      <!-- Navigation -->
      <nav class="main-nav">
        <a routerLink="/dashboard" routerLinkActive="active" class="nav-item mob-nav-item">
          <div class="nav-icon dashboard">
            <svg viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="7" height="7" rx="1" fill="currentColor"/>
              <rect x="14" y="3" width="7" height="7" rx="1" fill="currentColor"/>
              <rect x="14" y="14" width="7" height="7" rx="1" fill="currentColor"/>
              <rect x="3" y="14" width="7" height="7" rx="1" fill="currentColor"/>
            </svg>
          </div>
          <span>لوحة التحكم</span>
        </a>

        <!-- Stations group (expandable) -->
        <div class="nav-group" [class.open]="isStationsOpen() || stationsRouteActive()">
          <button
            type="button"
            class="nav-item nav-group-toggle mob-nav-item"
            [class.active]="stationsRouteActive()"
            (click)="toggleStations($event)">
            <div class="nav-icon stations">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7v10c0 5.55 3.84 10 8 9 4.16 1 8-3.45 8-9V7l-10-5z" stroke="currentColor" stroke-width="1.5" fill="currentColor" fill-opacity="0.1"/>
                <path d="M8 11l2 2 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <span>المحطات</span>
            <div class="count-badge">{{ stationService.stations().length }}</div>
            <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>

          <div class="subnav">
            <a routerLink="/stations" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" class="subnav-item mob-nav-item">
              <span class="sub-dot"></span>
              <span>قائمة المحطات</span>
            </a>
            <a routerLink="/stations/generators" routerLinkActive="active" class="subnav-item mob-nav-item">
              <span class="sub-dot"></span>
              <span>المولدات</span>
            </a>
            <a routerLink="/stations/network" routerLinkActive="active" class="subnav-item mob-nav-item">
              <span class="sub-dot"></span>
              <span>الطبلات والشبكة</span>
            </a>
            <a routerLink="/stations/network-map" routerLinkActive="active" class="subnav-item mob-nav-item">
              <span class="sub-dot"></span>
              <span>خريطة الشبكة</span>
            </a>
          </div>
        </div>

        <!-- Employees group (expandable) -->
        <div class="nav-group" [class.open]="isEmployeesOpen() || employeesRouteActive()">
          <button
            type="button"
            class="nav-item nav-group-toggle mob-nav-item"
            [class.active]="employeesRouteActive()"
            (click)="toggleEmployees($event)">
            <div class="nav-icon employees">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="1.5" fill="currentColor" fill-opacity="0.1"/>
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </div>
            <span>الموظفين</span>
            <div class="count-badge">{{ employeeService.activeCount() }}</div>
            <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>

          <div class="subnav">
            <a routerLink="/employees" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" class="subnav-item mob-nav-item">
              <span class="sub-dot"></span>
              <span>الموظفين</span>
            </a>
            <a routerLink="/employees/attendance" routerLinkActive="active" class="subnav-item mob-nav-item">
              <span class="sub-dot"></span>
              <span>الحضور والوردية</span>
            </a>
          </div>
        </div>

        <a routerLink="/tasks" routerLinkActive="active" class="nav-item mob-nav-item">
          <div class="nav-icon tasks">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <path d="M16 2v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <path d="M21 6H8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </div>
          <span>المهام</span>
          @if (taskService.pendingCount() > 0) {
            <div class="alert-badge">{{ taskService.pendingCount() }}</div>
          }
        </a>

        <a routerLink="/fuel" routerLinkActive="active" class="nav-item mob-nav-item">
          <div class="nav-icon fuel">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M3 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              <path d="M3 22h12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              <path d="M6 9h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              <path d="M15 8h2a2 2 0 0 1 2 2v7a2 2 0 1 1-4 0v-3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              <path d="M18 5l2 2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
            </svg>
          </div>
          <span>إدارة الديزل</span>
        </a>

        <a routerLink="/maps" routerLinkActive="active" class="nav-item mob-nav-item">
          <div class="nav-icon maps">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6z" stroke="currentColor" stroke-width="1.5" fill="currentColor" fill-opacity="0.1" stroke-linejoin="round"/>
              <path d="M9 3v15M15 6v15" stroke="currentColor" stroke-width="1.5"/>
              <circle cx="12" cy="10" r="2" fill="currentColor"/>
            </svg>
          </div>
          <span>الخرائط</span>
          <span class="new-badge">جديد</span>
        </a>

        <!-- Suppliers group (expandable) -->
        <div class="nav-group" [class.open]="isSuppliersOpen() || suppliersRouteActive()">
          <button
            type="button"
            class="nav-item nav-group-toggle mob-nav-item"
            [class.active]="suppliersRouteActive()"
            (click)="toggleSuppliers($event)">
            <div class="nav-icon suppliers">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M3 17V7a2 2 0 0 1 2-2h9v12H5a2 2 0 0 1-2-2z" stroke="currentColor" stroke-width="1.5" fill="currentColor" fill-opacity="0.1"/>
                <path d="M14 8h4l3 3v6a2 2 0 0 1-2 2h-5V8z" stroke="currentColor" stroke-width="1.5" fill="currentColor" fill-opacity="0.1"/>
                <circle cx="7" cy="19" r="2" stroke="currentColor" stroke-width="1.5" fill="#0a0e27"/>
                <circle cx="17" cy="19" r="2" stroke="currentColor" stroke-width="1.5" fill="#0a0e27"/>
              </svg>
            </div>
            <span>الموردين</span>
            <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>

          <div class="subnav">
            <a routerLink="/suppliers/fuel" routerLinkActive="active" class="subnav-item mob-nav-item">
              <span class="sub-dot"></span>
              <span>موردي الديزل</span>
            </a>
          </div>
        </div>

        <!-- Treasury -->
        <a routerLink="/treasury" routerLinkActive="active" class="nav-item mob-nav-item">
          <div class="nav-icon treasury-nav">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M12 2L2 7l10 5 10-5-10-5z" fill="currentColor" fill-opacity="0.2"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <span>الخزينة والتحصيل</span>
        </a>

        <!-- Users management (admin/accountant only) -->
        @if (authService.canManageUsers()) {
          <a routerLink="/users" routerLinkActive="active" class="nav-item mob-nav-item">
            <div class="nav-icon users-nav">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" fill="currentColor" fill-opacity="0.15"/>
                <circle cx="9" cy="7" r="4" fill="currentColor" fill-opacity="0.15"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <span>المستخدمون</span>
          </a>
        }
      </nav>

      <!-- User Profile -->
      <div class="user-profile">
        <div class="profile-card">
          <div class="profile-avatar">
            <div class="avatar-bg">{{ userInitial() }}</div>
            <div class="status-dot"></div>
          </div>
          <div class="profile-info">
            <span class="profile-name">{{ userDisplayName() }}</span>
            <span class="profile-status">{{ userRoleLabel() }}</span>
          </div>
          <button class="profile-menu" (click)="logout()" title="تسجيل خروج">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </div>
    </aside>
  `,
  styles: [`
    .sidebar {
      width: 280px;
      height: 100vh;
      background: linear-gradient(180deg, #0a0e27 0%, #1a1f3a 50%, #0f1629 100%);
      color: #e2e8f0;
      position: fixed;
      top: 0;
      right: 0;
      z-index: 1000;
      border-left: 1px solid rgba(139, 92, 246, 0.15);
      display: flex;
      flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      box-shadow: -4px 0 24px rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(10px);
      transition:
        width 0.3s cubic-bezier(0.4, 0, 0.2, 1),
        transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
      overflow-y: auto;
      overflow-x: hidden;
    }

    .sidebar.collapsed {
      width: 88px;
    }

    .sidebar::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 300px;
      background: radial-gradient(circle at 50% 0%, rgba(139, 92, 246, 0.15), transparent 70%);
      pointer-events: none;
    }

    /* Brand Header */
    .brand-header {
      padding: 28px 20px;
      border-bottom: 1px solid rgba(139, 92, 246, 0.12);
      display: flex;
      align-items: center;
      gap: 14px;
      background: rgba(139, 92, 246, 0.03);
      backdrop-filter: blur(12px);
      position: relative;
      z-index: 1;
    }

    .sidebar-collapse-toggle {
      width: 34px;
      height: 34px;
      border: 1px solid rgba(139, 92, 246, 0.22);
      border-radius: 10px;
      background: rgba(15, 23, 42, 0.62);
      color: #c4b5fd;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      margin-right: auto;
      transition: all 0.2s ease;
      position: relative;
      z-index: 2;
      flex-shrink: 0;
    }

    .sidebar-collapse-toggle:hover {
      background: rgba(139, 92, 246, 0.2);
      border-color: rgba(196, 181, 253, 0.45);
      color: #f8fafc;
    }

    .sidebar-collapse-toggle svg {
      width: 18px;
      height: 18px;
      transition: transform 0.25s ease;
    }

    .sidebar.collapsed .sidebar-collapse-toggle {
      position: absolute;
      left: 50%;
      bottom: 12px;
      margin-right: 0;
      transform: translateX(-50%);
    }

    .sidebar.collapsed .sidebar-collapse-toggle svg {
      transform: rotate(180deg);
    }

    .brand-logo {
      position: relative;
      flex-shrink: 0;
    }

    .logo-bg {
      width: 52px;
      height: 52px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8px 32px rgba(139, 92, 246, 0.4),
                  0 0 0 4px rgba(139, 92, 246, 0.1);
      position: relative;
      overflow: hidden;
      animation: glow 3s ease-in-out infinite;
    }

    @keyframes glow {
      0%, 100% {
        box-shadow: 0 8px 32px rgba(139, 92, 246, 0.4),
                    0 0 0 4px rgba(139, 92, 246, 0.1);
      }
      50% {
        box-shadow: 0 8px 40px rgba(139, 92, 246, 0.6),
                    0 0 0 4px rgba(139, 92, 246, 0.2);
      }
    }

    .logo-bg::before {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: linear-gradient(45deg, transparent, rgba(255, 255, 255, 0.15), transparent);
      animation: shine 3s linear infinite;
    }

    @keyframes shine {
      0% { transform: translateX(-100%) translateY(-100%) rotate(45deg); }
      100% { transform: translateX(100%) translateY(100%) rotate(45deg); }
    }

    .logo-bg svg {
      width: 28px;
      height: 28px;
      color: white;
      filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
      position: relative;
      z-index: 1;
    }

    .brand-text h3 {
      margin: 0;
      font-size: 20px;
      font-weight: 800;
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      letter-spacing: -0.025em;
      text-shadow: 0 2px 8px rgba(255, 255, 255, 0.1);
    }

    .brand-text span {
      font-size: 12px;
      color: #a5b4fc;
      font-weight: 600;
      display: block;
      margin-top: 4px;
      letter-spacing: 0.02em;
    }

    .sidebar.collapsed .brand-header {
      justify-content: center;
      padding: 18px 12px 58px;
      gap: 0;
    }

    .sidebar.collapsed .brand-text {
      display: none;
    }

    .sidebar.collapsed .logo-bg {
      width: 46px;
      height: 46px;
      border-radius: 14px;
    }

    /* Main Navigation */
    .main-nav {
      flex: 1;
      padding: 20px 0;
      overflow-y: auto;
      position: relative;
      z-index: 1;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 20px;
      margin: 4px 16px;
      border-radius: 14px;
      text-decoration: none;
      color: #cbd5e1;
      font-size: 14px;
      font-weight: 600;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      border: 1px solid transparent;
      overflow: hidden;
    }

    .nav-item span,
    .profile-info,
    .count-badge,
    .alert-badge,
    .new-badge,
    .chevron {
      transition: opacity 0.2s ease;
    }

    .sidebar.collapsed .nav-item {
      justify-content: center;
      gap: 0;
      padding: 12px;
      margin: 6px 14px;
      min-height: 48px;
    }

    .sidebar.collapsed .nav-item span,
    .sidebar.collapsed .count-badge,
    .sidebar.collapsed .alert-badge,
    .sidebar.collapsed .new-badge,
    .sidebar.collapsed .chevron {
      display: none;
    }

    .nav-item::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, transparent, rgba(255, 255, 255, 0.02));
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    .nav-item:hover {
      background: rgba(139, 92, 246, 0.12);
      color: #f8fafc;
      border-color: rgba(139, 92, 246, 0.25);
      transform: translateX(-4px);
      box-shadow: 0 4px 16px rgba(139, 92, 246, 0.15);
    }

    .nav-item:hover::before {
      opacity: 1;
    }

    .nav-item.active {
      background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(99, 102, 241, 0.2) 100%);
      color: #ffffff;
      border-color: rgba(139, 92, 246, 0.4);
      box-shadow: 0 4px 20px rgba(139, 92, 246, 0.25),
                  inset 0 1px 0 rgba(255, 255, 255, 0.1);
      transform: translateX(-4px);
    }

    .nav-item.active::after {
      content: '';
      position: absolute;
      right: 0;
      top: 50%;
      transform: translateY(-50%);
      width: 4px;
      height: 60%;
      background: linear-gradient(180deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
      border-radius: 4px 0 0 4px;
      box-shadow: 0 0 12px rgba(139, 92, 246, 0.6);
    }

    /* Navigation Icons */
    .nav-icon {
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      flex-shrink: 0;
      border-radius: 10px;
      transition: all 0.3s ease;
    }

    .nav-icon svg {
      width: 20px;
      height: 20px;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      z-index: 1;
    }

    .nav-icon.dashboard {
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(37, 99, 235, 0.15));
      box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.2);
    }
    .nav-icon.dashboard svg {
      color: #60a5fa;
      filter: drop-shadow(0 2px 4px rgba(59, 130, 246, 0.3));
    }

    .nav-icon.stations {
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(5, 150, 105, 0.15));
      box-shadow: 0 0 0 1px rgba(16, 185, 129, 0.2);
    }
    .nav-icon.stations svg {
      color: #34d399;
      filter: drop-shadow(0 2px 4px rgba(16, 185, 129, 0.3));
    }

    .nav-icon.employees {
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(217, 119, 6, 0.15));
      box-shadow: 0 0 0 1px rgba(245, 158, 11, 0.2);
    }
    .nav-icon.employees svg {
      color: #fbbf24;
      filter: drop-shadow(0 2px 4px rgba(245, 158, 11, 0.3));
    }

    .nav-icon.tasks {
      background: linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(124, 58, 237, 0.15));
      box-shadow: 0 0 0 1px rgba(139, 92, 246, 0.2);
    }
    .nav-icon.tasks svg {
      color: #a78bfa;
      filter: drop-shadow(0 2px 4px rgba(139, 92, 246, 0.3));
    }

    .nav-icon.fuel {
      background: linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(234, 88, 12, 0.15));
      box-shadow: 0 0 0 1px rgba(239, 68, 68, 0.2);
    }
    .nav-icon.fuel svg {
      color: #f87171;
      filter: drop-shadow(0 2px 4px rgba(239, 68, 68, 0.3));
    }

    .nav-icon.suppliers {
      background: linear-gradient(135deg, rgba(14, 165, 233, 0.15), rgba(6, 182, 212, 0.15));
      box-shadow: 0 0 0 1px rgba(14, 165, 233, 0.2);
    }
    .nav-icon.suppliers svg {
      color: #38bdf8;
      filter: drop-shadow(0 2px 4px rgba(14, 165, 233, 0.3));
    }

    .nav-icon.maps {
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(20, 184, 166, 0.15));
      box-shadow: 0 0 0 1px rgba(16, 185, 129, 0.2);
    }
    .nav-icon.maps svg {
      color: #34d399;
      filter: drop-shadow(0 2px 4px rgba(16, 185, 129, 0.3));
    }

    .nav-icon.treasury-nav {
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(37, 99, 235, 0.15));
      box-shadow: 0 0 0 1px rgba(16, 185, 129, 0.2);
    }
    .nav-icon.treasury-nav svg {
      color: #5eead4;
      filter: drop-shadow(0 2px 4px rgba(45, 212, 191, 0.3));
    }

    .nav-icon.users-nav {
      background: linear-gradient(135deg, rgba(236, 72, 153, 0.15), rgba(139, 92, 246, 0.15));
      box-shadow: 0 0 0 1px rgba(236, 72, 153, 0.2);
    }
    .nav-icon.users-nav svg {
      color: #f0abfc;
      filter: drop-shadow(0 2px 4px rgba(236, 72, 153, 0.3));
    }

    .new-badge {
      margin-left: auto;
      background: linear-gradient(135deg, #ec4899, #f59e0b);
      color: white;
      font-size: 9px;
      font-weight: 800;
      padding: 3px 8px;
      border-radius: 10px;
      letter-spacing: 0.5px;
      box-shadow: 0 2px 8px rgba(236, 72, 153, 0.4);
      animation: badge-glow 2s infinite;
    }

    @keyframes badge-glow {
      0%, 100% { box-shadow: 0 2px 8px rgba(236, 72, 153, 0.4); }
      50% { box-shadow: 0 4px 14px rgba(236, 72, 153, 0.7); }
    }

    /* Expandable Nav Group */
    .nav-group {
      display: block;
    }

    .nav-group-toggle {
      width: calc(100% - 32px);
      background: none;
      border: 1px solid transparent;
      font-family: inherit;
      text-align: right;
      cursor: pointer;
    }

    .sidebar.collapsed .nav-group-toggle {
      width: auto;
    }

    .nav-group-toggle .chevron {
      width: 14px;
      height: 14px;
      margin-right: 4px;
      color: #94a3b8;
      transition: transform 0.3s ease;
      transform: rotate(-90deg);
    }

    .nav-group-toggle:not(:has(.count-badge)) .chevron {
      margin-left: auto;
    }

    .nav-group.open .nav-group-toggle .chevron {
      transform: rotate(90deg);
      color: #c4b5fd;
    }

    .subnav {
      max-height: 0;
      overflow: hidden;
      transition: max-height 0.3s ease;
      padding-right: 32px;
      padding-left: 16px;
    }

    .nav-group.open .subnav {
      max-height: 400px;
      padding-top: 4px;
      padding-bottom: 6px;
    }

    .sidebar.collapsed .subnav {
      max-height: 0 !important;
      padding-top: 0;
      padding-bottom: 0;
    }

    .subnav-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      margin: 2px 0;
      border-radius: 10px;
      text-decoration: none;
      color: #94a3b8;
      font-size: 13px;
      font-weight: 600;
      transition: all 0.2s ease;
      position: relative;
    }

    .subnav-item::before {
      content: '';
      position: absolute;
      right: -12px;
      top: 0;
      bottom: 0;
      width: 2px;
      background: linear-gradient(180deg, transparent, rgba(139, 92, 246, 0.2), transparent);
    }

    .subnav-item .sub-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #475569;
      flex-shrink: 0;
      transition: all 0.2s ease;
    }

    .subnav-item:hover {
      background: rgba(139, 92, 246, 0.08);
      color: #e2e8f0;
      transform: translateX(-3px);
    }

    .subnav-item:hover .sub-dot {
      background: #a78bfa;
      box-shadow: 0 0 8px rgba(167, 139, 250, 0.6);
    }

    .subnav-item.active {
      background: linear-gradient(135deg, rgba(14, 165, 233, 0.15), rgba(56, 189, 248, 0.15));
      color: #7dd3fc;
      border: 1px solid rgba(14, 165, 233, 0.25);
    }

    .subnav-item.active .sub-dot {
      background: #38bdf8;
      box-shadow: 0 0 10px rgba(56, 189, 248, 0.8);
    }

    .nav-item:hover .nav-icon {
      transform: scale(1.05) rotate(3deg);
      box-shadow: 0 4px 12px rgba(139, 92, 246, 0.2);
    }

    .nav-item:hover .nav-icon svg {
      transform: scale(1.1);
    }

    .nav-item.active .nav-icon {
      background: linear-gradient(135deg, rgba(139, 92, 246, 0.25), rgba(99, 102, 241, 0.25));
      box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.4),
                  0 4px 16px rgba(139, 92, 246, 0.3);
      transform: scale(1.05);
    }

    .nav-item.active .nav-icon svg {
      color: #c4b5fd !important;
      filter: drop-shadow(0 2px 8px rgba(139, 92, 246, 0.5));
    }

    /* Badges */
    .count-badge {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 8px;
      border-radius: 12px;
      min-width: 22px;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-left: auto;
      box-shadow: 0 2px 8px rgba(139, 92, 246, 0.4),
                  inset 0 1px 0 rgba(255, 255, 255, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .alert-badge {
      background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 50%, #ff4757 100%);
      color: white;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 8px;
      border-radius: 12px;
      min-width: 22px;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-left: auto;
      box-shadow: 0 2px 8px rgba(239, 68, 68, 0.4),
                  inset 0 1px 0 rgba(255, 255, 255, 0.2),
                  0 0 0 3px rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(255, 255, 255, 0.15);
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% {
        transform: scale(1);
        box-shadow: 0 2px 8px rgba(239, 68, 68, 0.4),
                    inset 0 1px 0 rgba(255, 255, 255, 0.2),
                    0 0 0 3px rgba(239, 68, 68, 0.15);
      }
      50% {
        transform: scale(1.08);
        box-shadow: 0 4px 12px rgba(239, 68, 68, 0.6),
                    inset 0 1px 0 rgba(255, 255, 255, 0.2),
                    0 0 0 5px rgba(239, 68, 68, 0.25);
      }
    }

    /* User Profile */
    .user-profile {
      padding: 20px;
      border-top: 1px solid rgba(139, 92, 246, 0.12);
      background: linear-gradient(135deg, rgba(139, 92, 246, 0.03) 0%, rgba(99, 102, 241, 0.03) 100%);
      position: relative;
    }

    .profile-card {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px;
      background: linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(99, 102, 241, 0.08) 100%);
      border: 1px solid rgba(139, 92, 246, 0.15);
      border-radius: 16px;
      transition: all 0.3s ease;
      cursor: pointer;
      box-shadow: 0 2px 12px rgba(139, 92, 246, 0.1),
                  inset 0 1px 0 rgba(255, 255, 255, 0.05);
    }

    .profile-card:hover {
      background: linear-gradient(135deg, rgba(139, 92, 246, 0.12) 0%, rgba(99, 102, 241, 0.12) 100%);
      border-color: rgba(139, 92, 246, 0.25);
      transform: translateY(-2px);
      box-shadow: 0 4px 16px rgba(139, 92, 246, 0.2),
                  inset 0 1px 0 rgba(255, 255, 255, 0.1);
    }

    .profile-avatar {
      position: relative;
      flex-shrink: 0;
    }

    .avatar-bg {
      width: 44px;
      height: 44px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      font-weight: 800;
      color: white;
      box-shadow: 0 4px 16px rgba(139, 92, 246, 0.4),
                  0 0 0 3px rgba(139, 92, 246, 0.15);
      position: relative;
      overflow: hidden;
    }

    .avatar-bg::before {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: linear-gradient(45deg, transparent, rgba(255, 255, 255, 0.1), transparent);
      animation: avatarShine 4s linear infinite;
    }

    @keyframes avatarShine {
      0% { transform: translateX(-100%) translateY(-100%) rotate(45deg); }
      100% { transform: translateX(100%) translateY(100%) rotate(45deg); }
    }

    .status-dot {
      position: absolute;
      bottom: -2px;
      left: -2px;
      width: 14px;
      height: 14px;
      background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
      border: 3px solid #0a0e27;
      border-radius: 50%;
      box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.3),
                  0 0 12px rgba(16, 185, 129, 0.6);
      animation: statusPulse 2s ease-in-out infinite;
    }

    @keyframes statusPulse {
      0%, 100% {
        box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.3),
                    0 0 12px rgba(16, 185, 129, 0.6);
      }
      50% {
        box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.4),
                    0 0 16px rgba(16, 185, 129, 0.8);
      }
    }

    .profile-info {
      flex: 1;
      min-width: 0;
    }

    .profile-name {
      display: block;
      font-size: 14px;
      font-weight: 700;
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      line-height: 1.3;
    }

    .profile-status {
      font-size: 11px;
      color: #34d399;
      font-weight: 600;
      display: block;
      margin-top: 3px;
      letter-spacing: 0.02em;
    }

    .profile-menu {
      width: 32px;
      height: 32px;
      border: none;
      background: rgba(139, 92, 246, 0.1);
      color: #a5b4fc;
      cursor: pointer;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
      border: 1px solid rgba(139, 92, 246, 0.15);
    }

    .profile-menu:hover {
      background: rgba(139, 92, 246, 0.2);
      color: #c4b5fd;
      border-color: rgba(139, 92, 246, 0.3);
      transform: scale(1.05);
    }

    .profile-menu svg {
      width: 18px;
      height: 18px;
    }

    .sidebar.collapsed .user-profile {
      padding: 14px 10px;
    }

    .sidebar.collapsed .profile-card {
      justify-content: center;
      padding: 10px;
      gap: 0;
    }

    .sidebar.collapsed .profile-info,
    .sidebar.collapsed .profile-menu {
      display: none;
    }

    /* Scrollbar */
    .main-nav::-webkit-scrollbar {
      width: 6px;
    }

    .main-nav::-webkit-scrollbar-track {
      background: rgba(139, 92, 246, 0.05);
      border-radius: 3px;
    }

    .main-nav::-webkit-scrollbar-thumb {
      background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
      border-radius: 3px;
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1);
    }

    .main-nav::-webkit-scrollbar-thumb:hover {
      background: linear-gradient(180deg, #764ba2 0%, #f093fb 100%);
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.2),
                  0 0 8px rgba(139, 92, 246, 0.3);
    }

    /* ===================================================
       MOBILE MENU TOGGLE — Animated Hamburger → X
       =================================================== */
    .mobile-menu-toggle {
      display: none;
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 1100;
      width: 50px;
      height: 50px;
      border: none;
      background: rgba(15, 22, 41, 0.85);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-radius: 14px;
      cursor: pointer;
      box-shadow:
        0 4px 20px rgba(0, 0, 0, 0.3),
        0 0 0 1px rgba(139, 92, 246, 0.25),
        inset 0 1px 0 rgba(255, 255, 255, 0.06);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      align-items: center;
      justify-content: center;
      padding: 0;
    }

    .mobile-menu-toggle::before {
      content: '';
      position: absolute;
      inset: -2px;
      border-radius: 16px;
      background: linear-gradient(135deg, rgba(139, 92, 246, 0.4), rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.4));
      z-index: -1;
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    .mobile-menu-toggle:active {
      transform: scale(0.92);
    }

    .mobile-menu-toggle.active {
      background: rgba(139, 92, 246, 0.2);
      box-shadow:
        0 4px 24px rgba(139, 92, 246, 0.35),
        0 0 0 1px rgba(139, 92, 246, 0.4),
        inset 0 1px 0 rgba(255, 255, 255, 0.08);
    }

    .mobile-menu-toggle.active::before {
      opacity: 1;
      animation: toggle-glow-pulse 2s ease-in-out infinite;
    }

    @keyframes toggle-glow-pulse {
      0%, 100% { opacity: 0.5; }
      50% { opacity: 1; }
    }

    /* Hamburger bars container */
    .hamburger-box {
      width: 22px;
      height: 16px;
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    .hamburger-bar {
      display: block;
      width: 100%;
      height: 2px;
      background: #e2e8f0;
      border-radius: 2px;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      transform-origin: center center;
    }

    /* Hamburger → X animation */
    .mobile-menu-toggle.active .bar-top {
      transform: translateY(7px) rotate(45deg);
      background: #c4b5fd;
    }

    .mobile-menu-toggle.active .bar-mid {
      opacity: 0;
      transform: scaleX(0);
    }

    .mobile-menu-toggle.active .bar-bot {
      transform: translateY(-7px) rotate(-45deg);
      background: #c4b5fd;
    }

    /* ===================================================
       SIDEBAR OVERLAY — Blur + Fade
       =================================================== */
    .sidebar-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      z-index: 1000;
      opacity: 0;
      transition: opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1);
      pointer-events: none;
    }

    .sidebar-overlay.active {
      opacity: 1;
      pointer-events: all;
    }

    /* ===================================================
       MOBILE NAV ITEM STAGGER ANIMATION
       =================================================== */
    @keyframes navItemSlideIn {
      from {
        opacity: 0;
        transform: translateX(20px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    /* ===================================================
       RESPONSIVE — MOBILE ONLY
       =================================================== */
    @media (max-width: 1024px) {
      .mobile-menu-toggle {
        display: flex;
      }

      .sidebar-collapse-toggle {
        display: none;
      }

      .sidebar-overlay {
        display: block;
      }

      .sidebar {
        width: 300px;
        transform: translateX(100%);
        transition: transform 0.4s cubic-bezier(0.32, 0.72, 0, 1);
        z-index: 1001;
        box-shadow: -8px 0 40px rgba(0, 0, 0, 0.5);
        will-change: transform;
      }

      .sidebar.collapsed {
        width: 300px;
      }

      .sidebar.collapsed .brand-header {
        justify-content: flex-start;
        padding: 28px 20px;
        gap: 14px;
      }

      .sidebar.collapsed .brand-text,
      .sidebar.collapsed .nav-item span {
        display: block;
      }

      .sidebar.collapsed .count-badge,
      .sidebar.collapsed .alert-badge {
        display: flex;
      }

      .sidebar.collapsed .new-badge {
        display: inline-block;
      }

      .sidebar.collapsed .chevron {
        display: block;
      }

      .sidebar.collapsed .nav-item {
        justify-content: flex-start;
        gap: 14px;
        padding: 14px 20px;
        margin: 4px 16px;
        min-height: auto;
      }

      .sidebar.collapsed .nav-group-toggle {
        width: calc(100% - 32px);
      }

      .sidebar.collapsed .nav-group.open .subnav {
        max-height: 400px !important;
        padding-top: 4px;
        padding-bottom: 6px;
      }

      .sidebar.collapsed .profile-card {
        justify-content: flex-start;
        gap: 14px;
      }

      .sidebar.collapsed .profile-info {
        display: block;
      }

      .sidebar.collapsed .profile-menu {
        display: flex;
      }

      /* Disable transition during swipe so sidebar follows finger */
      .sidebar.mobile-animating {
        transition: none !important;
      }

      .sidebar.mobile-open {
        transform: translateX(0);
      }

      /* Stagger entrance animation for nav items when sidebar opens */
      .sidebar.mobile-open .mob-nav-item {
        animation: navItemSlideIn 0.35s cubic-bezier(0.32, 0.72, 0, 1) both;
      }

      .sidebar.mobile-open .main-nav > .mob-nav-item:nth-child(1),
      .sidebar.mobile-open .main-nav > .nav-group:nth-child(1) .mob-nav-item {
        animation-delay: 0.06s;
      }
      .sidebar.mobile-open .main-nav > .mob-nav-item:nth-child(2),
      .sidebar.mobile-open .main-nav > .nav-group:nth-child(2) .nav-group-toggle {
        animation-delay: 0.1s;
      }
      .sidebar.mobile-open .main-nav > .mob-nav-item:nth-child(3),
      .sidebar.mobile-open .main-nav > .nav-group:nth-child(3) .nav-group-toggle {
        animation-delay: 0.14s;
      }
      .sidebar.mobile-open .main-nav > .mob-nav-item:nth-child(4),
      .sidebar.mobile-open .main-nav > .nav-group:nth-child(4) .nav-group-toggle {
        animation-delay: 0.18s;
      }
      .sidebar.mobile-open .main-nav > .mob-nav-item:nth-child(5),
      .sidebar.mobile-open .main-nav > .nav-group:nth-child(5) .nav-group-toggle {
        animation-delay: 0.22s;
      }
      .sidebar.mobile-open .main-nav > .mob-nav-item:nth-child(6),
      .sidebar.mobile-open .main-nav > .nav-group:nth-child(6) .nav-group-toggle {
        animation-delay: 0.26s;
      }
      .sidebar.mobile-open .main-nav > .mob-nav-item:nth-child(7),
      .sidebar.mobile-open .main-nav > .nav-group:nth-child(7) .nav-group-toggle {
        animation-delay: 0.30s;
      }
      .sidebar.mobile-open .main-nav > .mob-nav-item:nth-child(8),
      .sidebar.mobile-open .main-nav > .nav-group:nth-child(8) .nav-group-toggle {
        animation-delay: 0.34s;
      }
      .sidebar.mobile-open .main-nav > .mob-nav-item:nth-child(9),
      .sidebar.mobile-open .main-nav > .nav-group:nth-child(9) .nav-group-toggle {
        animation-delay: 0.38s;
      }
      .sidebar.mobile-open .main-nav > .mob-nav-item:nth-child(10),
      .sidebar.mobile-open .main-nav > .nav-group:nth-child(10) .nav-group-toggle {
        animation-delay: 0.42s;
      }

      /* Subnav items also stagger */
      .sidebar.mobile-open .subnav .mob-nav-item:nth-child(1) { animation-delay: 0.08s; }
      .sidebar.mobile-open .subnav .mob-nav-item:nth-child(2) { animation-delay: 0.12s; }
      .sidebar.mobile-open .subnav .mob-nav-item:nth-child(3) { animation-delay: 0.16s; }
      .sidebar.mobile-open .subnav .mob-nav-item:nth-child(4) { animation-delay: 0.20s; }
    }

    @media (max-width: 768px) {
      .sidebar {
        width: 290px;
      }

      .brand-header {
        padding: 20px 16px;
      }

      .logo-bg {
        width: 44px;
        height: 44px;
      }

      .brand-text h3 {
        font-size: 17px;
      }

      .brand-text span {
        font-size: 11px;
      }

      .nav-item {
        padding: 11px 14px;
        margin: 3px 10px;
        font-size: 13px;
        gap: 10px;
      }

      .nav-icon {
        width: 34px;
        height: 34px;
      }

      .nav-icon svg {
        width: 17px;
        height: 17px;
      }

      .count-badge, .alert-badge {
        font-size: 10px;
        min-width: 20px;
        height: 20px;
        padding: 3px 7px;
      }

      .user-profile {
        padding: 14px;
      }

      .profile-card {
        padding: 10px;
      }

      .avatar-bg {
        width: 38px;
        height: 38px;
        font-size: 14px;
      }

      .profile-name {
        font-size: 13px;
      }

      .profile-status {
        font-size: 10px;
      }
    }

    @media (max-width: 480px) {
      .sidebar {
        width: 280px;
      }

      .mobile-menu-toggle {
        width: 46px;
        height: 46px;
        top: 12px;
        right: 12px;
        border-radius: 12px;
      }

      .hamburger-box {
        width: 20px;
        height: 14px;
      }

      .mobile-menu-toggle.active .bar-top {
        transform: translateY(6px) rotate(45deg);
      }

      .mobile-menu-toggle.active .bar-bot {
        transform: translateY(-6px) rotate(-45deg);
      }

      .nav-item {
        padding: 10px 12px;
        margin: 2px 8px;
        font-size: 12px;
        gap: 8px;
        border-radius: 10px;
      }

      .nav-icon {
        width: 30px;
        height: 30px;
      }

      .nav-icon svg {
        width: 16px;
        height: 16px;
      }

      .brand-header {
        padding: 16px 12px;
      }

      .subnav {
        padding-right: 24px;
        padding-left: 8px;
      }

      .subnav-item {
        padding: 8px 10px;
        font-size: 12px;
      }
    }
  `]
})
export class SidebarComponent implements AfterViewInit, OnDestroy {
  stationService = inject(StationService);
  employeeService = inject(EmployeeService);
  taskService = inject(TaskService);
  authService = inject(AuthService);
  private sidebarLayout = inject(SidebarLayoutService);
  private router = inject(Router);
  private el = inject(ElementRef);
  private renderer = inject(Renderer2);

  isSidebarOpen = signal(false);
  isSuppliersOpen = signal(false);
  isStationsOpen = signal(false);
  isEmployeesOpen = signal(false);
  isMobileAnimating = signal(false);
  isSidebarCollapsed = this.sidebarLayout.isCollapsed;

  // Touch gesture state
  private touchStartX = 0;
  private touchStartY = 0;
  private touchCurrentX = 0;
  private isSwiping = false;
  private sidebarEl: HTMLElement | null = null;
  private readonly SWIPE_THRESHOLD = 80;

  userDisplayName = computed(() => {
    const user = this.authService.user();
    if (!user) return 'مستخدم';
    const emp = this.employeeService.employees().find((e) => e.id === user.employeeId);
    return emp?.name || user.username;
  });

  userInitial = computed(() => {
    const name = this.userDisplayName();
    return name.charAt(0) || 'م';
  });

  userRoleLabel = computed(() => {
    const role = this.authService.user()?.role;
    return this.authService.roleLabel(role);
  });

  // Body scroll lock effect
  private sidebarOpenEffect = effect(() => {
    const isOpen = this.isSidebarOpen();
    if (typeof document !== 'undefined') {
      if (isOpen) {
        this.renderer.setStyle(document.body, 'overflow', 'hidden');
        this.renderer.setStyle(document.body, 'touch-action', 'none');
      } else {
        this.renderer.removeStyle(document.body, 'overflow');
        this.renderer.removeStyle(document.body, 'touch-action');
      }
    }
  });

  ngAfterViewInit() {
    this.sidebarEl = this.el.nativeElement.querySelector('.sidebar');
  }

  ngOnDestroy() {
    // Restore body scroll on destroy
    if (typeof document !== 'undefined') {
      this.renderer.removeStyle(document.body, 'overflow');
      this.renderer.removeStyle(document.body, 'touch-action');
    }
  }

  async logout() {
    if (!confirm('هل تريد تسجيل الخروج؟')) return;
    try {
      await this.authService.logout();
    } catch {
      // backend may return 401 if session already revoked; ignore
    }
    this.router.navigate(['/login']);
  }

  // Track current URL as a signal to compute active group state
  private currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(this.router.url)
    ),
    { initialValue: this.router.url }
  );

  suppliersRouteActive = computed(() => this.currentUrl().startsWith('/suppliers'));
  stationsRouteActive = computed(() => this.currentUrl().startsWith('/stations'));
  employeesRouteActive = computed(() => this.currentUrl().startsWith('/employees'));

  toggleSidebar() {
    this.isSidebarOpen.set(!this.isSidebarOpen());
  }

  toggleSidebarCollapse(event: Event) {
    event.stopPropagation();
    this.sidebarLayout.toggleCollapsed();
  }

  closeSidebar() {
    this.isSidebarOpen.set(false);
  }

  toggleSuppliers(event: Event) {
    event.stopPropagation();
    if (this.expandCollapsedSidebar()) {
      this.isSuppliersOpen.set(true);
      return;
    }
    this.isSuppliersOpen.set(!this.isSuppliersOpen());
  }

  toggleStations(event: Event) {
    event.stopPropagation();
    if (this.expandCollapsedSidebar()) {
      this.isStationsOpen.set(true);
      return;
    }
    this.isStationsOpen.set(!this.isStationsOpen());
  }

  toggleEmployees(event: Event) {
    event.stopPropagation();
    if (this.expandCollapsedSidebar()) {
      this.isEmployeesOpen.set(true);
      return;
    }
    this.isEmployeesOpen.set(!this.isEmployeesOpen());
  }

  private expandCollapsedSidebar(): boolean {
    if (!this.isSidebarCollapsed()) return false;
    this.sidebarLayout.setCollapsed(false);
    return true;
  }

  onSidebarClick(event: Event) {
    const target = event.target as HTMLElement;
    if (target.closest('a')) {
      this.closeSidebar();
    }
  }

  // =============================================
  // SWIPE-TO-CLOSE TOUCH GESTURE HANDLING
  // RTL: sidebar is on the RIGHT, swipe RIGHT to close
  // =============================================

  onTouchStart(event: TouchEvent) {
    if (!this.isSidebarOpen()) return;
    const touch = event.touches[0];
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
    this.touchCurrentX = touch.clientX;
    this.isSwiping = false;
  }

  onTouchMove(event: TouchEvent) {
    if (!this.isSidebarOpen() || !this.sidebarEl) return;
    const touch = event.touches[0];
    const deltaX = touch.clientX - this.touchStartX;
    const deltaY = touch.clientY - this.touchStartY;

    // Determine if this is a horizontal swipe (not vertical scroll)
    if (!this.isSwiping) {
      if (Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY)) {
        this.isSwiping = true;
        // Disable CSS transition while following finger
        this.isMobileAnimating.set(true);
      } else {
        return;
      }
    }

    this.touchCurrentX = touch.clientX;

    // RTL: positive deltaX = swipe right = close direction
    // Only allow swiping in the close direction (right in RTL)
    const swipeDistance = Math.max(0, deltaX);

    // Move sidebar with finger
    this.sidebarEl.style.transform = `translateX(${swipeDistance}px)`;

    // Prevent page scroll during horizontal swipe
    event.preventDefault();
  }

  onTouchEnd(_event: TouchEvent) {
    if (!this.isSwiping || !this.sidebarEl) {
      this.isSwiping = false;
      return;
    }

    const deltaX = this.touchCurrentX - this.touchStartX;
    const swipeDistance = Math.max(0, deltaX);

    // Re-enable CSS transition
    this.isMobileAnimating.set(false);

    if (swipeDistance > this.SWIPE_THRESHOLD) {
      // Close sidebar
      this.closeSidebar();
    }

    // Clear inline transform — let CSS class handle it
    this.sidebarEl.style.transform = '';
    this.isSwiping = false;
  }
}
