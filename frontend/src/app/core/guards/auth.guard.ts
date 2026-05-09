import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take } from 'rxjs';
import { AuthService } from '../services/auth.service';

function checkAuth(authService: AuthService, router: Router, returnUrl: string): boolean {
  if (authService.isLoggedIn()) return true;
  router.navigate(['/auth/login'], { queryParams: { returnUrl } });
  return false;
}

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // If auth has already resolved (common on navigation after first load), check synchronously.
  if (authService.initialized()) {
    return checkAuth(authService, router, state.url);
  }

  // First page load: wait for initial profile fetch to settle before deciding.
  return toObservable(authService.initialized).pipe(
    filter(Boolean),
    take(1),
    map(() => checkAuth(authService, router, state.url)),
  );
};

export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.initialized()) {
    if (!authService.isLoggedIn()) return true;
    router.navigate(['/dashboard']);
    return false;
  }

  return toObservable(authService.initialized).pipe(
    filter(Boolean),
    take(1),
    map(() => {
      if (!authService.isLoggedIn()) return true;
      router.navigate(['/dashboard']);
      return false;
    }),
  );
};
