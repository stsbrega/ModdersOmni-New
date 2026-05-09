import { Component, EventEmitter, Input, OnInit, Output, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';
import { AuthService } from '../../../../core/services/auth.service';
import { GenerationService } from '../../../../core/services/generation.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { Playstyle } from '../../../../shared/models/game.model';
import { HardwareSpecs } from '../../../../shared/models/specs.model';
import { LlmProvider } from '../../../../shared/models/mod.model';
import { PRESETS, SizePreset } from '../../../../shared/models/generation.model';
import { detectProvider } from '../../../../core/utils/key-detection';
import { ApiKeyGuideComponent } from '../../../../shared/components/api-key-guide/api-key-guide.component';
import { LucideAngularModule, LucideIconProvider, LUCIDE_ICONS, Sparkles, Tent, Swords, Wand2, Camera, Drama, Hammer, Building2 } from 'lucide-angular';
import { trigger, transition, style, animate, query, stagger } from '@angular/animations';

@Component({
  selector: 'app-playstyle-select',
  standalone: true,
  imports: [FormsModule, ApiKeyGuideComponent, LucideAngularModule],
  providers: [
    { provide: LUCIDE_ICONS, useValue: new LucideIconProvider({ Sparkles, Tent, Swords, Wand2, Camera, Drama, Hammer, Building2 }), multi: true },
  ],
  animations: [
    trigger('staggerCards', [
      transition(':enter', [
        query('.playstyle-card', [
          style({ opacity: 0, transform: 'translateY(12px)' }),
          stagger(60, [
            animate('350ms cubic-bezier(0.16, 1, 0.3, 1)', style({ opacity: 1, transform: 'translateY(0)' })),
          ]),
        ], { optional: true }),
      ]),
    ]),
  ],
  template: `
    <div class="playstyle-select">
      <h2>Customize Your Modlist</h2>
      <p class="step-desc">
        Pick a preset, describe your vision, or request specific mods. The AI will build a personalized modlist around your preferences.
      </p>

      <!-- Quick Presets -->
      <div class="section-label">Quick Presets <span class="optional-tag">optional</span></div>
      <div class="playstyles-grid" @staggerCards>
        @for (ps of playstyles(); track ps.id) {
          <button
            class="playstyle-card"
            [class.selected]="selectedId() === ps.id"
            (click)="togglePreset(ps)"
          >
            <div class="ps-icon">
              <lucide-icon [name]="ps.icon || 'sparkles'" [size]="16" [strokeWidth]="1.75"></lucide-icon>
            </div>
            <div class="ps-content">
              <h3>{{ ps.name }}</h3>
            </div>
            @if (selectedId() === ps.id) {
              <div class="ps-check">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
            }
          </button>
        }
        @if (playstyles().length === 0) {
          <div class="loading-state">
            <span class="load-spinner"></span>
            Loading presets...
          </div>
        }
      </div>

      <!-- Modlist Size -->
      <div class="section-label">Modlist Size <span class="optional-tag">pick one</span></div>
      <div class="size-preset-grid">
        @for (p of presets; track p.id) {
          <button
            type="button"
            class="size-card"
            [class.selected]="selectedPreset() === p.id"
            [class.locked]="p.requiresByok && !hasByokKey()"
            (click)="selectPreset(p.id)"
          >
            <strong>{{ p.label }}</strong>
            <small>~{{ p.targetMods }} mods</small>
            <p>{{ p.blurb }}</p>
            @if (p.requiresByok && !hasByokKey()) {
              <em class="byok-lock">Requires your own LLM API key</em>
            }
          </button>
        }
      </div>

      <!-- Describe Your Vision -->
      <div class="section-label">
        Describe Your Vision
        <span class="optional-tag">optional</span>
      </div>
      <div class="description-section">
        <textarea
          class="vision-textarea"
          [value]="customDescription()"
          (input)="customDescription.set($any($event.target).value)"
          placeholder="e.g. I want a dark souls-like combat system with survival mechanics, beautiful graphics, and immersive NPC interactions..."
          rows="3"
          maxlength="1000"
        ></textarea>
        <div class="char-count">{{ customDescription().length }} / 1000</div>
      </div>

      <!-- Specific Mods -->
      <div class="section-label">
        Must-Have Mods
        <span class="optional-tag">optional</span>
      </div>
      <div class="requested-mods-section">
        <p class="section-hint">Name specific mods you want included. The AI will find them on Nexus and add patches.</p>
        <div class="mod-input-row">
          <div class="key-input-wrap">
            <input
              type="text"
              [value]="modInput()"
              (input)="modInput.set($any($event.target).value)"
              (keydown.enter)="addRequestedMod()"
              placeholder="Type a mod name and press Enter..."
              autocomplete="off"
              spellcheck="false"
            />
          </div>
          <button class="btn-add-key" (click)="addRequestedMod()" [disabled]="!modInput().trim()">
            Add
          </button>
        </div>
        @if (requestedMods().length > 0) {
          <div class="mod-tags">
            @for (mod of requestedMods(); track mod) {
              <div class="mod-tag">
                <span>{{ mod }}</span>
                <button class="tag-remove" (click)="removeRequestedMod(mod)">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            }
          </div>
        }
      </div>

      @if (!hasAnyPreference()) {
        <div class="preference-hint">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          Select a preset, describe your vision, or add mods to continue.
        </div>
      }

      <div class="ai-provider-section" [class.pending-highlight]="pendingGenerate()">
        <div class="provider-header" (click)="providerExpanded.set(!providerExpanded())">
          <div class="provider-label">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M12 2a4 4 0 0 1 4 4v1a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4zM18 14h.01M6 14h.01M15 18s-1 2-3 2-3-2-3-2"/>
              <rect x="3" y="11" width="18" height="10" rx="2"/>
            </svg>
            AI Providers
          </div>
          @if (isLoggedIn()) {
            <div class="provider-badge" [class.configured]="configuredCount() > 0">
              {{ configuredCount() }} configured
            </div>
          } @else {
            <div class="provider-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              Account required
            </div>
          }
          <svg class="chevron" [class.expanded]="providerExpanded()" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </div>

        @if (providerExpanded()) {
          <div class="provider-body">
            @if (!isLoggedIn()) {
              <div class="locked-message">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <p>Create an account to save optional AI provider keys and generate your modlist.</p>
              </div>
            } @else {
              @if (pendingGenerate()) {
                <p class="pending-prompt">
                  Add an API key if you want to use your own provider account or extra fallbacks.
                </p>
              } @else {
                <p class="provider-desc">
                  Optional: paste an API key to use your own provider account. If you skip this,
                  ModdersOmni uses the hosted models available on your plan.
                </p>
              }

              <div class="key-security-notice">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <span>Keys are stored securely and never shared. You can remove them anytime.</span>
              </div>

              <app-api-key-guide [providers]="providers()" />

              <!-- Add Key Input -->
              <form class="add-key-row" (ngSubmit)="addNewKey()">
                <div class="key-input-wrap">
                  <input
                    type="password"
                    [value]="newKeyInput()"
                    (input)="newKeyInput.set($any($event.target).value)"
                    (paste)="onNewKeyPaste($event)"
                    placeholder="Paste any AI provider API key..."
                    autocomplete="new-password"
                    spellcheck="false"
                  />
                </div>
                <button type="submit" class="btn-add-key" [disabled]="!newKeyInput()">
                  Add
                </button>
              </form>

              <!-- Detection feedback -->
              @if (detectionState()) {
                <div class="detection-feedback" [class.warn]="detectionState()!.type !== 'exact'">
                  @if (detectionState()!.type === 'exact') {
                    <div class="detection-exact">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      Detected: <strong>{{ detectionState()!.providerName }}</strong>
                    </div>
                  } @else if (detectionState()!.type === 'ambiguous') {
                    <div class="detection-warn-msg">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                      <span>Multiple providers match. Select one:</span>
                    </div>
                    <select class="detect-select" (change)="confirmDetectedProvider($any($event.target).value)">
                      <option value="" disabled selected>Select...</option>
                      @for (m of detectionState()!.matches; track m.id) {
                        <option [value]="m.id">{{ m.name }}</option>
                      }
                    </select>
                  } @else {
                    <div class="detection-warn-msg">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                      <span>Unknown key format. Select provider:</span>
                    </div>
                    <select class="detect-select" (change)="confirmDetectedProvider($any($event.target).value)">
                      <option value="" disabled selected>Select...</option>
                      @for (p of providers(); track p.id) {
                        <option [value]="p.id">{{ p.name }}</option>
                      }
                    </select>
                  }
                </div>
              }

              <!-- Saved Keys -->
              @if (savedKeyEntries().length > 0) {
                <div class="saved-keys-list">
                  @for (entry of savedKeyEntries(); track entry.providerId) {
                    <div class="saved-key-chip">
                      <span class="chip-provider">{{ entry.providerName }}</span>
                      <span class="chip-mask">{{ entry.masked }}</span>
                      <button class="chip-remove" (click)="removeKey(entry.providerId)" title="Remove">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                  }
                </div>
              }

              <!-- Ollama (Local Model) -->
              <div class="ollama-section" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.08);">
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                  <span style="font-size: 0.85rem; font-weight: 500; color: var(--text-secondary);">Or use a local model</span>
                </div>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                  <input
                    type="text"
                    [value]="ollamaUrl()"
                    (input)="ollamaUrl.set($any($event.target).value)"
                    placeholder="http://localhost:11434/v1"
                    style="flex: 1; padding: 0.5rem 0.75rem; border-radius: 8px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: var(--text-primary); font-size: 0.85rem;"
                  />
                  <button
                    (click)="testOllamaConnection()"
                    style="padding: 0.5rem 0.75rem; border-radius: 8px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: var(--text-primary); font-size: 0.8rem; cursor: pointer; white-space: nowrap;"
                  >
                    Test
                  </button>
                </div>
                @if (ollamaStatus() === 'connected') {
                  <div style="display: flex; align-items: center; gap: 0.4rem; margin-top: 0.4rem; font-size: 0.8rem; color: #4ade80;">
                    <span style="width: 6px; height: 6px; border-radius: 50%; background: #4ade80; display: inline-block;"></span>
                    Connected — {{ ollamaModels().length }} model(s)
                  </div>
                  @if (ollamaModels().length > 0) {
                    <select
                      style="margin-top: 0.5rem; width: 100%; padding: 0.4rem 0.6rem; border-radius: 8px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: var(--text-primary); font-size: 0.85rem;"
                      [value]="ollamaSelectedModel()"
                      (change)="ollamaSelectedModel.set($any($event.target).value)"
                    >
                      @for (m of ollamaModels(); track m) {
                        <option [value]="m">{{ m }}</option>
                      }
                    </select>
                  }
                }
                @if (ollamaStatus() === 'error') {
                  <div style="margin-top: 0.4rem; font-size: 0.8rem; color: #f87171;">{{ ollamaError() }}</div>
                }
              </div>

              @if (providers().length === 0) {
                <div class="loading-state">
                  <span class="load-spinner"></span>
                  Loading providers...
                </div>
              }
            }
          </div>
        }
      </div>

      <div class="actions">
        <button class="btn-back" (click)="back.emit()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back
        </button>
        <button
          class="btn-primary"
          (click)="generate()"
          [disabled]="!hasAnyPreference() || loading()"
        >
          @if (loading()) {
            <span class="btn-spinner"></span>
            Generating...
          } @else {
            Generate Modlist
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          }
        </button>
      </div>
    </div>
  `,
  styles: [`
    .playstyle-select {
      max-width: 640px;
      margin: 0 auto;
    }
    h2 {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 0.375rem;
      text-align: center;
    }
    .step-desc {
      font-size: 0.875rem;
      color: var(--color-text-muted);
      text-align: center;
      margin-bottom: 2rem;
      line-height: 1.5;
    }
    .section-label {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--color-text-muted);
      margin-bottom: 0.625rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .optional-tag {
      font-size: 0.6875rem;
      font-weight: 500;
      color: var(--color-text-dim);
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--color-border);
      border-radius: 100px;
      padding: 0.1rem 0.5rem;
    }
    .playstyles-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 0.5rem;
      margin-bottom: 1.5rem;
    }
    .playstyle-card {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: var(--color-bg-card);
      border: 1px solid var(--color-border);
      border-radius: 8px;
      padding: 0.625rem 0.75rem;
      text-align: left;
      cursor: pointer;
      color: var(--color-text);
      font-family: inherit;
      transition: border-color 0.15s, background 0.15s, transform 0.15s;
      position: relative;
    }
    .playstyle-card:hover {
      border-color: var(--color-border-hover);
      transform: translateY(-1px);
    }
    .playstyle-card.selected {
      border-color: var(--color-gold);
      background: rgba(192, 160, 96, 0.05);
    }
    .ps-icon {
      width: 28px;
      height: 28px;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--color-border);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-text-muted);
      flex-shrink: 0;
    }
    .ps-icon lucide-icon { display: inline-flex; }
    .playstyle-card.selected .ps-icon {
      background: rgba(192, 160, 96, 0.12);
      border-color: rgba(192, 160, 96, 0.3);
      color: var(--color-gold);
    }
    .ps-content {
      flex: 1;
      min-width: 0;
    }
    .ps-content h3 {
      font-size: 0.8125rem;
      font-weight: 600;
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .ps-check {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: var(--color-gold);
      color: #0D0D0F;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    /* Size preset cards */
    .size-preset-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 0.625rem;
      margin-bottom: 1.5rem;
    }
    .size-card {
      background: var(--color-bg-card);
      border: 1px solid var(--color-border);
      border-radius: 8px;
      padding: 0.75rem 0.875rem;
      text-align: left;
      cursor: pointer;
      color: var(--color-text);
      font-family: inherit;
      transition: border-color 0.15s, background 0.15s, transform 0.15s;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .size-card:hover { border-color: var(--color-border-hover); transform: translateY(-1px); }
    .size-card.selected {
      border-color: var(--color-gold);
      background: rgba(192, 160, 96, 0.05);
    }
    .size-card.locked {
      opacity: 0.62;
      cursor: not-allowed;
    }
    .size-card strong { font-size: 0.9rem; font-weight: 600; }
    .size-card small { font-size: 0.75rem; color: var(--color-text-muted); }
    .size-card p { margin: 0.25rem 0 0; font-size: 0.78rem; color: var(--color-text-muted); line-height: 1.3; }
    .byok-lock {
      margin-top: 0.35rem;
      font-size: 0.72rem;
      color: var(--color-gold);
      font-style: normal;
    }

    /* Description textarea */
    .description-section {
      margin-bottom: 1.5rem;
    }
    .vision-textarea {
      width: 100%;
      background: var(--color-bg-card);
      border: 1px solid var(--color-border);
      border-radius: 8px;
      color: var(--color-text);
      font-family: inherit;
      font-size: 0.8125rem;
      padding: 0.75rem;
      resize: vertical;
      min-height: 72px;
      outline: none;
      transition: border-color 0.15s;
      line-height: 1.5;
    }
    .vision-textarea:focus {
      border-color: var(--color-gold);
    }
    .vision-textarea::placeholder {
      color: var(--color-text-dim);
    }
    .char-count {
      text-align: right;
      font-size: 0.6875rem;
      color: var(--color-text-dim);
      margin-top: 0.25rem;
    }

    /* Requested mods */
    .requested-mods-section {
      margin-bottom: 1.5rem;
    }
    .section-hint {
      font-size: 0.75rem;
      color: var(--color-text-dim);
      margin: 0 0 0.5rem;
      line-height: 1.4;
    }
    .mod-input-row {
      display: flex;
      gap: 0.375rem;
    }
    .mod-input-row .key-input-wrap { flex: 1; }
    .mod-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.375rem;
      margin-top: 0.5rem;
    }
    .mod-tag {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.25rem 0.375rem 0.25rem 0.625rem;
      background: rgba(192, 160, 96, 0.08);
      border: 1px solid rgba(192, 160, 96, 0.2);
      border-radius: 100px;
      font-size: 0.75rem;
      color: var(--color-text);
      font-weight: 500;
    }
    .tag-remove {
      background: none;
      border: none;
      color: var(--color-text-dim);
      padding: 0.125rem;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      transition: color 0.15s, background 0.15s;
    }
    .tag-remove:hover {
      color: #ef4444;
      background: rgba(239, 68, 68, 0.1);
    }

    /* Preference hint */
    .preference-hint {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.625rem 0.875rem;
      background: rgba(234, 179, 8, 0.06);
      border: 1px solid rgba(234, 179, 8, 0.15);
      border-radius: 8px;
      font-size: 0.8125rem;
      color: var(--color-warning, #eab308);
      margin-bottom: 1.5rem;
      line-height: 1.4;
    }
    .preference-hint svg {
      flex-shrink: 0;
    }
    .loading-state {
      grid-column: 1 / -1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 2rem;
      color: var(--color-text-muted);
      font-size: 0.875rem;
    }
    .load-spinner {
      width: 16px;
      height: 16px;
      border: 2px solid var(--color-border);
      border-top-color: var(--color-gold);
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }

    /* Actions */
    .actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }
    .btn-back {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      background: none;
      border: none;
      color: var(--color-text-muted);
      font-size: 0.8125rem;
      font-weight: 500;
      padding: 0.5rem 0;
      cursor: pointer;
      transition: color 0.15s;
    }
    .btn-back:hover { color: var(--color-text); }
    .btn-primary {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: var(--color-gold);
      color: #0D0D0F;
      padding: 0.625rem 1.5rem;
      border-radius: 8px;
      font-weight: 600;
      border: none;
      cursor: pointer;
      font-size: 0.875rem;
      transition: background 0.2s, box-shadow 0.3s;
    }
    .btn-primary:hover {
      background: var(--color-gold-hover);
      box-shadow: 0 0 20px var(--color-gold-glow);
    }
    .btn-primary:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      box-shadow: none;
    }
    .btn-spinner {
      width: 14px;
      height: 14px;
      border: 2px solid rgba(13, 13, 15, 0.3);
      border-top-color: #0D0D0F;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* AI Provider Section */
    .ai-provider-section {
      background: var(--color-bg-card);
      border: 1px solid var(--color-border);
      border-radius: 10px;
      margin-bottom: 1.5rem;
      overflow: hidden;
      transition: border-color 0.3s;
    }
    .ai-provider-section.pending-highlight {
      border-color: var(--color-gold);
    }
    .provider-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.875rem 1.125rem;
      cursor: pointer;
      transition: background 0.15s;
    }
    .provider-header:hover { background: rgba(255,255,255,0.02); }
    .provider-label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--color-text);
    }
    .provider-badge {
      margin-left: auto;
      font-size: 0.75rem;
      padding: 0.2rem 0.625rem;
      border-radius: 100px;
      background: rgba(255,255,255,0.04);
      color: var(--color-text-muted);
      border: 1px solid var(--color-border);
    }
    .provider-badge.configured {
      background: rgba(192, 160, 96, 0.1);
      color: var(--color-gold);
      border-color: rgba(192, 160, 96, 0.25);
    }
    .chevron {
      color: var(--color-text-muted);
      transition: transform 0.2s;
      flex-shrink: 0;
    }
    .chevron.expanded { transform: rotate(180deg); }
    .provider-body {
      padding: 0 1.125rem 1.125rem;
    }
    .provider-desc {
      font-size: 0.8125rem;
      color: var(--color-text-muted);
      line-height: 1.5;
      margin: 0 0 1rem;
    }
    .pending-prompt {
      font-size: 0.8125rem;
      color: var(--color-gold);
      line-height: 1.5;
      margin: 0 0 1rem;
      font-weight: 500;
    }
    .locked-message {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--color-border);
      border-radius: 8px;
      color: var(--color-text-muted);
    }
    .locked-message svg {
      flex-shrink: 0;
      color: var(--color-text-dim);
    }
    .locked-message p {
      font-size: 0.8125rem;
      line-height: 1.5;
      margin: 0;
    }

    /* Provider list (vertical rows) */
    .provider-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .provider-row {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
      padding: 0.75rem;
      background: rgba(255,255,255,0.015);
      border: 1px solid var(--color-border);
      border-radius: 8px;
      transition: border-color 0.15s;
    }
    .provider-row.has-key {
      border-color: rgba(192, 160, 96, 0.3);
    }
    .provider-info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .provider-status {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 1.5px solid var(--color-border);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      color: var(--color-text-dim);
    }
    .provider-row.has-key .provider-status {
      background: var(--color-gold);
      border-color: var(--color-gold);
      color: #0D0D0F;
    }
    .provider-name {
      font-size: 0.8125rem;
      font-weight: 600;
      margin-right: 0.5rem;
    }
    .provider-model {
      font-size: 0.6875rem;
      color: var(--color-text-muted);
    }
    .key-input-wrap {
      display: flex;
      align-items: center;
      background: var(--color-bg);
      border: 1px solid var(--color-border);
      border-radius: 6px;
      overflow: hidden;
      transition: border-color 0.15s;
    }
    .key-input-wrap:focus-within {
      border-color: var(--color-gold);
    }
    .key-input-wrap input {
      flex: 1;
      background: none;
      border: none;
      color: var(--color-text);
      font-size: 0.75rem;
      padding: 0.5rem 0.625rem;
      outline: none;
      font-family: monospace;
      min-width: 0;
    }
    .key-input-wrap input::placeholder {
      color: var(--color-text-dim);
      font-family: inherit;
    }
    .key-toggle {
      background: none;
      border: none;
      color: var(--color-text-muted);
      padding: 0.375rem 0.625rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      flex-shrink: 0;
    }
    .key-toggle:hover { color: var(--color-text); }
    .key-hint {
      font-size: 0.6875rem;
      color: var(--color-text-dim);
    }

    /* Security notice */
    .key-security-notice {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.375rem 0.625rem;
      background: rgba(192, 160, 96, 0.06);
      border: 1px solid rgba(192, 160, 96, 0.12);
      border-radius: 6px;
      margin-bottom: 0.625rem;
      font-size: 0.6875rem;
      color: var(--color-text-dim);
      line-height: 1.3;
    }
    .key-security-notice svg {
      flex-shrink: 0;
      color: var(--color-gold);
    }

    /* Add key row */
    .add-key-row {
      display: flex;
      gap: 0.375rem;
      margin-bottom: 0.375rem;
    }
    .add-key-row .key-input-wrap { flex: 1; }
    .btn-add-key {
      background: var(--color-gold);
      color: #0D0D0F;
      padding: 0.375rem 0.75rem;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 600;
      white-space: nowrap;
      transition: background 0.2s;
    }
    .btn-add-key:hover:not(:disabled) { background: var(--color-gold-hover); }
    .btn-add-key:disabled { opacity: 0.4; cursor: not-allowed; }

    /* Detection feedback */
    .detection-feedback {
      padding: 0.5rem 0.625rem;
      border-radius: 6px;
      margin-bottom: 0.5rem;
      font-size: 0.75rem;
      background: rgba(34, 197, 94, 0.08);
      border: 1px solid rgba(34, 197, 94, 0.2);
    }
    .detection-feedback.warn {
      background: rgba(234, 179, 8, 0.08);
      border: 1px solid rgba(234, 179, 8, 0.2);
    }
    .detection-exact {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      color: #22c55e;
      font-weight: 500;
    }
    .detection-exact strong { color: var(--color-text); }
    .detection-warn-msg {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      color: var(--color-warning);
      margin-bottom: 0.375rem;
    }
    .detection-warn-msg svg { flex-shrink: 0; }
    .detect-select {
      width: 100%;
      background: var(--color-bg);
      border: 1px solid var(--color-border);
      border-radius: 6px;
      color: var(--color-text);
      padding: 0.375rem 0.5rem;
      font-size: 0.75rem;
      outline: none;
      cursor: pointer;
    }
    .detect-select:focus { border-color: var(--color-gold); }

    /* Saved keys chips */
    .saved-keys-list {
      display: flex;
      flex-wrap: wrap;
      gap: 0.375rem;
      margin-top: 0.375rem;
    }
    .saved-key-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.25rem 0.375rem 0.25rem 0.625rem;
      background: var(--color-bg);
      border: 1px solid var(--color-border);
      border-radius: 100px;
      font-size: 0.6875rem;
    }
    .chip-provider {
      font-weight: 600;
      color: var(--color-text);
    }
    .chip-mask {
      color: var(--color-text-dim);
      font-family: monospace;
      font-size: 0.625rem;
    }
    .chip-remove {
      background: none;
      border: none;
      color: var(--color-text-dim);
      padding: 0.125rem;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      transition: color 0.15s, background 0.15s;
    }
    .chip-remove:hover {
      color: #ef4444;
      background: rgba(239, 68, 68, 0.1);
    }

  `],
})
export class PlaystyleSelectComponent implements OnInit {
  @Input() gameId!: number;
  @Input() specs!: HardwareSpecs;
  @Input() gameVersion: string | undefined;
  @Input() initialPlaystyleId?: number;
  @Input() initialDescription?: string;
  @Input() initialRequestedMods?: string[];
  @Output() back = new EventEmitter<void>();

  playstyles = signal<Playstyle[]>([]);
  selectedId = signal<number | null>(null);
  loading = signal(false);

  // Custom preferences state
  customDescription = signal('');
  requestedMods = signal<string[]>([]);
  modInput = signal('');

  hasAnyPreference = computed(() =>
    this.selectedId() !== null ||
    this.customDescription().trim().length > 0 ||
    this.requestedMods().length > 0
  );

  // AI Provider state
  providers = signal<LlmProvider[]>([]);
  providerExpanded = signal(true);
  providerKeys = signal<Record<string, string>>({});
  pendingGenerate = signal(false);

  // Ollama (local provider) state
  ollamaUrl = signal('http://localhost:11434/v1');
  ollamaStatus = signal<'unknown' | 'connected' | 'error'>('unknown');
  ollamaModels = signal<string[]>([]);
  ollamaSelectedModel = signal('gemma4:26b');
  ollamaError = signal('');

  // Dynamic key entry state
  newKeyInput = signal('');
  detectionState = signal<{
    type: 'exact' | 'ambiguous' | 'unknown';
    providerId?: string;
    providerName?: string;
    matches?: { id: string; name: string }[];
  } | null>(null);
  savedKeyEntries = computed(() => {
    const keys = this.providerKeys();
    const providers = this.providers();
    return Object.entries(keys)
      .filter(([, key]) => key.length > 0)
      .map(([providerId, key]) => {
        const provider = providers.find(p => p.id === providerId);
        const masked = key.length > 12
          ? key.substring(0, 6) + '...' + key.substring(key.length - 4)
          : '***';
        return { providerId, providerName: provider?.name || providerId, masked };
      });
  });

  configuredCount = computed(() =>
    Object.values(this.providerKeys()).filter(k => k.length > 0).length
  );

  // Modlist size preset (Task 24)
  readonly presets = PRESETS;
  selectedPreset = signal<SizePreset>('medium');
  hasByokKey = computed(() => this.configuredCount() > 0);

  selectPreset(id: SizePreset): void {
    const p = this.presets.find((x) => x.id === id);
    if (p?.requiresByok && !this.hasByokKey()) {
      this.notifications.error(
        'This size requires your own LLM API key. Add one in AI Providers below to unlock Large, Massive, or Ultimate.',
      );
      return;
    }
    this.selectedPreset.set(id);
  }

  constructor(
    private api: ApiService,
    private authService: AuthService,
    private generationService: GenerationService,
    private notifications: NotificationService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    // Restore custom preferences from wizard state
    if (this.initialDescription) {
      this.customDescription.set(this.initialDescription);
    }
    if (this.initialRequestedMods?.length) {
      this.requestedMods.set(this.initialRequestedMods);
    }

    this.api.getPlaystyles(this.gameId).subscribe({
      next: (playstyles) => {
        this.playstyles.set(playstyles);
        // Auto-select playstyle if restored from wizard state
        if (this.initialPlaystyleId && playstyles.some(ps => ps.id === this.initialPlaystyleId)) {
          this.selectedId.set(this.initialPlaystyleId);
        }
      },
      error: () => {},
    });

    // Load provider registry from API
    this.api.getLlmProviders().subscribe({
      next: (providers) => this.providers.set(providers),
      error: () => {},
    });

    // Only load keys if logged in — guests don't see the key inputs
    if (this.authService.isLoggedIn()) {
      this.api.getLlmKeys().subscribe({
        next: (keys) => {
          // Separate Ollama URL from regular API keys
          const regularKeys = { ...keys };
          if (regularKeys['ollama']) {
            this.ollamaUrl.set(regularKeys['ollama']);
            delete regularKeys['ollama'];
            if (regularKeys['ollama_model']) {
              this.ollamaSelectedModel.set(regularKeys['ollama_model']);
              delete regularKeys['ollama_model'];
            }
            this.testOllamaConnection();
          } else {
            delete regularKeys['ollama_model'];
          }
          this.providerKeys.set(regularKeys);
          if (Object.values(regularKeys).some(k => k?.length > 0)) {
            this.providerExpanded.set(false);
          }
        },
        error: () => {},
      });
    }
  }

  togglePreset(ps: Playstyle): void {
    if (this.selectedId() === ps.id) {
      // Deselect — also clear the description so Generate button disables correctly
      this.selectedId.set(null);
      this.customDescription.set('');
    } else {
      this.selectedId.set(ps.id);
      // Always replace description with preset template on selection
      if (ps.description) {
        this.customDescription.set(ps.description);
      }
    }
    this.pendingGenerate.set(false);
  }

  addRequestedMod(): void {
    const mod = this.modInput().trim();
    if (!mod) return;
    // Avoid duplicates (case-insensitive)
    const existing = this.requestedMods();
    if (existing.some(m => m.toLowerCase() === mod.toLowerCase())) {
      this.modInput.set('');
      return;
    }
    this.requestedMods.set([...existing, mod]);
    this.modInput.set('');
  }

  removeRequestedMod(mod: string): void {
    this.requestedMods.set(this.requestedMods().filter(m => m !== mod));
  }

  getKey(provider: string): string {
    return this.providerKeys()[provider] || '';
  }

  onNewKeyPaste(event: ClipboardEvent): void {
    const pasted = event.clipboardData?.getData('text')?.trim();
    if (!pasted) return;
    setTimeout(() => this.runKeyDetection(pasted), 0);
  }

  addNewKey(): void {
    const key = this.newKeyInput().trim();
    if (!key) return;
    const state = this.detectionState();
    if (state?.type === 'exact' && state.providerId) {
      this.saveAutoDetectedKey(state.providerId, key);
    } else if (!state) {
      this.runKeyDetection(key);
    }
  }

  confirmDetectedProvider(providerId: string): void {
    if (!providerId) return;
    const key = this.newKeyInput().trim();
    if (!key) return;
    this.saveAutoDetectedKey(providerId, key);
  }

  removeKey(providerId: string): void {
    const updated = { ...this.providerKeys() };
    delete updated[providerId];
    this.providerKeys.set(updated);
    if (this.authService.isLoggedIn()) {
      this.api.saveLlmKeys({ [providerId]: '' }).subscribe({ error: () => {} });
    }
  }

  testOllamaConnection(): void {
    this.ollamaStatus.set('unknown');
    this.api.testOllamaConnection(this.ollamaUrl()).subscribe({
      next: (res) => {
        if (res.connected) {
          this.ollamaStatus.set('connected');
          this.ollamaModels.set(res.models);
          this.ollamaError.set('');
          // Auto-select first available model if default isn't installed
          if (res.models.length > 0 && !res.models.includes(this.ollamaSelectedModel())) {
            this.ollamaSelectedModel.set(res.models[0]);
          }
          this.notifications.success('Connected to Ollama!');
        } else {
          this.ollamaStatus.set('error');
          this.ollamaError.set(res.error || 'Connection failed');
        }
      },
      error: () => {
        this.ollamaStatus.set('error');
        this.ollamaError.set('Could not reach the server');
      },
    });
  }

  private runKeyDetection(key: string): void {
    const result = detectProvider(key, this.providers());
    if (!result) {
      this.detectionState.set({ type: 'unknown' });
    } else if (result.confidence === 'exact') {
      this.detectionState.set({
        type: 'exact',
        providerId: result.providerId,
        providerName: result.providerName,
      });
    } else {
      this.detectionState.set({
        type: 'ambiguous',
        matches: result.matchedProviders,
      });
    }
  }

  private saveAutoDetectedKey(providerId: string, key: string): void {
    const updated = { ...this.providerKeys(), [providerId]: key };
    this.providerKeys.set(updated);

    if (this.authService.isLoggedIn()) {
      this.api.saveLlmKeys({ [providerId]: key }).subscribe({ error: () => {} });
    }

    // Reset input state
    this.newKeyInput.set('');
    this.detectionState.set(null);

    // Auto-resume generation if pending
    if (this.pendingGenerate() && this.configuredCount() > 0) {
      this.pendingGenerate.set(false);
      setTimeout(() => this.generate(), 100);
    }
  }

  isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }

  generate(): void {
    if (!this.hasAnyPreference()) return;

    // Auth check first — guests can't enter keys or generate
    if (!this.authService.isLoggedIn()) {
      this.saveWizardState();
      this.notifications.info('Create an account to generate your modlist');
      this.router.navigate(['/auth/register'], {
        queryParams: { returnUrl: '/setup' },
      });
      return;
    }

    const hasOllama = this.ollamaStatus() === 'connected';
    // Build credentials list from all configured providers
    const allKeys = this.providerKeys();
    const credentials: { provider: string; api_key: string; base_url?: string; model?: string }[] =
      Object.entries(allKeys)
        .filter(([, key]) => key.length > 0)
        .map(([provider, api_key]) => ({ provider, api_key }));

    // Include Ollama if connected
    if (hasOllama) {
      credentials.push({
        provider: 'ollama',
        api_key: '',
        base_url: this.ollamaUrl(),
        model: this.ollamaSelectedModel(),
      });
    }

    this.loading.set(true);

    // Persist wizard hardware specs to UserSettings before kicking off the
    // generation. Without this, a new user lands on Settings → Hardware with
    // empty fields after onboarding (audit finding A.2 / 2026-04-20).
    this.authService
      .saveHardware({
        gpu_model: this.specs.gpu,
        cpu_model: this.specs.cpu,
        vram_mb: this.specs.vram_mb,
        ram_gb: this.specs.ram_gb,
        cpu_cores: this.specs.cpu_cores,
        cpu_speed_ghz: this.specs.cpu_speed_ghz,
        storage_drives: this.specs.storage_drives,
      })
      .subscribe({
        next: () => {
          /* fire-and-forget */
        },
        error: (err) =>
          console.warn('Hardware persistence failed (non-fatal):', err),
      });

    const description = this.customDescription().trim() || undefined;
    const mods = this.requestedMods().length > 0 ? this.requestedMods() : undefined;

    // Fire-and-redirect: POST /start returns immediately with a generation_id.
    // We then navigate to the generation viewer which streams events via SSE.
    this.api
      .startGeneration({
        game_id: this.gameId,
        playstyle_id: this.selectedId() ?? undefined,
        gpu: this.specs.gpu,
        vram_mb: this.specs.vram_mb,
        cpu: this.specs.cpu,
        ram_gb: this.specs.ram_gb,
        cpu_cores: this.specs.cpu_cores,
        cpu_speed_ghz: this.specs.cpu_speed_ghz,
        game_version: this.gameVersion,
        available_storage_gb: this.getMaxFreeStorageGb(),
        custom_description: description,
        requested_mods: mods,
        llm_credentials: credentials,
        preset: this.selectedPreset(),
      })
      .subscribe({
        next: (response) => {
          this.loading.set(false);

          // Wizard is complete — clear the refresh-recovery snapshot so a
          // future "New Build" starts from step 1 (game selection) instead
          // of restoring the just-finished run's state.
          sessionStorage.removeItem('setup_wizard_progress');
          localStorage.removeItem('setup_wizard_state');

          // Reset any stale generation state and open the SSE connection
          this.generationService.reset();
          this.generationService.connectToEvents(response.generation_id);

          // Navigate to the real-time generation viewer
          this.router.navigate(['/generate', response.generation_id]);
        },
        error: (err) => {
          this.loading.set(false);
          if (err?.status === 402) {
            // BYOK gate: user picked Large/Massive/Ultimate without an LLM key
            this.notifications.error(
              err?.error?.detail ||
                'This modlist size requires your own LLM API key. Add one in AI Providers below to unlock Large, Massive, or Ultimate.',
            );
          } else if (!err?.error?.detail && err?.status !== 0) {
            this.notifications.error('Failed to start generation. Check your API keys and try again.');
          }
        },
      });
  }

  private saveWizardState(): void {
    const state = {
      gameId: this.gameId,
      gameVersion: this.gameVersion,
      specs: this.specs,
      playstyleId: this.selectedId(),
      customDescription: this.customDescription(),
      requestedMods: this.requestedMods(),
      timestamp: Date.now(),
    };
    localStorage.setItem('setup_wizard_state', JSON.stringify(state));
  }

  private getMaxFreeStorageGb(): number | undefined {
    const drives = this.specs.storage_drives;
    if (!drives) return undefined;
    const matches = drives.match(/(\d+)\s*GB\s*free/gi);
    if (!matches?.length) return undefined;
    return Math.max(...matches.map(m => parseInt(m)));
  }
}
