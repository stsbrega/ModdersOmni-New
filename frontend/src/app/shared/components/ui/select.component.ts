// frontend/src/app/shared/components/ui/select.component.ts
//
// UiSelectComponent — styled dropdown built on CDK Overlay + ListKeyManager.
//
// Why not native <select>? Because native styling is OS-specific and we want
// the dropdown menu to match our token system. CDK gives us the heavy
// lifting:
//   - Overlay (portal-rendered menu, positioned next to the trigger)
//   - ListKeyManager (Up/Down arrow nav, Enter/Space to select, Home/End jumps)
//   - FocusTrap (managed via overlay panel)
//
// Options are passed as a typed array of { value, label } pairs. Selection
// emits via (selectionChange).
//
// Accessibility note: this is a button + listbox pattern (combobox is
// noticeably more involved). The trigger has role=combobox + aria-expanded
// + aria-controls; the list has role=listbox; each option has role=option +
// aria-selected.

import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  inject,
  Input,
  OnDestroy,
  Output,
  QueryList,
  TemplateRef,
  ViewChild,
  ViewChildren,
  ViewContainerRef,
  ViewEncapsulation,
} from '@angular/core';
import {
  Overlay,
  OverlayRef,
  OverlayPositionBuilder,
} from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import {
  ActiveDescendantKeyManager,
  FocusableOption,
  Highlightable,
} from '@angular/cdk/a11y';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

export interface UiSelectOption<T = unknown> {
  value: T;
  label: string;
  disabled?: boolean;
}

/**
 * Internal item directive-ish wrapper. ActiveDescendantKeyManager requires
 * `Highlightable` (which extends `FocusableOption`), so we must provide
 * `setActiveStyles()` / `setInactiveStyles()` in addition to `focus()` and
 * `disabled`.
 *
 * The two style methods are intentional no-ops: the active visual state is
 * driven by a `[class.ui-select__option--active]="i === keyManager?.activeItemIndex"`
 * binding on the <li> in the template. That binding stays reactive whether
 * the active item changes via mouse, keyboard, or typeahead, and it keeps
 * the styling story declarative (CSS token classes in the template) instead
 * of imperative DOM mutations here.
 */
class SelectOptionRef implements Highlightable, FocusableOption {
  constructor(
    public readonly option: UiSelectOption,
    public readonly element: HTMLElement,
  ) {}
  focus(): void {
    this.element.focus();
  }
  getLabel(): string {
    return this.option.label;
  }
  get disabled(): boolean {
    return !!this.option.disabled;
  }
  // Highlightable members — see class JSDoc for why these are no-ops.
  setActiveStyles(): void {
    /* visual state is bound in the template via activeItemIndex */
  }
  setInactiveStyles(): void {
    /* visual state is bound in the template via activeItemIndex */
  }
}

@Component({
  selector: 'ui-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // ViewEncapsulation.None is required because the dropdown panel is
  // rendered into a CDK overlay container (outside this component's host
  // element). Emulated encapsulation would scope the _ngcontent attribute
  // only to elements inside the host, leaving the overlay panel unstyled.
  // All class names use the `ui-select__` BEM namespace to avoid collisions.
  encapsulation: ViewEncapsulation.None,
  template: `
    <button
      #trigger
      type="button"
      role="combobox"
      [attr.aria-expanded]="isOpen"
      [attr.aria-controls]="listboxId"
      [attr.aria-haspopup]="'listbox'"
      [disabled]="disabled"
      (click)="toggle()"
      (keydown.arrowDown)="open(); $event.preventDefault()"
      (keydown.enter)="toggle(); $event.preventDefault()"
      class="ui-select__trigger"
      [class.ui-select__trigger--disabled]="disabled"
    >
      <span class="ui-select__value" [class.ui-select__value--placeholder]="!selectedOption">
        {{ selectedOption?.label || placeholder }}
      </span>
      <span class="ui-select__chevron" aria-hidden="true">▾</span>
    </button>

    <ng-template #panel>
      <ul
        [id]="listboxId"
        role="listbox"
        class="ui-select__panel"
      >
        @for (option of options; track option.value; let i = $index) {
          <li
            #optionEl
            role="option"
            [attr.aria-selected]="option.value === value"
            [attr.aria-disabled]="option.disabled || null"
            [id]="listboxId + '-opt-' + i"
            (click)="select(option)"
            (mouseenter)="setActive(i)"
            class="ui-select__option"
            [class.ui-select__option--active]="i === keyManager?.activeItemIndex"
            [class.ui-select__option--selected]="option.value === value"
            [class.ui-select__option--disabled]="option.disabled"
          >
            {{ option.label }}
          </li>
        }
      </ul>
    </ng-template>
  `,
  styles: [`
    /* ── Host element layout ── */
    ui-select {
      display: block;
      width: 100%;
    }

    /* ── Trigger button — matches UiInput: surface-1, border, radius-md, 0.5rem 0.75rem ── */
    .ui-select__trigger {
      display: inline-flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      width: 100%;
      background: var(--color-surface-1);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: 0.5rem 0.75rem;
      font-size: 0.9375rem;
      font-family: inherit;
      color: var(--color-text);
      cursor: pointer;
      outline: none;
      transition: border-color 0.15s;
    }

    .ui-select__trigger:focus-visible {
      border-color: var(--color-accent);
    }

    .ui-select__trigger--disabled,
    .ui-select__trigger:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* ── Value / placeholder text ── */
    .ui-select__value--placeholder {
      color: var(--color-text-dim);
    }

    /* ── Chevron icon ── */
    .ui-select__chevron {
      opacity: 0.7;
      flex-shrink: 0;
    }

    /* ── Dropdown panel (CDK overlay — outside host, global scope applies) ── */
    .ui-select__panel {
      min-width: 12rem;
      max-height: 18rem;
      overflow-y: auto;
      background: var(--color-surface-2);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: 0.25rem 0;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
      color: var(--color-text);
    }

    /* ── Dropdown items ── */
    .ui-select__option {
      display: block;
      padding: 0.5rem 0.75rem;
      font-size: 0.875rem;
      cursor: pointer;
      transition: background 0.1s;
      list-style: none;
    }

    .ui-select__option:hover,
    .ui-select__option--active {
      background: var(--color-surface-1);
    }

    .ui-select__option--selected {
      color: var(--color-accent);
    }

    .ui-select__option--disabled {
      opacity: 0.5;
      cursor: not-allowed;
      pointer-events: none;
    }
  `],
})
export class UiSelectComponent
  implements AfterViewInit, OnDestroy
{
  @Input() options: UiSelectOption[] = [];
  @Input() value: unknown = null;
  @Input() placeholder = 'Select…';
  @Input() disabled = false;

  @Output() selectionChange = new EventEmitter<unknown>();

  @ViewChild('panel') panelTemplate!: TemplateRef<unknown>;
  @ViewChild('trigger') triggerEl!: ElementRef<HTMLButtonElement>;
  @ViewChildren('optionEl') optionEls!: QueryList<ElementRef<HTMLElement>>;

  /** Stable id used to associate trigger ↔ listbox via aria-controls. */
  readonly listboxId = `ui-select-${Math.random().toString(36).slice(2, 9)}`;

  isOpen = false;
  keyManager: ActiveDescendantKeyManager<SelectOptionRef> | null = null;

  private readonly overlay = inject(Overlay);
  private readonly overlayPositionBuilder = inject(OverlayPositionBuilder);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private overlayRef: OverlayRef | null = null;
  private readonly destroy$ = new Subject<void>();

  get selectedOption(): UiSelectOption | undefined {
    return this.options.find((o) => o.value === this.value);
  }

  ngAfterViewInit(): void {
    // Key manager is rebuilt every open() so it sees the freshly rendered <li>
    // elements. Nothing to do at init beyond having ViewChild refs available.
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.close();
  }

  toggle(): void {
    if (this.disabled) return;
    this.isOpen ? this.close() : this.open();
  }

  open(): void {
    if (this.isOpen || this.disabled) return;

    const positionStrategy = this.overlayPositionBuilder
      .flexibleConnectedTo(this.triggerEl)
      .withPositions([
        {
          originX: 'start',
          originY: 'bottom',
          overlayX: 'start',
          overlayY: 'top',
          offsetY: 4,
        },
        {
          // Fallback: flip up if there's no room below.
          originX: 'start',
          originY: 'top',
          overlayX: 'start',
          overlayY: 'bottom',
          offsetY: -4,
        },
      ]);

    this.overlayRef = this.overlay.create({
      positionStrategy,
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-transparent-backdrop',
    });

    const portal = new TemplatePortal(
      this.panelTemplate,
      this.viewContainerRef,
    );
    this.overlayRef.attach(portal);

    // Wait one tick so the @for renders the <li> children before we wire up
    // the key manager.
    setTimeout(() => this.initKeyManager(), 0);

    this.overlayRef
      .backdropClick()
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.close());

    this.isOpen = true;
  }

  close(): void {
    if (this.overlayRef) {
      this.overlayRef.dispose();
      this.overlayRef = null;
    }
    this.keyManager = null;
    this.isOpen = false;
  }

  select(option: UiSelectOption): void {
    if (option.disabled) return;
    this.value = option.value;
    this.selectionChange.emit(option.value);
    this.close();
    this.triggerEl?.nativeElement.focus();
  }

  setActive(index: number): void {
    this.keyManager?.setActiveItem(index);
  }

  /** Build the key manager once the overlay has rendered its option <li>s. */
  private initKeyManager(): void {
    const refs = this.optionEls.map(
      (el, i) => new SelectOptionRef(this.options[i], el.nativeElement),
    );
    this.keyManager = new ActiveDescendantKeyManager(refs)
      .withWrap()
      .withTypeAhead();

    // Move active to currently-selected option, if any, so first arrow press
    // doesn't jump to top.
    const selectedIdx = this.options.findIndex((o) => o.value === this.value);
    if (selectedIdx >= 0) this.keyManager.setActiveItem(selectedIdx);
  }

  /**
   * When the panel is open, route keyboard events from the trigger to the
   * key manager. Trigger keeps focus so screen readers track context via
   * aria-activedescendant.
   */
  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.isOpen || !this.keyManager) return;
    if (event.key === 'Escape') {
      this.close();
      event.preventDefault();
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      const idx = this.keyManager.activeItemIndex;
      if (idx != null && idx >= 0) {
        this.select(this.options[idx]);
        event.preventDefault();
      }
      return;
    }
    this.keyManager.onKeydown(event);
  }
}
