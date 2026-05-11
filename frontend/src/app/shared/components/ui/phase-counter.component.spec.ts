import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UiPhaseCounterComponent } from './phase-counter.component';

describe('UiPhaseCounterComponent', () => {
  let fixture: ComponentFixture<UiPhaseCounterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UiPhaseCounterComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(UiPhaseCounterComponent);
  });

  it('formats current/total with zero-padded two-digit numbers', () => {
    fixture.componentRef.setInput('current', 3);
    fixture.componentRef.setInput('total', 13);
    fixture.detectChanges();
    const label = fixture.nativeElement.querySelector('.phase-counter__label');
    expect(label.textContent.trim()).toBe('PHASE 03/13');
  });

  it('sets the progress bar fill to (current/total) * 100%', () => {
    fixture.componentRef.setInput('current', 4);
    fixture.componentRef.setInput('total', 10);
    fixture.detectChanges();
    const fill = fixture.nativeElement.querySelector('.phase-counter__fill');
    expect(fill.style.width).toBe('40%');
  });

  it('clamps total=0 to 0%', () => {
    fixture.componentRef.setInput('current', 0);
    fixture.componentRef.setInput('total', 0);
    fixture.detectChanges();
    const fill = fixture.nativeElement.querySelector('.phase-counter__fill');
    expect(fill.style.width).toBe('0%');
  });
});
