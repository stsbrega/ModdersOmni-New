import { Component, inject } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { HeaderComponent } from './shared/components/header/header.component';
import { NotificationToastComponent } from './shared/components/notification-toast/notification-toast.component';
import { filter, map } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    HeaderComponent,
    NotificationToastComponent,
  ],
  template: `
    <a href="#main-content" class="skip-to-main">Skip to main content</a>
    @if (showHeader()) {
      <app-header />
    }
    <main id="main-content" [style.min-height]="showHeader() ? 'calc(100vh - 64px)' : '100vh'">
      <router-outlet />
    </main>
    <app-notification-toast />
  `,
  styles: [`
    main {
      min-height: 100vh;
    }
  `],
})
export class AppComponent {
  private router = inject(Router);

  showHeader = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects !== '/'),
    ),
    { initialValue: true },
  );
}
