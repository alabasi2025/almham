import { Routes } from '@angular/router';
import { authGuard, guestGuard, adminGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'change-password',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/change-password/change-password.component').then(
        (m) => m.ChangePasswordComponent,
      ),
  },

  {
    path: '',
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent,
          ),
      },
      {
        path: 'stations',
        loadComponent: () =>
          import('./pages/stations/stations.component').then(
            (m) => m.StationsComponent,
          ),
      },
      {
        path: 'stations/generators',
        loadComponent: () =>
          import('./pages/stations/generators/generators.component').then(
            (m) => m.GeneratorsComponent,
          ),
      },
      {
        path: 'stations/network',
        loadComponent: () =>
          import('./pages/stations/network/network.component').then(
            (m) => m.NetworkComponent,
          ),
      },
      {
        path: 'employees',
        loadComponent: () =>
          import('./pages/employees/employees.component').then(
            (m) => m.EmployeesComponent,
          ),
      },
      {
        path: 'employees/attendance',
        loadComponent: () =>
          import('./pages/employees/attendance/attendance.component').then(
            (m) => m.AttendanceComponent,
          ),
      },
      {
        path: 'tasks',
        loadComponent: () =>
          import('./pages/tasks/tasks.component').then((m) => m.TasksComponent),
      },
      {
        path: 'fuel',
        loadComponent: () =>
          import('./pages/fuel/fuel.component').then((m) => m.FuelComponent),
      },
      {
        path: 'maps',
        loadComponent: () =>
          import('./pages/maps/maps.component').then((m) => m.MapsComponent),
      },
      {
        path: 'suppliers',
        redirectTo: 'suppliers/fuel',
        pathMatch: 'full',
      },
      {
        path: 'suppliers/fuel',
        loadComponent: () =>
          import('./pages/suppliers/fuel-suppliers/fuel-suppliers.component').then(
            (m) => m.FuelSuppliersComponent,
          ),
      },
      {
        path: 'treasury',
        loadComponent: () =>
          import('./pages/treasury/treasury.component').then((m) => m.TreasuryComponent),
      },
      {
        path: 'treasury/billing',
        loadComponent: () =>
          import('./pages/treasury/treasury.component').then((m) => m.TreasuryComponent),
      },
      {
        path: 'treasury/collections',
        loadComponent: () =>
          import('./pages/treasury/collections/collections.component').then(
            (m) => m.CollectionsComponent,
          ),
      },
      {
        path: 'treasury/expenses',
        loadComponent: () =>
          import('./pages/treasury/expenses/expenses.component').then((m) => m.ExpensesComponent),
      },
      {
        path: 'billing',
        redirectTo: 'treasury/billing',
        pathMatch: 'full',
      },
      {
        path: 'users',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./pages/users/users.component').then((m) => m.UsersComponent),
      },
    ],
  },

  { path: '**', redirectTo: 'dashboard' },
];
