import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { NotificationService } from '../services/notification.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notifications = inject(NotificationService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Skip 401 errors — the auth interceptor handles token refresh
      if (error.status === 401) {
        return throwError(() => error);
      }

      let message = 'An unexpected error occurred';

      if (error.status === 0) {
        message = 'Unable to connect to server. The service may be starting up — try again in 30 seconds.';
      } else if (error.status === 404) {
        message = 'Resource not found';
      } else if (error.status === 422) {
        message = error.error?.detail || 'Invalid request data';
      } else if (error.error?.detail) {
        message = error.error.detail;
      } else if (error.status >= 500) {
        message = `Server error (${error.status}). Please try again.`;
      }

      notifications.error(message);
      return throwError(() => error);
    })
  );
};
