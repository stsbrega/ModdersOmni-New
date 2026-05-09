import { Injectable, signal } from '@angular/core';

export type GameTheme = 'skyrim' | 'fallout' | 'none';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  currentTheme = signal<GameTheme>('none');

  setTheme(theme: GameTheme): void {
    const body = document.body;
    body.classList.remove('theme-skyrim', 'theme-fallout');
    if (theme !== 'none') {
      body.classList.add(`theme-${theme}`);
    }
    this.currentTheme.set(theme);
  }

  setThemeFromSlug(gameSlug: string): void {
    if (gameSlug.includes('skyrim')) {
      this.setTheme('skyrim');
    } else if (gameSlug.includes('fallout')) {
      this.setTheme('fallout');
    } else {
      this.setTheme('none');
    }
  }
}
