import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';
import { StationService } from '../../services/station.service';
import { EmployeeService } from '../../services/employee.service';
import { TaskService } from '../../services/task.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterModule, RouterLink, RouterLinkActive, CommonModule],
  template: `
    <!-- Mobile Menu Toggle -->
    <button class="mobile-menu-toggle" (click)="toggleSidebar()" [class.active]="isSidebarOpen()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="3" y1="12" x2="21" y2="12"></line>
        <line x1="3" y1="6" x2="21" y2="6"></line>
        <line x1="3" y1="18" x2="21" y2="18"></line>
      </svg>
    </button>

    <!-- Overlay for mobile -->
    <div class="sidebar-overlay" [class.active]="isSidebarOpen()" (click)="closeSidebar()"></div>

    <aside class="sidebar" [class.mobile-open]="isSidebarOpen()"  (click)="onSidebarClick($event)">
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
      </div>

      <!-- Navigation -->
      <nav class="main-nav">
        <a routerLink="/dashboard" routerLinkActive="active" class="nav-item">
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
            class="nav-item nav-group-toggle"
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
            <a routerLink="/stations" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" class="subnav-item">
              <span class="sub-dot"></span>
              <span>قائمة المحطات</span>
            </a>
            <a routerLink="/stations/generators" routerLinkActive="active" class="subnav-item">
              <span class="sub-dot"></span>
              <span>المولدات</span>
            </a>
          </div>
        </div>

        <a routerLink="/employees" routerLinkActive="active" class="nav-item">
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
        </a>

        <a routerLink="/tasks" routerLinkActive="active" class="nav-item">
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

        <a routerLink="/fuel" routerLinkActive="active" class="nav-item">
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

        <a routerLink="/maps" routerLinkActive="active" class="nav-item">
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
            class="nav-item nav-group-toggle"
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
            <a routerLink="/suppliers/fuel" routerLinkActive="active" class="subnav-item">
              <span class="sub-dot"></span>
              <span>موردي الديزل</span>
            </a>
          </div>
        </div>

        <!-- Users management (admin/accountant only) -->
        @if (authService.canManageUsers()) {
          <a routerLink="/users" routerLinkActive="active" class="nav-item">
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

    .brand-logo {
      position: relative;
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

    .nav-group-toggle .chevron {
      width: 14px;
      height: 14px;
      margin-right: 4px;
      color: #94a3b8;
      transition: transform 0.3s ease;
      transform: rotate(-90deg); /* pointing down by default (RTL) */
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

    /* RTL Support - Already applied by default */

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

    /* Mobile Menu Toggle */
    .mobile-menu-toggle {
      display: none;
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 1100;
      width: 48px;
      height: 48px;
      border: none;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 12px;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(139, 92, 246, 0.4);
      transition: all 0.3s ease;
      border: 1px solid rgba(255, 255, 255, 0.2);

      svg {
        width: 24px;
        height: 24px;
        color: white;
        transition: transform 0.3s ease;
      }

      &:active {
        transform: scale(0.95);
      }

      &.active svg {
        transform: rotate(90deg);
      }
    }

    /* Sidebar Overlay for mobile */
    .sidebar-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(10, 14, 39, 0.8);
      backdrop-filter: blur(4px);
      z-index: 999;
      opacity: 0;
      transition: opacity 0.3s ease;
      pointer-events: none;

      &.active {
        opacity: 1;
        pointer-events: all;
      }
    }

    /* Responsive Design */
    @media (max-width: 1024px) {
      .mobile-menu-toggle {
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .sidebar-overlay {
        display: block;
      }

      .sidebar {
        transform: translateX(100%);
        z-index: 1001;
        box-shadow: -8px 0 32px rgba(0, 0, 0, 0.5);

        &.mobile-open {
          transform: translateX(0);
        }
      }
    }

    @media (max-width: 768px) {
      .sidebar {
        width: 280px;
      }

      .brand-header {
        padding: 20px 16px;
      }

      .logo-bg {
        width: 48px;
        height: 48px;
      }

      .brand-text h3 {
        font-size: 18px;
      }

      .brand-text span {
        font-size: 11px;
      }

      .nav-item {
        padding: 12px 16px;
        margin: 3px 12px;
        font-size: 13px;
      }

      .nav-icon {
        width: 36px;
        height: 36px;
      }

      .nav-icon svg {
        width: 18px;
        height: 18px;
      }

      .count-badge, .alert-badge {
        font-size: 10px;
        min-width: 20px;
        height: 20px;
        padding: 3px 7px;
      }

      .user-profile {
        padding: 16px;
      }

      .profile-card {
        padding: 12px;
      }

      .avatar-bg {
        width: 40px;
        height: 40px;
        font-size: 15px;
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
        width: 260px;
      }

      .mobile-menu-toggle {
        width: 44px;
        height: 44px;
        top: 12px;
        right: 12px;

        svg {
          width: 22px;
          height: 22px;
        }
      }

      .nav-item {
        padding: 10px 14px;
        margin: 2px 10px;
        font-size: 12px;
        gap: 10px;
      }

      .nav-icon {
        width: 32px;
        height: 32px;
      }
    }
  `]
})
export class SidebarComponent {
  stationService = inject(StationService);
  employeeService = inject(EmployeeService);
  taskService = inject(TaskService);
  authService = inject(AuthService);
  private router = inject(Router);

  isSidebarOpen = signal(false);
  isSuppliersOpen = signal(false);
  isStationsOpen = signal(false);

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

  toggleSidebar() {
    this.isSidebarOpen.set(!this.isSidebarOpen());
  }

  closeSidebar() {
    this.isSidebarOpen.set(false);
  }

  toggleSuppliers(event: Event) {
    event.stopPropagation();
    this.isSuppliersOpen.set(!this.isSuppliersOpen());
  }

  toggleStations(event: Event) {
    event.stopPropagation();
    this.isStationsOpen.set(!this.isStationsOpen());
  }

  onSidebarClick(event: Event) {
    const target = event.target as HTMLElement;
    if (target.closest('a')) {
      this.closeSidebar();
    }
  }
}
