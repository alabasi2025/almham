import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoading()) {
    await auth.loadCurrentUser();
  }
  if (auth.isAuthenticated()) {
    return true;
  }
  router.navigate(['/login']);
  return false;
};

export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoading()) {
    await auth.loadCurrentUser();
  }
  if (!auth.isAuthenticated()) {
    return true;
  }
  router.navigate(['/dashboard']);
  return false;
};

export const adminGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoading()) {
    await auth.loadCurrentUser();
  }
  if (auth.isAuthenticated() && auth.canManageUsers()) {
    return true;
  }
  router.navigate(['/dashboard']);
  return false;
};
