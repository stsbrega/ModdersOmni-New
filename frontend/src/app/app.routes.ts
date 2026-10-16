import { Routes } from '@angular/router';
import { LandingComponent } from './features/landing/landing.component';

// The landing page ships in the initial bundle because it's the first thing
// most visitors see. Every other page is lazy-loaded into its own chunk, and
// app.config.ts preloads those chunks in the background once the app is
// idle, so in-app navigation stays instant.
export const routes: Routes = [
  { path: '', component: LandingComponent },

  // All routes are public — no auth concept after Plan 3 Task 3.
  {
    path: 'setup',
    loadComponent: () =>
      import('./features/setup/setup.component').then((m) => m.SetupComponent),
  },
  {
    path: 'support',
    loadComponent: () =>
      import('./features/support/support.component').then((m) => m.SupportComponent),
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./features/settings/settings.component').then((m) => m.SettingsComponent),
  },
  {
    path: 'generate/:id',
    loadComponent: () =>
      import('./features/generation/generation.component').then((m) => m.GenerationComponent),
  },
  {
    path: 'modlist/:id',
    loadComponent: () =>
      import('./features/modlist/modlist.component').then((m) => m.ModlistComponent),
  },
  {
    path: 'modlist/:id/guide',
    loadComponent: () =>
      import('./features/modlist/modlist-guide.component').then((m) => m.ModlistGuideComponent),
  },
  {
    path: 'compatibility',
    loadComponent: () =>
      import('./features/compatibility/compatibility.component').then(
        (m) => m.CompatibilityComponent,
      ),
  },
  {
    path: 'methodology',
    loadComponent: () =>
      import('./features/methodology/methodology.component').then((m) => m.MethodologyComponent),
  },

  // Redirect old pricing/credits routes to support
  { path: 'pricing', redirectTo: 'support', pathMatch: 'full' },
  { path: 'credits', redirectTo: 'support', pathMatch: 'full' },

  {
    path: '**',
    loadComponent: () =>
      import('./shared/components/not-found/not-found.component').then(
        (m) => m.NotFoundComponent,
      ),
  },
];
