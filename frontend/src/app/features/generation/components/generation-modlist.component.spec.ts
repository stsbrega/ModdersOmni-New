import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GenerationModlistComponent } from './generation-modlist.component';

describe('GenerationModlistComponent', () => {
  let fixture: ComponentFixture<GenerationModlistComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [GenerationModlistComponent] }).compileComponents();
    fixture = TestBed.createComponent(GenerationModlistComponent);
  });

  it('renders one card per mod', () => {
    fixture.componentRef.setInput('mods', [
      { mod_id: 1, name: 'USSEP', file_size: 12_000_000 },
      { mod_id: 2, name: 'SkyUI', file_size: 4_500_000 },
    ]);
    fixture.detectChanges();
    const cards = fixture.nativeElement.querySelectorAll('.gen-modlist__card');
    expect(cards.length).toBe(2);
  });

  it('renders empty state when mods is empty', () => {
    fixture.componentRef.setInput('mods', []);
    fixture.detectChanges();
    const cards = fixture.nativeElement.querySelectorAll('.gen-modlist__card');
    expect(cards.length).toBe(0);
    expect(fixture.nativeElement.textContent.toLowerCase()).toContain('no mods');
  });

  it('shows the mod name and a formatted file size', () => {
    fixture.componentRef.setInput('mods', [
      { mod_id: 1, name: 'A Quality World Map', file_size: 1_572_864 }, // 1.5 MB
    ]);
    fixture.detectChanges();
    const card = fixture.nativeElement.querySelector('.gen-modlist__card');
    expect(card.textContent).toContain('A Quality World Map');
    expect(card.textContent).toMatch(/1\.5\s*MB/i);
  });
});
