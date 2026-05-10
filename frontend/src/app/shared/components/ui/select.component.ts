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
} from '@angular/core';
import {
  Overlay,
  OverlayRef,
  OverlayPositionBuilder,
} from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { ActiveDescendantKeyManager, FocusableOption } from '@angular/cdk/a11y';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

export interface UiSelectOption<T = unknown> {
  value: T;
  label: string;
  disabled?: boolean;
}

/**
 * Internal item directive-ish wrapper. We need a class that implements
 * `FocusableOption` so ActiveDescendantKeyManager can drive its activation
 * state. Each rendered <li> registers one of these.
 */
class SelectOptionRef implements FocusableOption {
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
}

@Component({
  selector: 'ui-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
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
      class="inline-flex h-10 w-full items-center justify-between gap-2 rounded-md
             border border-border bg-surface-1 px-3 py-2 text-base text-text
             transition-colors focus-visible:outline-none focus-visible:ring-2
             focus-visible:ring-accent focus-visible:border-accent
             disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <span [class.text-text-muted]="!selectedOption">
        {{ selectedOption?.label || placeholder }}
      </span>
      <span class="ml-2 opacity-70" aria-hidden="true">▾</span>
    </button>

    <ng-template #panel>
      <ul
        [id]="listboxId"
        role="listbox"
        class="min-w-[12rem] max-h-72 overflow-y-auto rounded-md border
               border-border bg-surface-1 py-1 shadow-lg text-text"
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
            class="cursor-pointer px-3 py-2 text-sm transition-colors
                   hover:bg-surface-2 aria-selected:bg-accent aria-selected:text-bg
                   aria-disabled:opacity-50 aria-disabled:pointer-events-none"
            [class.bg-surface-2]="i === keyManager?.activeItemIndex"
          >
            {{ option.label }}
          </li>
        }
      </ul>
    </ng-template>
  `,
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
