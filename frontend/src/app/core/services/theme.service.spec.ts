import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let svc: ThemeService;

  beforeEach(() => {
    document.body.classList.remove('theme-skyrim', 'theme-fallout');
    TestBed.configureTestingModule({});
    svc = TestBed.inject(ThemeService);
  });

  afterEach(() => document.body.classList.remove('theme-skyrim', 'theme-fallout'));

  it('setTheme adds the body class and updates the signal', () => {
    svc.setTheme('skyrim');
    expect(document.body.classList.contains('theme-skyrim')).toBeTrue();
    expect(svc.currentTheme()).toBe('skyrim');
  });

  it('switching themes removes the previous class', () => {
    svc.setTheme('skyrim');
    svc.setTheme('fallout');
    expect(document.body.classList.contains('theme-skyrim')).toBeFalse();
    expect(document.body.classList.contains('theme-fallout')).toBeTrue();
  });

  it('none clears all theme classes', () => {
    svc.setTheme('fallout');
    svc.setTheme('none');
    expect(document.body.classList.contains('theme-fallout')).toBeFalse();
    expect(svc.currentTheme()).toBe('none');
  });

  it('setThemeFromSlug maps slugs to themes', () => {
    svc.setThemeFromSlug('skyrimspecialedition');
    expect(svc.currentTheme()).toBe('skyrim');
    svc.setThemeFromSlug('fallout4');
    expect(svc.currentTheme()).toBe('fallout');
    svc.setThemeFromSlug('other');
    expect(svc.currentTheme()).toBe('none');
  });
});
