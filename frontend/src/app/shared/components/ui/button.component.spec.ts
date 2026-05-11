// frontend/src/app/shared/components/ui/button.component.spec.ts
//
// Smoke specs for UiButtonComponent. This is the pattern test for the whole
// primitive layer — if these pass, the host-binding + Tailwind-token approach
// is wired correctly and the rest of the wrappers can rely on the same shape.

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UiButtonComponent } from './button.component';

describe('UiButtonComponent', () => {
  let fixture: ComponentFixture<UiButtonComponent>;
  let component: UiButtonComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UiButtonComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(UiButtonComponent);
    component = fixture.componentInstance;
  });

  it('defaults to variant=primary, size=md, type=button', () => {
    fixture.detectChanges();
    expect(component.variant).toBe('primary');
    expect(component.size).toBe('md');
    expect(component.type).toBe('button');
  });

  it('applies primary marker class when variant=primary', () => {
    component.variant = 'primary';
    fixture.detectChanges();
    const cls = (fixture.nativeElement as HTMLElement).className;
    expect(cls).toContain('btn-primary');
  });

  it('applies destructive marker class when variant=destructive', () => {
    component.variant = 'destructive';
    fixture.detectChanges();
    const cls = (fixture.nativeElement as HTMLElement).className;
    expect(cls).toContain('btn-destructive');
  });

  it('reflects size to marker class (sm→btn-sm, lg→btn-lg)', () => {
    component.size = 'sm';
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).className).toContain('btn-sm');

    component.size = 'lg';
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).className).toContain('btn-lg');
  });
});
