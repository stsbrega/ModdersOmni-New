import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let svc: ThemeService;

  beforeEach(() => {
    document.body.classList.remove('theme-skyrim', 'theme-fallout');
    TestBed.configureTestingModule({});
    svc = TestBed.inject(ThemeService);
  });

  afterEach(() => {
    document.body.classList.remove('theme-skyrim', 'theme-fallout');
  });

  it('defaults to none', () => {
    expect(svc.currentTheme()).toBe('none');
  });

  it('setTheme swaps the body class and signal', () => {
    svc.setTheme('skyrim');
    expect(document.body.classList.contains('theme-skyrim')).toBeTrue();
    svc.setTheme('fallout');
    expect(document.body.classList.contains('theme-skyrim')).toBeFalse();
    expect(document.body.classList.contains('theme-fallout')).toBeTrue();
    expect(svc.currentTheme()).toBe('fallout');
  });

  it('setTheme(none) clears theme classes', () => {
    svc.setTheme('skyrim');
    svc.setTheme('none');
    expect(document.body.classList.contains('theme-skyrim')).toBeFalse();
    expect(svc.currentTheme()).toBe('none');
  });

  it('setThemeFromSlug maps slugs to themes', () => {
    svc.setThemeFromSlug('skyrimspecialedition');
    expect(svc.currentTheme()).toBe('skyrim');
    svc.setThemeFromSlug('fallout4');
    expect(svc.currentTheme()).toBe('fallout');
    svc.setThemeFromSlug('witcher3');
    expect(svc.currentTheme()).toBe('none');
  });
});
