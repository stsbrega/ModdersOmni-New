import { Routes } from '@angular/router';
import { LandingComponent } from './features/landing/landing.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { SetupComponent } from './features/setup/setup.component';
import { ModlistComponent } from './features/modlist/modlist.component';
import { ModlistGuideComponent } from './features/modlist/modlist-guide.component';
import { SettingsComponent } from './features/settings/settings.component';
import { GenerationComponent } from './features/generation/generation.component';
import { LoginComponent } from './features/auth/login/login.component';
import { RegisterComponent } from './features/auth/register/register.component';
import { AuthCallbackComponent } from './features/auth/callback/auth-callback.component';
import { VerifyEmailComponent } from './features/auth/verify-email/verify-email.component';
import { ForgotPasswordComponent } from './features/auth/forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './features/auth/reset-password/reset-password.component';
import { SupportComponent } from './features/support/support.component';
import { CompatibilityComponent } from './features/compatibility/compatibility.component';
import { MethodologyComponent } from './features/methodology/methodology.component';
import { authGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', component: LandingComponent },

  // Auth routes (guest-only)
  { path: 'auth/login', component: LoginComponent, canActivate: [guestGuard] },
  { path: 'auth/register', component: RegisterComponent, canActivate: [guestGuard] },
  { path: 'auth/callback', component: AuthCallbackComponent },
  { path: 'auth/verify-email', component: VerifyEmailComponent },
  { path: 'auth/forgot-password', component: ForgotPasswordComponent, canActivate: [guestGuard] },
  { path: 'auth/reset-password', component: ResetPasswordComponent },

  // Public app routes
  { path: 'setup', component: SetupComponent },
  { path: 'support', component: SupportComponent },

  // Auth-required routes
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'settings', component: SettingsComponent, canActivate: [authGuard] },
  { path: 'generate/:id', component: GenerationComponent, canActivate: [authGuard] },

  // Public routes
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
