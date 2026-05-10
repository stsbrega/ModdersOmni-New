import { Component, EventEmitter, Input, OnInit, Output, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';
import { GenerationService } from '../../../../core/services/generation.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { SettingsStore } from '../../../../core/services/settings-store.service';
import { Game, Playstyle } from '../../../../shared/models/game.model';
import { HardwareSpecs } from '../../../../shared/models/specs.model';
import { LlmProvider } from '../../../../shared/models/mod.model';
import { PRESETS, SizePreset } from '../../../../shared/models/generation.model';
import { detectProvider } from '../../../../core/utils/key-detection';
import { ApiKeyGuideComponent } from '../../../../shared/components/api-key-guide/api-key-guide.component';
import {
  LucideAngularModule,
  LucideIconProvider,
  LUCIDE_ICONS,
  Sparkles,
  Tent,
  Swords,
  Wand2,
  Camera,
  Drama,
  Hammer,
  Building2,
  Check,
  X,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  ChevronDown,
  Lock,
  Bot,
} from 'lucide-angular';
import { trigger, transition, style, animate, query, stagger } from '@angular/animations';
import type { LLMConfig, ProviderId } from '../../../../core/services/llm/types';
import { defaultModelFor, PROVIDERS } from '../../../../core/services/llm/registry';
import type { GameVersion } from '../../../../core/services/knowledge.service';
import { UiButtonComponent } from '../../../../shared/components/ui/button.component';
import { UiInputComponent } from '../../../../shared/components/ui/input.component';
import { UiTextareaComponent } from '../../../../shared/components/ui/textarea.component';
import { UiSelectComponent, type UiSelectOption } from '../../../../shared/components/ui/select.component';

@Component({
  selector: 'app-playstyle-select',
  standalone: true,
  imports: [
    FormsModule,
    ApiKeyGuideComponent,
    LucideAngularModule,
    UiButtonComponent,
    UiInputComponent,
    UiTextareaComponent,
    UiSelectComponent,
  ],
  providers: [
    {
      provide: LUCIDE_ICONS,
      useValue: new LucideIconProvider({
        Sparkles,
        Tent,
        Swords,
        Wand2,
        Camera,
        Drama,
        Hammer,
        Building2,
        Check,
        X,
        ArrowLeft,
        ArrowRight,
        AlertCircle,
        ChevronDown,
        Lock,
        Bot,
      }),
      multi: true,
    },
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
                <lucide-icon name="check" [size]="14" [strokeWidth]="2.5"></lucide-icon>
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
          ui-textarea
          class="vision-textarea-extra"
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
          <input
            ui-input
            type="text"
            class="mod-input-field"
            [value]="modInput()"
            (input)="modInput.set($any($event.target).value)"
            (keydown.enter)="addRequestedMod()"
            placeholder="Type a mod name and press Enter..."
            autocomplete="off"
            spellcheck="false"
          />
          <button ui-button variant="primary" size="sm" (click)="addRequestedMod()" [disabled]="!modInput().trim()">
            Add
          </button>
        </div>
        @if (requestedMods().length > 0) {
          <div class="mod-tags">
            @for (mod of requestedMods(); track mod) {
              <div class="mod-tag">
                <span class="font-mono">{{ mod }}</span>
                <button class="tag-remove" (click)="removeRequestedMod(mod)" aria-label="Remove mod">
                  <lucide-icon name="x" [size]="10" [strokeWidth]="2.5"></lucide-icon>
                </button>
              </div>
            }
          </div>
        }
      </div>

      @if (!hasAnyPreference()) {
        <div class="preference-hint">
          <lucide-icon name="alert-circle" [size]="14" [strokeWidth]="1.5"></lucide-icon>
          Select a preset, describe your vision, or add mods to continue.
        </div>
      }

      <div class="ai-provider-section" [class.pending-highlight]="pendingGenerate()">
        <div class="provider-header" (click)="providerExpanded.set(!providerExpanded())">
          <div class="provider-label">
            <lucide-icon name="bot" [size]="16" [strokeWidth]="1.5"></lucide-icon>
            AI Providers
          </div>
          <div class="provider-badge" [class.configured]="configuredCount() > 0">
            {{ configuredCount() }} configured
          </div>
          <lucide-icon class="chevron" [class.expanded]="providerExpanded()" name="chevron-down" [size]="16" [strokeWidth]="2"></lucide-icon>
        </div>

        @if (providerExpanded()) {
          <div class="provider-body">
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
                <lucide-icon name="lock" [size]="12" [strokeWidth]="1.5"></lucide-icon>
                <span>Keys are stored securely and never shared. You can remove them anytime.</span>
              </div>

              <app-api-key-guide [providers]="providers()" />

              <!-- Add Key Input -->
              <form class="add-key-row" (ngSubmit)="addNewKey()">
                <input
                  ui-input
                  type="password"
                  class="add-key-field font-mono"
                  [value]="newKeyInput()"
                  (input)="newKeyInput.set($any($event.target).value)"
                  (paste)="onNewKeyPaste($event)"
                  placeholder="Paste any AI provider API key..."
                  autocomplete="new-password"
                  spellcheck="false"
                />
                <button ui-button type="submit" variant="primary" size="sm" [disabled]="!newKeyInput()">
                  Add
                </button>
              </form>

              <!-- Detection feedback -->
              @if (detectionState()) {
                <div class="detection-feedback" [class.warn]="detectionState()!.type !== 'exact'">
                  @if (detectionState()!.type === 'exact') {
                    <div class="detection-exact">
                      <lucide-icon name="check" [size]="12" [strokeWidth]="2.5"></lucide-icon>
                      Detected: <strong>{{ detectionState()!.providerName }}</strong>
                    </div>
                  } @else if (detectionState()!.type === 'ambiguous') {
                    <div class="detection-warn-msg">
                      <lucide-icon name="alert-circle" [size]="12" [strokeWidth]="2"></lucide-icon>
                      <span>Multiple providers match. Select one:</span>
                    </div>
                    <ui-select
                      placeholder="Select..."
                      [options]="ambiguousMatchOptions()"
                      (selectionChange)="confirmDetectedProvider($any($event))"
                    ></ui-select>
                  } @else {
                    <div class="detection-warn-msg">
                      <lucide-icon name="alert-circle" [size]="12" [strokeWidth]="2"></lucide-icon>
                      <span>Unknown key format. Select provider:</span>
                    </div>
                    <ui-select
                      placeholder="Select..."
                      [options]="providerOptions()"
                      (selectionChange)="confirmDetectedProvider($any($event))"
                    ></ui-select>
                  }
                </div>
              }

              <!-- Saved Keys -->
              @if (savedKeyEntries().length > 0) {
                <div class="saved-keys-list">
                  @for (entry of savedKeyEntries(); track entry.providerId) {
                    <div class="saved-key-chip">
                      <span class="chip-provider">{{ entry.providerName }}</span>
                      <span class="chip-mask font-mono">{{ entry.masked }}</span>
                      <button class="chip-remove" (click)="removeKey(entry.providerId)" title="Remove">
                        <lucide-icon name="x" [size]="10" [strokeWidth]="2.5"></lucide-icon>
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
                    ui-input
                    type="text"
                    class="font-mono"
                    style="flex: 1; font-size: 0.85rem;"
                    [value]="ollamaUrl()"
                    (input)="ollamaUrl.set($any($event.target).value)"
                    placeholder="http://localhost:11434/v1"
                  />
                  <button ui-button variant="secondary" size="sm" (click)="testOllamaConnection()">
                    Test
                  </button>
                </div>
                @if (ollamaStatus() === 'connected') {
                  <div style="display: flex; align-items: center; gap: 0.4rem; margin-top: 0.4rem; font-size: 0.8rem; color: #4ade80;">
                    <span style="width: 6px; height: 6px; border-radius: 50%; background: #4ade80; display: inline-block;"></span>
                    Connected — {{ ollamaModels().length }} model(s)
                  </div>
                  @if (ollamaModels().length > 0) {
                    <div style="margin-top: 0.5rem; width: 100%;">
                      <ui-select
                        [options]="ollamaModelOptions()"
                        [value]="ollamaSelectedModel()"
                        placeholder="Select a model"
                        (selectionChange)="ollamaSelectedModel.set($any($event))"
                      ></ui-select>
                    </div>
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
          </div>
        }
      </div>

      <div class="actions">
        <button ui-button variant="ghost" size="sm" (click)="back.emit()">
          <lucide-icon name="arrow-left" [size]="14" [strokeWidth]="2"></lucide-icon>
          Back
        </button>
        <button
          ui-button
          variant="primary"
          size="lg"
          (click)="generate()"
          [disabled]="!hasAnyPreference() || loading()"
        >
          @if (loading()) {
            <span class="btn-spinner"></span>
            Generating...
          } @else {
            Generate Modlist
            <lucide-icon name="arrow-right" [size]="14" [strokeWidth]="2"></lucide-icon>
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
      background: var(--color-surface-1);
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
      border-color: var(--color-border);
      transform: translateY(-1px);
    }
    .playstyle-card.selected {
      border-color: var(--color-accent);
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
      color: var(--color-accent);
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
      background: var(--color-accent);
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
      background: var(--color-surface-1);
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
    .size-card:hover { border-color: var(--color-border); transform: translateY(-1px); }
    .size-card.selected {
      border-color: var(--color-accent);
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
      color: var(--color-accent);
      font-style: normal;
    }

    /* Description textarea */
    .description-section {
      margin-bottom: 1.5rem;
    }
    /* vision-textarea-extra: layered on top of the ui-textarea primitive's
       host classes. Smaller font + denser line-height than the default to
       fit the wizard's compact section rhythm. */
    .vision-textarea-extra {
      font-size: 0.8125rem;
      line-height: 1.5;
      min-height: 72px;
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
      align-items: stretch;
    }
    .mod-input-field { flex: 1; }
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
    .preference-hint lucide-icon {
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
      border-top-color: var(--color-accent);
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
      background: var(--color-surface-1);
      border: 1px solid var(--color-border);
      border-radius: 10px;
      margin-bottom: 1.5rem;
      overflow: hidden;
      transition: border-color 0.3s;
    }
    .ai-provider-section.pending-highlight {
      border-color: var(--color-accent);
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
      color: var(--color-accent);
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
      color: var(--color-accent);
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
    .locked-message lucide-icon {
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
      background: var(--color-accent);
      border-color: var(--color-accent);
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
    .key-security-notice lucide-icon {
      flex-shrink: 0;
      color: var(--color-accent);
    }

    /* Add key row */
    .add-key-row {
      display: flex;
      gap: 0.375rem;
      margin-bottom: 0.375rem;
      align-items: stretch;
    }
    .add-key-field { flex: 1; }

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
    .detection-warn-msg lucide-icon { flex-shrink: 0; }

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

  // ── ui-select option lists ──
  // ui-select is option-array driven (typed { value, label }), unlike a
  // native <select> with template-projected <option>s. Map our existing
  // models to that shape via computed() so the dropdowns stay reactive
  // when the underlying signals (providers/matches/ollama models) change.
  ambiguousMatchOptions = computed<UiSelectOption[]>(() => {
    const matches = this.detectionState()?.matches ?? [];
    return matches.map(m => ({ value: m.id, label: m.name }));
  });
  providerOptions = computed<UiSelectOption[]>(() =>
    this.providers().map(p => ({ value: p.id, label: p.name })),
  );
  ollamaModelOptions = computed<UiSelectOption[]>(() =>
    this.ollamaModels().map(m => ({ value: m, label: m })),
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

  // Cached full Game record — needed by the client pipeline because
  // PipelineStartArgs.game wants {id, name, slug, nexus_domain}, but the
  // wizard only hands us a gameId. We fetch on init and look up at
  // generate() time.
  private games = signal<Game[]>([]);

  constructor(
    private api: ApiService,
    private generationService: GenerationService,
    private notifications: NotificationService,
    private router: Router,
    private settingsStore: SettingsStore,
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

    // Cache the full game list so the client-pipeline branch can resolve
    // the active gameId → Game record without an extra round trip at
    // generate() time. Cheap (~2 entries today) and keeps generate() sync.
    this.api.getGames().subscribe({
      next: (games) => this.games.set(games),
      error: () => {},
    });

    // Read saved keys synchronously from SettingsStore (localStorage). No
    // backend call, no auth gate — keys are local-only now (Plan 3 Task 2).
    const savedKeys = this.settingsStore.llmKeys();
    const regularKeys = { ...savedKeys };
    // Strip the legacy ollama / ollama_model entries; Ollama URL + model
    // live on dedicated SettingsStore signals.
    delete regularKeys['ollama'];
    delete regularKeys['ollama_model'];
    this.providerKeys.set(regularKeys);

    const ollamaUrl = this.settingsStore.ollamaUrl();
    if (ollamaUrl) {
      this.ollamaUrl.set(ollamaUrl);
    }
    const ollamaModel = this.settingsStore.ollamaModel();
    if (ollamaModel) {
      this.ollamaSelectedModel.set(ollamaModel);
    }
    if (ollamaUrl || savedKeys['ollama']) {
      this.testOllamaConnection();
    }

    if (Object.values(regularKeys).some(k => k?.length > 0)) {
      this.providerExpanded.set(false);
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
    // Persist removal to localStorage (no auth gate — local only).
    this.settingsStore.removeLlmKey(providerId);
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

    // Persist to localStorage (no auth gate — local only).
    this.settingsStore.setLlmKey(providerId, key);

    // Reset input state
    this.newKeyInput.set('');
    this.detectionState.set(null);

    // Auto-resume generation if pending
    if (this.pendingGenerate() && this.configuredCount() > 0) {
      this.pendingGenerate.set(false);
      setTimeout(() => this.generate(), 100);
    }
  }

  /**
   * Kick off the in-browser pipeline. Plan 3 Task 3 removed the auth gate
   * and the dual-pipeline feature flag — every generation now runs through
   * `GenerationService.start({pipelineArgs})` (no backend SSE branch).
   *
   * Bails early with a notification if anything required is missing (no
   * Game record cached yet, no whitelisted LLM key) so the user gets a
   * clear reason instead of a silent no-op.
   */
  generate(): void {
    if (!this.hasAnyPreference()) return;

    // Resolve the active Game record. games() may be empty if the API
    // call is still pending — in that case we can't proceed.
    const game = this.games().find((g) => g.id === this.gameId);
    if (!game) {
      this.notifications.error(
        'Game record is still loading — try again in a moment.',
      );
      return;
    }

    // Construct the LLM config from saved keys + Ollama. Returns null if
    // there's no whitelisted provider available — the client pipeline can
    // only talk to providers in `ProviderId` (anthropic / openai / gemini /
    // groq / openrouter / ollama), so surface a clear error.
    const llmConfig = this.pickLlmConfig();
    if (!llmConfig) {
      this.notifications.error(
        'Add a supported LLM API key (Anthropic, OpenAI, Gemini, Groq, OpenRouter) ' +
          'or connect Ollama to start a build.',
      );
      return;
    }

    this.loading.set(true);

    // Optional playstyle — wizard may have one selected by id but the
    // pipeline wants the full Playstyle record. Look it up in the cached
    // list.
    const selectedId = this.selectedId();
    const playstyle = selectedId != null
      ? this.playstyles().find((p) => p.id === selectedId) ?? null
      : null;

    const description = this.customDescription().trim() || undefined;
    const mods = this.requestedMods();

    this.generationService
      .start({
        game,
        preset: this.selectedPreset(),
        hardwareSpec: this.specs,
        availableStorageGb: this.getMaxFreeStorageGb(),
        llmConfig,
        playstyle,
        gameVersion: (this.gameVersion ?? null) as GameVersion | null,
        customDescription: description ?? null,
        requestedMods: mods,
      })
      .then((session) => {
        this.loading.set(false);

        // Wizard is complete — clear refresh-recovery snapshots so a future
        // "New Build" starts from step 1 (game selection).
        sessionStorage.removeItem('setup_wizard_progress');
        localStorage.removeItem('setup_wizard_state');

        // Navigate to the generation viewer using the pipeline session id.
        const sessionId = session?.id ?? this.generationService.generationId();
        if (sessionId) {
          this.router.navigate(['/generate', sessionId]);
        }
      })
      .catch((err: Error) => {
        this.loading.set(false);
        this.notifications.error(
          err?.message || 'Failed to start the in-browser generation.',
        );
      });
  }

  /**
   * Build an LLMConfig from saved provider keys + Ollama. Returns null if
   * none of the user's saved providers are on the client-pipeline whitelist
   * (the dispatcher only supports anthropic/openai/gemini/groq/openrouter/ollama).
   *
   * Precedence: Ollama wins when connected (matches user's local-first
   * intent — they actively tested the connection); otherwise the first
   * whitelisted provider with a non-empty key.
   */
  private pickLlmConfig(): LLMConfig | null {
    if (this.ollamaStatus() === 'connected') {
      return {
        provider: 'ollama',
        model: this.ollamaSelectedModel(),
        baseUrl: this.ollamaUrl(),
      };
    }

    const whitelist = Object.keys(PROVIDERS) as ProviderId[];
    const keys = this.providerKeys();
    for (const providerId of whitelist) {
      const key = keys[providerId];
      if (key && key.length > 0) {
        return {
          provider: providerId,
          model: defaultModelFor(providerId),
          apiKey: key,
        };
      }
    }
    return null;
  }

  private getMaxFreeStorageGb(): number | undefined {
    const drives = this.specs.storage_drives;
    if (!drives) return undefined;
    const matches = drives.match(/(\d+)\s*GB\s*free/gi);
    if (!matches?.length) return undefined;
    return Math.max(...matches.map(m => parseInt(m)));
  }
}
