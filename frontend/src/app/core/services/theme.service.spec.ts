import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;

  beforeEach(() => {
    document.body.classList.remove('theme-skyrim', 'theme-fallout');
    TestBed.configureTestingModule({});
    service = TestBed.inject(ThemeService);
  });

  afterEach(() => {
    document.body.classList.remove('theme-skyrim', 'theme-fallout');
  });

  it('applies a theme class and updates the signal', () => {
    service.setTheme('skyrim');
    expect(document.body.classList.contains('theme-skyrim')).toBeTrue();
    expect(service.currentTheme()).toBe('skyrim');
  });

  it('switching themes removes the previous class', () => {
    service.setTheme('skyrim');
    service.setTheme('fallout');
    expect(document.body.classList.contains('theme-skyrim')).toBeFalse();
    expect(document.body.classList.contains('theme-fallout')).toBeTrue();
  });

  it("'none' clears all theme classes", () => {
    service.setTheme('fallout');
    service.setTheme('none');
    expect(document.body.classList.contains('theme-fallout')).toBeFalse();
    expect(service.currentTheme()).toBe('none');
  });

  it('maps game slugs to themes', () => {
    service.setThemeFromSlug('skyrimse');
    expect(service.currentTheme()).toBe('skyrim');
    service.setThemeFromSlug('fallout4');
    expect(service.currentTheme()).toBe('fallout');
    service.setThemeFromSlug('other');
    expect(service.currentTheme()).toBe('none');
  });
});
