import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

export interface MobileNavLink {
  label: string;
  path: string;
  icon?: string;
}

@Component({
  selector: 'app-mobile-nav-drawer',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="drawer-backdrop"
      [class.open]="open"
      (click)="closed.emit()"
      aria-hidden="true"
    ></div>
    <aside
      class="drawer"
      [class.open]="open"
      role="dialog"
      aria-modal="true"
      aria-label="Main navigation"
      [attr.inert]="open ? null : ''"
    >
      <div class="drawer-head">
        <span class="drawer-title">Menu</span>
        <button type="button" class="drawer-close" aria-label="Close menu" (click)="closed.emit()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <nav>
        @for (link of links; track link.path) {
          <a
            [routerLink]="link.path"
            routerLinkActive="active"
            (click)="closed.emit()"
            class="drawer-link"
          >
            {{ link.label }}
          </a>
        }
      </nav>
    </aside>
  `,
  styles: [`
    :host { display: contents; }

    .drawer-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      opacity: 0;
      pointer-events: none;
      transition: opacity 180ms ease;
      z-index: 90;
    }
    .drawer-backdrop.open {
      opacity: 1;
      pointer-events: auto;
    }

    .drawer {
      position: fixed;
      top: 0;
      right: 0;
      width: min(320px, 85vw);
      height: 100dvh;
      background: var(--color-surface-1);
      border-left: 1px solid var(--color-border);
      box-shadow: -8px 0 24px rgba(0, 0, 0, 0.4);
      transform: translateX(100%);
      transition: transform 220ms ease;
      z-index: 100;
      padding: 0.75rem 1rem 2rem;
    }
    .drawer-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 48px;
      padding-left: 1rem;
      margin-bottom: 1rem;
    }
    .drawer-title {
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--color-text-muted);
    }
    .drawer-close {
      width: 44px;
      height: 44px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 0.5rem;
      background: transparent;
      color: var(--color-text-muted);
    }
    .drawer-close:hover { color: var(--color-text); background: var(--color-surface-2); }
    .drawer.open {
      transform: translateX(0);
    }

    .drawer nav {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .drawer-link {
      display: block;
      padding: 0.9rem 1rem;
      border-radius: 0.5rem;
      color: var(--color-text, #eceef1);
      text-decoration: none;
      font-weight: 500;
      transition: background-color 120ms ease;
    }
    .drawer-link:hover {
      background: rgba(255, 255, 255, 0.05);
    }
    /* accent-soft is a solid mid-gold, so gold text on it was unreadable. */
    .drawer-link.active {
      background: color-mix(in oklch, var(--color-accent) 14%, transparent);
      color: var(--color-accent);
      box-shadow: inset 2px 0 0 var(--color-accent);
    }
  `],
})
export class MobileNavDrawerComponent {
  @Input() open = false;
  @Input() links: MobileNavLink[] = [];
  @Output() closed = new EventEmitter<void>();

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open) this.closed.emit();
  }
}
