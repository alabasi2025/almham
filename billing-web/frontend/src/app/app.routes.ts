import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/billing-home/billing-home.component').then((m) => m.BillingHomeComponent),
  },
  { path: '**', redirectTo: '' },
];
