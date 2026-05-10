import { Routes } from '@angular/router';
import { LandingComponent } from './features/landing/landing.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { SetupComponent } from './features/setup/setup.component';
import { ModlistComponent } from './features/modlist/modlist.component';
import { ModlistGuideComponent } from './features/modlist/modlist-guide.component';
import { SettingsComponent } from './features/settings/settings.component';
import { GenerationComponent } from './features/generation/generation.component';
import { SupportComponent } from './features/support/support.component';
import { CompatibilityComponent } from './features/compatibility/compatibility.component';
import { MethodologyComponent } from './features/methodology/methodology.component';

export const routes: Routes = [
  { path: '', component: LandingComponent },

  // All routes are public — no auth concept after Plan 3 Task 3.
  { path: 'setup', component: SetupComponent },
  { path: 'support', component: SupportComponent },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'settings', component: SettingsComponent },
  { path: 'generate/:id', component: GenerationComponent },
  { path: 'modlist/:id', component: ModlistComponent },
  { path: 'modlist/:id/guide', component: ModlistGuideComponent },
  { path: 'compatibility', component: CompatibilityComponent },
  { path: 'methodology', component: MethodologyComponent },

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
