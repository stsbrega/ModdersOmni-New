import { Component, EventEmitter, OnInit, Output, signal } from '@angular/core';
import { ApiService } from '../../../../core/services/api.service';
import { Game } from '../../../../shared/models/game.model';
import { trigger, transition, style, animate, query, stagger } from '@angular/animations';

@Component({
  selector: 'app-game-select',
  standalone: true,
  animations: [
    trigger('staggerCards', [
      transition(':enter', [
        query('.game-card', [
          style({ opacity: 0, transform: 'translateY(16px)' }),
          stagger(120, [
            animate('400ms cubic-bezier(0.16, 1, 0.3, 1)', style({ opacity: 1, transform: 'translateY(0)' })),
          ]),
        ], { optional: true }),
      ]),
    ]),
  ],
  template: `
    <div class="game-select">
      <h2>Choose Your Game</h2>
      <p class="step-desc">Select the game you want to build a modlist for.</p>

      <div class="games-grid" @staggerCards>
        @for (game of games(); track game.id) {
          <button
            class="game-card"
            [class.skyrim]="game.slug === 'skyrim-se' || game.slug === 'skyrim-ae'"
            [class.fallout]="game.slug === 'fallout-4'"
            (click)="selectGame(game.id)"
          >
            <div class="game-icon" [class.icon-skyrim]="game.slug === 'skyrim-se' || game.slug === 'skyrim-ae'" [class.icon-fallout]="game.slug === 'fallout-4'">
              {{ game.name.charAt(0) }}
            </div>
            <h3>{{ game.name }}</h3>
            <svg class="game-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
        }
        @if (games().length === 0) {
          <button class="game-card skyrim" (click)="selectGame(1)">
            <div class="game-icon icon-skyrim">S</div>
            <h3>Skyrim Special Edition</h3>
            <svg class="game-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
          <button class="game-card fallout" (click)="selectGame(2)">
            <div class="game-icon icon-fallout">F</div>
            <h3>Fallout 4</h3>
            <svg class="game-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
        }
      </div>
    </div>
  `,
  styles: [`
    .game-select {
      text-align: center;
    }
    h2 {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 0.375rem;
    }
    .step-desc {
      font-size: 0.875rem;
      color: var(--color-text-muted);
      margin-bottom: 2rem;
    }
    .games-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 0.75rem;
      max-width: 440px;
      margin: 0 auto;
    }
    .game-card {
      display: flex;
      align-items: center;
      gap: 1rem;
      background: var(--color-bg-card);
      border: 1px solid var(--color-border);
      border-radius: 12px;
      padding: 1.25rem 1.5rem;
      cursor: pointer;
      color: var(--color-text);
      font-family: inherit;
      transition: border-color 0.2s, transform 0.15s, background 0.15s;
    }
    .game-card:hover {
      transform: translateY(-2px);
    }
    .game-card.skyrim:hover {
      border-color: var(--color-blue);
      background: rgba(123, 164, 192, 0.04);
    }
    .game-card.fallout:hover {
      border-color: var(--color-gold);
      background: rgba(192, 160, 96, 0.04);
    }
    .game-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
      font-weight: 700;
      font-family: var(--font-display);
      flex-shrink: 0;
      transition: all 0.2s;
    }
    .icon-skyrim {
      background: rgba(123, 164, 192, 0.12);
      color: var(--color-blue);
      border: 1px solid rgba(123, 164, 192, 0.2);
    }
    .icon-fallout {
      background: rgba(192, 160, 96, 0.12);
      color: var(--color-gold);
      border: 1px solid rgba(192, 160, 96, 0.2);
    }
    .game-card h3 {
      flex: 1;
      font-size: 1.0625rem;
      font-weight: 600;
      margin: 0;
      text-align: left;
    }
    .game-arrow {
      color: var(--color-text-dim);
      transition: color 0.15s, transform 0.15s;
      flex-shrink: 0;
    }
    .game-card:hover .game-arrow {
      transform: translateX(3px);
    }
    .game-card.skyrim:hover .game-arrow { color: var(--color-blue); }
    .game-card.fallout:hover .game-arrow { color: var(--color-gold); }
  `],
})
export class GameSelectComponent implements OnInit {
  @Output() gameSelected = new EventEmitter<number>();

  games = signal<Game[]>([]);

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.api.getGames().subscribe({
      next: (games) => this.games.set(games),
      error: () => {},
    });
  }

  selectGame(gameId: number): void {
    this.gameSelected.emit(gameId);
  }
}
