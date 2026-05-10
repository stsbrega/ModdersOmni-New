// frontend/src/app/shared/components/ui/index.ts
//
// Barrel export for the shared UI primitive layer. Features import these
// wrappers via `import { UiButtonComponent, UiCardComponent } from
// '../../shared/components/ui';` — they should not import @angular/cdk
// directly. Anything that's missing here is missing on purpose; add it via
// a new wrapper component, not by re-exporting CDK.

export { UiButtonComponent } from './button.component';
export { UiCardComponent } from './card.component';
export { UiDialogComponent } from './dialog.component';
export { UiSheetComponent, type SheetSide } from './sheet.component';
export { UiInputComponent } from './input.component';
export { UiTextareaComponent } from './textarea.component';
export {
  UiSelectComponent,
  type UiSelectOption,
} from './select.component';
export { UiBadgeComponent } from './badge.component';
export { UiSeparatorComponent } from './separator.component';
export { UiLabelComponent } from './label.component';
