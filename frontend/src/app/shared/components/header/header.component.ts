import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { BrandMarkComponent } from '../brand-mark/brand-mark.component';
import {
  MobileNavDrawerComponent,
  MobileNavLink,
} from '../mobile-nav-drawer/mobile-nav-drawer.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    BrandMarkComponent,
    MobileNavDrawerComponent,
  ],
  template: `
    <header class="header">
      <div class="header-content">
        <a routerLink="/" class="logo">
          <app-brand-mark></app-brand-mark>
        </a>
        <nav class="nav">
          <a routerLink="/dashboard" routerLinkActive="active" class="nav-link">Dashboard</a>
          <a routerLink="/setup" routerLinkActive="active" class="nav-link">New Build</a>
          <a routerLink="/support" routerLinkActive="active" class="nav-link">Support</a>
          <a routerLink="/compatibility" routerLinkActive="active" class="nav-link">Compatibility</a>
          <a routerLink="/settings" routerLinkActive="active" class="nav-link">Settings</a>
        </nav>
        <button
          type="button"
          class="mobile-nav-toggle"
          aria-label="Open menu"
          [attr.aria-expanded]="mobileNavOpen()"
          (click)="toggleMobileNav()"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
      </div>
    </header>

    <app-mobile-nav-drawer
      [open]="mobileNavOpen()"
      [links]="mobileLinks"
      (closed)="mobileNavOpen.set(false)"
    />
  `,
  styles: [`
    .header {
      position: sticky;
      top: 0;
      z-index: 100;
      background: var(--color-bg);
      border-bottom: 1px solid var(--color-border);
      box-shadow: var(--shadow-sm);
      height: var(--header-height);
    }
    .header-content {
      max-width: var(--max-width);
      margin: 0 auto;
      padding: 0 2rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 100%;
    }
    .logo {
      display: flex;
      align-items: center;
      color: var(--color-text);
      transition: transform 0.2s var(--ease-out);
    }
    .logo:hover {
      transform: translateY(-1px);
    }
    .nav {
      display: flex;
      gap: 0.25rem;
    }
    .nav-link {
      color: var(--color-text-muted);
      font-size: 0.8125rem;
      font-weight: 500;
      padding: 0.375rem 0.75rem;
      border-radius: 6px;
      transition: color 0.15s, background 0.15s;
    }
    .nav-link:hover {
      color: var(--color-text);
      background: rgba(255, 255, 255, 0.05);
    }
    .nav-link.active {
      color: var(--color-accent);
      background: color-mix(in oklch, var(--color-accent) 10%, transparent);
    }

    /* Mobile hamburger (hidden on desktop, shown under 768px) */
    .mobile-nav-toggle {
      display: none;
      background: transparent;
      border: none;
      color: var(--color-text);
      padding: 0.4rem;
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }
    .mobile-nav-toggle:hover {
      background: rgba(255, 255, 255, 0.06);
      color: var(--color-accent);
    }

    @media (max-width: 768px) {
      .nav { display: none; }
      .mobile-nav-toggle {
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .header-content { padding: 0 1rem; }
    }
  `],
})
export class HeaderComponent {
  mobileNavOpen = signal(false);

  readonly mobileLinks: MobileNavLink[] = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'New Build', path: '/setup' },
    { label: 'Support', path: '/support' },
    { label: 'Compatibility', path: '/compatibility' },
    { label: 'Settings', path: '/settings' },
  ];

  toggleMobileNav(): void {
    this.mobileNavOpen.update((v) => !v);
  }
}
