import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const credentialsInterceptor: HttpInterceptorFn = (req, next) => {
  const authReq = req.url.startsWith('/api')
    ? req.clone({ withCredentials: true })
    : req;

  const router = inject(Router);
  const auth = inject(AuthService);

  return next(authReq).pipe(
    catchError((err) => {
      const isAuthEndpoint =
        req.url.includes('/auth/login') ||
        req.url.includes('/auth/logout') ||
        req.url.includes('/auth/me');
      if (err?.status === 401 && !isAuthEndpoint) {
        router.navigate(['/login']);
      }
      return throwError(() => err);
    }),
  );
};
