import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoading()) {
    await auth.loadCurrentUser();
  }
  if (auth.isAuthenticated()) {
    const user = auth.user();
    if (user?.mustChangePassword && state.url !== '/change-password') {
      router.navigate(['/change-password']);
      return false;
    }
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
  router.navigate([auth.user()?.mustChangePassword ? '/change-password' : '/dashboard']);
  return false;
};

export const adminGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoading()) {
    await auth.loadCurrentUser();
  }
  if (auth.isAuthenticated() && auth.user()?.mustChangePassword && state.url !== '/change-password') {
    router.navigate(['/change-password']);
    return false;
  }
  if (auth.isAuthenticated() && auth.canManageUsers()) {
    return true;
  }
  router.navigate(['/dashboard']);
  return false;
};
