import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;

  beforeEach(() => {
    document.body.classList.remove('theme-skyrim', 'theme-fallout');
    TestBed.configureTestingModule({});
    service = TestBed.inject(ThemeService);
  });

  afterEach(() => document.body.classList.remove('theme-skyrim', 'theme-fallout'));

  it('applies the body class and updates the signal', () => {
    service.setTheme('skyrim');
    expect(document.body.classList.contains('theme-skyrim')).toBeTrue();
    expect(service.currentTheme()).toBe('skyrim');
  });

  it('swaps themes without leaving the previous class behind', () => {
    service.setTheme('skyrim');
    service.setTheme('fallout');
    expect(document.body.classList.contains('theme-skyrim')).toBeFalse();
    expect(document.body.classList.contains('theme-fallout')).toBeTrue();
  });

  it('"none" clears theme classes', () => {
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
    service.setThemeFromSlug('stardew');
    expect(service.currentTheme()).toBe('none');
  });
});
