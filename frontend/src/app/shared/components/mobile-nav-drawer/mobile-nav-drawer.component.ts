import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
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
    >
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
      background: var(--color-surface-elevated, #15161a);
      box-shadow: -8px 0 24px rgba(0, 0, 0, 0.4);
      transform: translateX(100%);
      transition: transform 220ms ease;
      z-index: 100;
      padding: 4rem 1.5rem 2rem;
    }
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
    .drawer-link.active {
      background: var(--color-accent-soft, rgba(255, 184, 0, 0.12));
      color: var(--color-accent, #ffb800);
    }
  `],
})
export class MobileNavDrawerComponent {
  @Input() open = false;
  @Input() links: MobileNavLink[] = [];
  @Output() closed = new EventEmitter<void>();
}
