import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GenerationHeaderComponent } from './generation-header.component';

describe('GenerationHeaderComponent', () => {
  let fixture: ComponentFixture<GenerationHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [GenerationHeaderComponent] }).compileComponents();
    fixture = TestBed.createComponent(GenerationHeaderComponent);
  });

  it('renders the game label', () => {
    fixture.componentRef.setInput('game', 'skyrim');
    fixture.componentRef.setInput('provider', 'anthropic');
    fixture.componentRef.setInput('currentPhase', 3);
    fixture.componentRef.setInput('totalPhases', 13);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent.toLowerCase()).toContain('skyrim');
  });

  it('renders the phase counter with current and total values', () => {
    fixture.componentRef.setInput('game', 'fallout4');
    fixture.componentRef.setInput('provider', 'openai');
    fixture.componentRef.setInput('currentPhase', 5);
    fixture.componentRef.setInput('totalPhases', 10);
    fixture.detectChanges();
    const label = fixture.nativeElement.querySelector('.phase-counter__label');
    expect(label.textContent).toContain('PHASE 05/10');
  });

  it('renders provider as a mono badge', () => {
    fixture.componentRef.setInput('game', 'skyrim');
    fixture.componentRef.setInput('provider', 'groq');
    fixture.componentRef.setInput('currentPhase', 1);
    fixture.componentRef.setInput('totalPhases', 13);
    fixture.detectChanges();
    const badge = fixture.nativeElement.querySelector('ui-badge, .ui-badge, [class*="badge"]');
    expect(badge?.textContent).toContain('groq');
  });
});
