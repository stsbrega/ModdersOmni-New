import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { PreloadAllModules, provideRouter, withPreloading } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';

import { routes } from './app.routes';

// HttpClient is still required — even after Plan 3 Task 4 deleted the
// last `/api/*` consumers, the in-browser pipeline uses HttpClient to
// talk to Nexus's GraphQL endpoint and to fetch /data/*.json static
// assets. The auth + error interceptors are gone with the backend they
// served, so this is the leanest possible providerHttpClient call.
export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    // Lazy routes download in the background after first render.
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideHttpClient(),
    provideAnimations(),
  ],
};
