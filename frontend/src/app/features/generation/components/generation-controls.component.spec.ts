import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GenerationControlsComponent } from './generation-controls.component';

describe('GenerationControlsComponent', () => {
  let fixture: ComponentFixture<GenerationControlsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [GenerationControlsComponent] }).compileComponents();
    fixture = TestBed.createComponent(GenerationControlsComponent);
    fixture.componentRef.setInput('status', 'running');
    fixture.detectChanges();
  });

  it('shows Pause when running, Resume when paused', () => {
    fixture.componentRef.setInput('status', 'running');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Pause');

    fixture.componentRef.setInput('status', 'paused');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Resume');
  });

  it('emits paused when Pause clicked while running', () => {
    let emitted = false;
    fixture.componentInstance.paused.subscribe(() => (emitted = true));
    fixture.componentRef.setInput('status', 'running');
    fixture.detectChanges();
    const pauseBtn = fixture.nativeElement.querySelector('[data-action="pause"]');
    pauseBtn.click();
    expect(emitted).toBe(true);
  });

  it('emits resumed when Resume clicked while paused', () => {
    let emitted = false;
    fixture.componentInstance.resumed.subscribe(() => (emitted = true));
    fixture.componentRef.setInput('status', 'paused');
    fixture.detectChanges();
    const resumeBtn = fixture.nativeElement.querySelector('[data-action="resume"]');
    resumeBtn.click();
    expect(emitted).toBe(true);
  });

  it('emits cancelled when Cancel clicked', () => {
    let emitted = false;
    fixture.componentInstance.cancelled.subscribe(() => (emitted = true));
    const cancelBtn = fixture.nativeElement.querySelector('[data-action="cancel"]');
    cancelBtn.click();
    expect(emitted).toBe(true);
  });

  it('emits downloadLog when download clicked', () => {
    let emitted = false;
    fixture.componentInstance.downloadLog.subscribe(() => (emitted = true));
    const dlBtn = fixture.nativeElement.querySelector('[data-action="download-log"]');
    dlBtn.click();
    expect(emitted).toBe(true);
  });

  it('hides pause/resume when status is complete or error', () => {
    fixture.componentRef.setInput('status', 'complete');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-action="pause"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-action="resume"]')).toBeNull();
  });
});
