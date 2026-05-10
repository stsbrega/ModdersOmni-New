import { Component, computed, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { fadeUp } from '../../core/motion/animations';
import {
  LucideAngularModule,
  LUCIDE_ICONS,
  LucideIconProvider,
  AlertCircle,
  Lock,
  Check,
  X,
  Pencil,
  Trash2,
  Settings as SettingsIcon,
} from 'lucide-angular';
import { SpecParserService } from '../../core/services/spec-parser.service';
import { LLM_PROVIDERS } from '../../core/services/llm/providers-meta';
import { NotificationService } from '../../core/services/notification.service';
import { HardwareDetectorService } from '../../core/services/hardware-detector.service';
import { SettingsStore } from '../../core/services/settings-store.service';
import { LlmProvider } from '../../shared/models/mod.model';
import { detectProvider } from '../../core/utils/key-detection';
import { ApiKeyGuideComponent } from '../../shared/components/api-key-guide/api-key-guide.component';
// Direct primitive imports — same pattern landing/setup adopted in Tasks 5-6
// to avoid pulling in sibling primitives that may have unrelated TS errors.
import { UiButtonComponent } from '../../shared/components/ui/button.component';
import { UiInputComponent } from '../../shared/components/ui/input.component';
import { UiTextareaComponent } from '../../shared/components/ui/textarea.component';
import { UiCardComponent } from '../../shared/components/ui/card.component';

// Profile/OAuth/Delete-account tab is gone with auth (Plan 3 Task 3); the
// remaining tabs are LLM keys + hardware + notifications. Keys live in their
// own tab so the Hardware tab stays purely about the gaming rig.
type SettingsTab = 'keys' | 'hardware' | 'notifications';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    FormsModule,
    ApiKeyGuideComponent,
    LucideAngularModule,
    UiButtonComponent,
    UiInputComponent,
    UiTextareaComponent,
    UiCardComponent,
  ],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        AlertCircle,
        Lock,
        Check,
        X,
        Pencil,
        Trash2,
        Settings: SettingsIcon,
      }),
    },
  ],
  // Centralized triggers from core/motion/animations.ts. Replaces the inline
  // fadeIn definition — Plan 3 Task 9 (Plan 2 Task 14 follow-up). Templates
  // now use @fadeUp; gains a small translateY(8px) slide on top of the fade.
  animations: [fadeUp],
  template: `
    <div class="settings-page">
      <div class="settings-header">
        <h1>Settings</h1>
        <p>Manage your AI keys, hardware, and preferences</p>
      </div>

      <!-- Tabs -->
      <div class="tabs">
        @for (tab of tabs; track tab.id) {
          <button
            class="tab"
            [class.active]="activeTab() === tab.id"
            (click)="activeTab.set(tab.id)"
          >
            {{ tab.label }}
          </button>
        }
      </div>

      <!-- Tab Content -->
      <div class="tab-content">
        @switch (activeTab()) {
          @case ('keys') {
            <div class="tab-panel" @fadeUp>
              <div class="panel-section">
                <h3>AI Provider API Keys</h3>
                <ui-card class="key-security-notice">
                  <lucide-icon name="lock" [size]="14" [strokeWidth]="1.5"></lucide-icon>
                  <span>Your API keys live only in this browser (localStorage) and are sent directly to the provider during modlist generation.</span>
                </ui-card>
                <p class="input-hint" style="margin-bottom: 0.75rem;">
                  Paste an API key below — the provider will be detected automatically.
                  If one provider hits a rate limit during generation, the next is used.
                </p>

                <app-api-key-guide [providers]="llmProviders()" />

                <!-- Add Key Input -->
                <form class="add-key-row" (ngSubmit)="addKey()">
                  <input
                    ui-input
                    type="password"
                    [value]="newKeyInput()"
                    (input)="newKeyInput.set($any($event.target).value)"
                    (paste)="onKeyPaste($event)"
                    placeholder="Paste any AI provider API key..."
                    autocomplete="new-password"
                    spellcheck="false"
                    class="key-input"
                  />
                  <button
                    ui-button
                    variant="primary"
                    type="submit"
                    [disabled]="!newKeyInput()"
                  >
                    Add Key
                  </button>
                </form>

                <!-- Detection feedback -->
                @if (detectionState()) {
                  <ui-card
                    class="detection-feedback"
                    [class.warning]="detectionState()!.type !== 'exact'"
                    @fadeUp
                  >
                    @if (detectionState()!.type === 'exact') {
                      <div class="detection-exact">
                        <lucide-icon name="check" [size]="14" [strokeWidth]="2.5"></lucide-icon>
                        Detected: <strong>{{ detectionState()!.providerName }}</strong>
                      </div>
                    } @else if (detectionState()!.type === 'ambiguous') {
                      <div class="detection-warn">
                        <lucide-icon name="alert-circle" [size]="14" [strokeWidth]="2"></lucide-icon>
                        <span>This key prefix matches multiple providers. Please select the correct one:</span>
                      </div>
                      <select class="legacy-select" (change)="confirmProvider($any($event.target).value)">
                        <option value="" disabled selected>Select provider...</option>
                        @for (m of detectionState()!.matches; track m.id) {
                          <option [value]="m.id">{{ m.name }}</option>
                        }
                      </select>
                    } @else {
                      <div class="detection-warn">
                        <lucide-icon name="alert-circle" [size]="14" [strokeWidth]="2"></lucide-icon>
                        <span>Could not identify the provider from this key. Please select it manually:</span>
                      </div>
                      <select class="legacy-select" (change)="confirmProvider($any($event.target).value)">
                        <option value="" disabled selected>Select provider...</option>
                        @for (p of llmProviders(); track p.id) {
                          <option [value]="p.id">{{ p.name }}</option>
                        }
                      </select>
                    }
                  </ui-card>
                }

                <!-- Saved Keys List -->
                @if (savedKeysList().length > 0) {
                  <div class="saved-keys">
                    @for (entry of savedKeysList(); track entry.providerId) {
                      <ui-card class="saved-key-row">
                        <div class="saved-key-info">
                          <span class="saved-key-provider">{{ entry.providerName }}</span>
                          <span class="saved-key-masked">{{ entry.maskedKey }}</span>
                        </div>
                        <div class="saved-key-actions">
                          @if (editingKeyProvider() === entry.providerId) {
                            <select class="legacy-select reassign-select" (change)="reassignKey(entry.providerId, $any($event.target).value)">
                              <option value="" disabled selected>Move to...</option>
                              @for (p of llmProviders(); track p.id) {
                                @if (p.id !== entry.providerId) {
                                  <option [value]="p.id">{{ p.name }}</option>
                                }
                              }
                            </select>
                            <button ui-button variant="ghost" size="sm" (click)="editingKeyProvider.set(null)" title="Cancel">
                              <lucide-icon name="x" [size]="12" [strokeWidth]="2"></lucide-icon>
                            </button>
                          } @else {
                            <button ui-button variant="ghost" size="sm" (click)="editingKeyProvider.set(entry.providerId)" title="Reassign to different provider">
                              <lucide-icon name="pencil" [size]="12" [strokeWidth]="2"></lucide-icon>
                            </button>
                            <button ui-button variant="destructive" size="sm" (click)="deleteKey(entry.providerId)" title="Remove key">
                              <lucide-icon name="trash-2" [size]="12" [strokeWidth]="2"></lucide-icon>
                            </button>
                          }
                        </div>
                      </ui-card>
                    }
                  </div>
                }
              </div>

              <!-- Local Providers (Ollama) -->
              @if (keylessProviders().length > 0) {
                <div class="panel-section">
                  <h3>Local AI Providers</h3>
                  <p class="input-hint" style="margin-bottom: 0.75rem;">
                    Run AI models on your own hardware with
                    <a href="https://ollama.com" target="_blank" rel="noopener" style="color: var(--accent);">Ollama</a>
                    — no API key needed.
                  </p>

                  <div class="add-key-row">
                    <input
                      ui-input
                      type="text"
                      [value]="ollamaUrl()"
                      (input)="ollamaUrl.set($any($event.target).value)"
                      placeholder="http://localhost:11434/v1"
                      autocomplete="off"
                      class="key-input"
                    />
                    <button ui-button variant="primary" (click)="testOllamaConnection()">
                      Test Connection
                    </button>
                  </div>

                  @if (ollamaStatus() === 'connected') {
                    <ui-card class="detection-feedback" @fadeUp>
                      <div class="detection-exact">
                        <lucide-icon name="check" [size]="14" [strokeWidth]="2.5"></lucide-icon>
                        Connected — {{ ollamaModels().length }} model(s) available
                      </div>
                    </ui-card>
                    @if (ollamaModels().length > 0) {
                      <div style="margin-top: 0.5rem;">
                        <select class="legacy-select" [value]="ollamaSelectedModel()" (change)="onOllamaModelChange($any($event.target).value)">
                          @for (m of ollamaModels(); track m) {
                            <option [value]="m">{{ m }}</option>
                          }
                        </select>
                      </div>
                    }
                  }
                  @if (ollamaStatus() === 'error') {
                    <ui-card class="detection-feedback warning" @fadeUp>
                      <div class="detection-warn">
                        <lucide-icon name="alert-circle" [size]="14" [strokeWidth]="2"></lucide-icon>
                        <span>{{ ollamaError() }}</span>
                      </div>
                    </ui-card>
                  }
                </div>
              }
            </div>
          }
          @case ('hardware') {
            <div class="tab-panel" @fadeUp>
              <!-- Auto-Detect Section -->
              <div class="panel-section">
                <h3>Auto-Detect</h3>
                <p class="input-hint" style="margin-bottom: 0.75rem;">Detect your GPU automatically via your browser. VRAM is inferred from the GPU model.</p>
                <button ui-button variant="secondary" (click)="autoDetect()" [disabled]="scanLoading()">
                  @if (scanLoading() && !hardwareRawText.trim()) {
                    <span class="btn-spinner"></span>
                    Detecting...
                  } @else {
                    <lucide-icon name="settings" [size]="14" [strokeWidth]="2"></lucide-icon>
                    Auto-Detect Hardware
                  }
                </button>
              </div>

              <!-- Paste & Scan Section -->
              <div class="panel-section">
                <div class="section-header-row">
                  <h3>Paste & Scan</h3>
                  <button ui-button variant="ghost" size="sm" (click)="showHelpGuide.set(!showHelpGuide())">
                    {{ showHelpGuide() ? 'Hide guide' : 'How to find your specs' }}
                  </button>
                </div>
                @if (showHelpGuide()) {
                  <ui-card class="help-guide" @fadeUp>
                    <div class="help-option">
                      <h4>Option 1: PowerShell Command</h4>
                      <p>Open PowerShell and run this command, then paste the output below:</p>
                      <div class="code-block">
                        <code>{{ powershellCommand }}</code>
                        <button ui-button variant="ghost" size="sm" (click)="copyCommand()" [title]="'Copy to clipboard'">
                          {{ commandCopied() ? 'Copied!' : 'Copy' }}
                        </button>
                      </div>
                    </div>
                    <div class="help-option">
                      <h4>Option 2: Task Manager</h4>
                      <p>Open Task Manager (Ctrl+Shift+Esc) &rarr; Performance tab &rarr; note your CPU name, GPU name, and memory values. Paste or type them below.</p>
                    </div>
                    <div class="help-option">
                      <h4>Option 3: NVIDIA App / AMD Software</h4>
                      <p>Open your GPU software &rarr; System Information &rarr; copy the hardware details and paste below.</p>
                    </div>
                  </ui-card>
                }
                <textarea
                  ui-textarea
                  [(ngModel)]="hardwareRawText"
                  placeholder="Paste hardware info from PowerShell output, NVIDIA App, HWiNFO, or Task Manager..."
                  rows="4"
                  class="font-mono text-sm"
                ></textarea>
                <button
                  ui-button
                  variant="secondary"
                  (click)="scanHardware()"
                  [disabled]="scanLoading() || !hardwareRawText.trim()"
                  class="mt-2"
                >
                  @if (scanLoading() && hardwareRawText.trim()) {
                    <span class="btn-spinner"></span>
                    Scanning...
                  } @else {
                    Scan & Fill
                  }
                </button>
              </div>

              <!-- Hardware Fields -->
              <div class="panel-section">
                <h3>GPU Model</h3>
                <input ui-input type="text" [(ngModel)]="gpuModel" placeholder="e.g. NVIDIA GeForce RTX 4070" />
              </div>
              <div class="panel-section">
                <h3>VRAM</h3>
                <div class="slider-group">
                  <input type="range" class="slider" min="2" max="24" step="1" [(ngModel)]="vramGb">
                  <span class="slider-value">{{ vramGb }} GB</span>
                </div>
              </div>
              <div class="panel-section">
                <h3>System RAM</h3>
                <div class="slider-group">
                  <input type="range" class="slider" min="4" max="64" step="4" [(ngModel)]="ramGb">
                  <span class="slider-value">{{ ramGb }} GB</span>
                </div>
              </div>
              <div class="panel-section">
                <h3>CPU Model</h3>
                <input ui-input type="text" [(ngModel)]="cpuModel" placeholder="e.g. AMD Ryzen 7 7800X3D" />
              </div>
              <div class="panel-section hw-row">
                <div class="hw-field">
                  <h3>CPU Cores</h3>
                  <input ui-input type="number" [(ngModel)]="cpuCores" min="1" max="128" step="1" placeholder="e.g. 8" />
                </div>
                <div class="hw-field">
                  <h3>CPU Speed (GHz)</h3>
                  <input ui-input type="number" [(ngModel)]="cpuSpeedGhz" min="0.5" max="8" step="0.1" placeholder="e.g. 4.7" />
                </div>
              </div>
              <div class="panel-section">
                <h3>Storage Drives</h3>
                <input
                  ui-input
                  type="text"
                  placeholder="C: 180GB free / 931GB, D: 450GB free / 1863GB"
                  [ngModel]="storageDrives"
                  (ngModelChange)="storageDrives = $event; storageDrivesSignal.set($event)"
                />
                <small class="hint">
                  Paste drive info or list manually. Tip: run
                  <code>fsutil volume diskfree C:</code> in PowerShell to get free / total bytes per drive.
                </small>
              </div>
              @if (storageDrives) {
                <div class="panel-section">
                  <h3>Storage Drives Detected</h3>
                  <div class="drives-list">
                    @for (drive of parsedDrives(); track drive.letter) {
                      <div class="drive-item">
                        <span class="drive-letter">{{ drive.letter }}</span>
                        <div class="drive-bar-container">
                          <div class="drive-bar" [style.width.%]="drive.usedPct"></div>
                        </div>
                        <span class="drive-info">{{ drive.freeGb }} GB free / {{ drive.totalGb }} GB</span>
                      </div>
                    }
                  </div>
                </div>
              }
              <ui-card class="hw-summary">
                <h4>Hardware Summary</h4>
                <div class="hw-grid">
                  <div class="hw-item">
                    <span class="hw-label">GPU</span>
                    <span class="hw-val">{{ gpuModel || 'Not set' }}</span>
                  </div>
                  <div class="hw-item">
                    <span class="hw-label">VRAM</span>
                    <span class="hw-val">{{ vramGb }} GB</span>
                  </div>
                  <div class="hw-item">
                    <span class="hw-label">RAM</span>
                    <span class="hw-val">{{ ramGb }} GB</span>
                  </div>
                  <div class="hw-item">
                    <span class="hw-label">CPU</span>
                    <span class="hw-val">{{ cpuModel || 'Not set' }}</span>
                  </div>
                  @if (cpuCores) {
                    <div class="hw-item">
                      <span class="hw-label">Cores</span>
                      <span class="hw-val">{{ cpuCores }}</span>
                    </div>
                  }
                  @if (cpuSpeedGhz) {
                    <div class="hw-item">
                      <span class="hw-label">Speed</span>
                      <span class="hw-val">{{ cpuSpeedGhz }} GHz</span>
                    </div>
                  }
                  @if (storageDrives) {
                    <div class="hw-item" style="grid-column: 1 / -1;">
                      <span class="hw-label">Storage</span>
                      <span class="hw-val">{{ storageDrives }}</span>
                    </div>
                  }
                </div>
              </ui-card>
            </div>
          }
          @case ('notifications') {
            <div class="tab-panel" @fadeUp>
              <div class="notif-item">
                <div class="notif-info">
                  <h3>Notify when generation finishes</h3>
                  <p>Show a browser notification when your modlist is ready (works while the tab is open).</p>
                </div>
                <button class="toggle-switch" [class.on]="notifyOnComplete" (click)="notifyOnComplete = !notifyOnComplete">
                  <span class="toggle-knob"></span>
                </button>
              </div>
            </div>
          }
        }
      </div>

      <!-- Save Button -->
      <div class="save-bar">
        <button ui-button variant="primary" (click)="saveSettings()">
          Save Changes
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .settings-page {
      max-width: 680px;
      margin: 0 auto;
      padding: 2rem;
    }
    .settings-header {
      margin-bottom: 2rem;
    }
    .settings-header h1 {
      font-size: 1.5rem;
      font-weight: 600;
      letter-spacing: -0.01em;
    }
    .settings-header p {
      font-size: 0.875rem;
      color: var(--color-text-muted);
      margin-top: 0.25rem;
    }

    /* Tabs */
    .tabs {
      display: flex;
      gap: 0.25rem;
      border-bottom: 1px solid var(--color-border);
      margin-bottom: 2rem;
    }
    .tab {
      padding: 0.625rem 1rem;
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--color-text-muted);
      background: none;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
      transition: color 0.15s, border-color 0.15s;
    }
    .tab:hover { color: var(--color-text); }
    .tab.active {
      color: var(--color-text);
      border-bottom-color: var(--color-accent);
    }

    /* Panel */
    .tab-panel {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .panel-section {
      padding: 1rem 0;
      border-bottom: 1px solid var(--color-border);
    }
    .panel-section:last-child { border-bottom: none; }
    .panel-section.hw-row {
      display: flex;
      gap: 1rem;
    }
    .hw-field {
      flex: 1;
    }
    .hw-field h3 {
      font-size: 0.875rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }
    .panel-section h3 {
      font-size: 0.875rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }

    .input-hint {
      font-size: 0.75rem;
      color: var(--color-text-dim);
      margin-top: 0.375rem;
    }

    /* Slider — kept inline; ui-input semantics don't fit a range slider */
    .slider-group {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .slider {
      flex: 1;
      -webkit-appearance: none;
      appearance: none;
      height: 4px;
      background: var(--color-border);
      border-radius: 2px;
      outline: none;
    }
    .slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: var(--color-accent);
      cursor: pointer;
      border: 3px solid var(--color-bg);
      box-shadow: 0 0 0 1px var(--color-accent);
    }
    .slider::-moz-range-thumb {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: var(--color-accent);
      cursor: pointer;
      border: 3px solid var(--color-bg);
    }
    .slider-value {
      font-size: 0.875rem;
      font-weight: 600;
      min-width: 50px;
      text-align: right;
    }

    /* Hardware summary — uses ui-card; only inner layout below */
    .hw-summary h4 {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 1rem;
    }
    .hw-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
    }
    .hw-item {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
    }
    .hw-label {
      font-size: 0.75rem;
      color: var(--color-text-dim);
    }
    .hw-val {
      font-size: 0.875rem;
      font-weight: 500;
    }

    /* Hint under freeform fields */
    .hint {
      display: block;
      margin-top: 0.375rem;
      font-size: 0.75rem;
      color: var(--color-text-dim);
      line-height: 1.4;
    }
    .hint code {
      background: rgba(255, 255, 255, 0.06);
      padding: 0.05rem 0.3rem;
      border-radius: 3px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 0.72rem;
    }

    /* Storage Drives bars */
    .drives-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .drive-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .drive-letter {
      font-size: 0.8125rem;
      font-weight: 600;
      min-width: 24px;
      color: var(--color-accent);
    }
    .drive-bar-container {
      flex: 1;
      height: 6px;
      background: var(--color-border);
      border-radius: 3px;
      overflow: hidden;
    }
    .drive-bar {
      height: 100%;
      background: var(--color-accent);
      border-radius: 3px;
      transition: width 0.3s ease;
    }
    .drive-info {
      font-size: 0.75rem;
      color: var(--color-text-muted);
      min-width: 140px;
      text-align: right;
    }

    /* Spinner used inside Detect / Scan buttons */
    .btn-spinner {
      width: 12px;
      height: 12px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: var(--color-text);
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Section header with toggle */
    .section-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.5rem;
    }
    .section-header-row h3 { margin-bottom: 0; }

    /* Help guide — ui-card; only inner layout below */
    .help-guide {
      margin-bottom: 0.75rem;
      display: flex !important;
      flex-direction: column;
      gap: 1rem;
    }
    .help-option h4 {
      font-size: 0.8125rem;
      font-weight: 600;
      margin-bottom: 0.25rem;
      color: var(--color-accent);
    }
    .help-option p {
      font-size: 0.8125rem;
      color: var(--color-text-muted);
      line-height: 1.4;
    }
    .code-block {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      margin-top: 0.5rem;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid var(--color-border);
      border-radius: 8px;
      padding: 0.75rem;
    }
    .code-block code {
      flex: 1;
      font-family: 'Fira Code', 'Consolas', monospace;
      font-size: 0.75rem;
      line-height: 1.5;
      color: var(--color-text-muted);
      word-break: break-all;
      white-space: pre-wrap;
    }

    /* API key security notice — ui-card with row icon+text layout */
    .key-security-notice {
      display: flex !important;
      align-items: flex-start;
      gap: 0.5rem;
      padding: 0.625rem 0.75rem !important;
      background: rgba(192, 160, 96, 0.06) !important;
      border-color: rgba(192, 160, 96, 0.15) !important;
      margin-bottom: 0.75rem;
      font-size: 0.75rem;
      color: var(--color-text-muted);
      line-height: 1.4;
    }
    .key-security-notice lucide-icon {
      flex-shrink: 0;
      margin-top: 1px;
      color: var(--color-accent);
    }

    /* Add key row — input + button, side by side */
    .add-key-row {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
      align-items: stretch;
    }
    .key-input {
      flex: 1;
      min-width: 0;
      font-family: monospace;
      font-size: 0.8125rem;
    }

    /* Detection feedback — ui-card with success/warning tinting */
    .detection-feedback {
      padding: 0.625rem 0.75rem !important;
      margin-bottom: 0.75rem;
      font-size: 0.8125rem;
      background: rgba(34, 197, 94, 0.08) !important;
      border-color: rgba(34, 197, 94, 0.2) !important;
    }
    .detection-feedback.warning {
      background: rgba(234, 179, 8, 0.08) !important;
      border-color: rgba(234, 179, 8, 0.2) !important;
    }
    .detection-exact {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      color: #22c55e;
      font-weight: 500;
    }
    .detection-exact strong { color: var(--color-text); }
    .detection-warn {
      display: flex;
      align-items: flex-start;
      gap: 0.375rem;
      color: var(--color-warning);
      margin-bottom: 0.5rem;
    }
    .detection-warn lucide-icon { flex-shrink: 0; margin-top: 2px; }

    /* Native <select> — no UiSelect wrapper for cdk-overlay-style menus
       was adopted yet for these legacy detection/reassign menus. */
    .legacy-select {
      width: 100%;
      background: var(--color-surface-1);
      border: 1px solid var(--color-border);
      border-radius: 8px;
      color: var(--color-text);
      padding: 0.5rem 0.75rem;
      font-size: 0.8125rem;
      cursor: pointer;
      outline: none;
      transition: border-color 0.15s;
    }
    .legacy-select:focus { border-color: var(--color-accent); }
    .reassign-select {
      max-width: 140px;
      padding: 0.25rem 0.5rem;
      font-size: 0.75rem;
    }

    /* Saved keys list — each row is a ui-card */
    .saved-keys {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
      margin-top: 0.5rem;
    }
    .saved-key-row {
      display: flex !important;
      align-items: center;
      justify-content: space-between;
      padding: 0.625rem 0.75rem !important;
    }
    .saved-key-info {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      min-width: 0;
    }
    .saved-key-provider {
      font-size: 0.8125rem;
      font-weight: 600;
      white-space: nowrap;
    }
    .saved-key-masked {
      font-size: 0.75rem;
      color: var(--color-text-dim);
      font-family: monospace;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .saved-key-actions {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      flex-shrink: 0;
    }

    /* Notification rows — toggle switches kept inline. ui-button variants
       don't model an on/off pill; ui-input is for text/password fields. */
    .notif-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.25rem 0;
      border-bottom: 1px solid var(--color-border);
    }
    .notif-item:last-child { border-bottom: none; }
    .notif-info h3 {
      font-size: 0.875rem;
      font-weight: 600;
      margin-bottom: 0.125rem;
    }
    .notif-info p {
      font-size: 0.8125rem;
      color: var(--color-text-muted);
    }
    .toggle-switch {
      width: 44px;
      height: 24px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.1);
      position: relative;
      flex-shrink: 0;
      transition: background 0.2s;
      padding: 0;
    }
    .toggle-switch.on { background: var(--color-accent); }
    .toggle-knob {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: white;
      transition: transform 0.2s;
    }
    .toggle-switch.on .toggle-knob {
      transform: translateX(20px);
    }

    /* Save bar */
    .save-bar {
      margin-top: 2rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--color-border);
    }
  `],
})
export class SettingsComponent implements OnInit {
  // Default to the LLM keys tab — that's the only setting users actually
  // need to revisit after the auth strip (hardware persists per-session;
  // notifications is one toggle).
  activeTab = signal<SettingsTab>('keys');

  tabs: { id: SettingsTab; label: string }[] = [
    { id: 'keys', label: 'AI Keys' },
    { id: 'hardware', label: 'Hardware' },
    { id: 'notifications', label: 'Notifications' },
  ];

  // LLM Providers (registry-based) — fetched from backend; the keys
  // themselves live entirely in localStorage via SettingsStore.
  llmProviders = signal<LlmProvider[]>([]);
  llmKeys = signal<Record<string, string>>({});

  // Ollama (local providers)
  ollamaUrl = signal('http://localhost:11434/v1');
  ollamaStatus = signal<'unknown' | 'connected' | 'error'>('unknown');
  ollamaModels = signal<string[]>([]);
  ollamaSelectedModel = signal('gemma4:26b');
  ollamaError = signal('');
  keylessProviders = computed(() => this.llmProviders().filter(p => p.keyless));

  // Dynamic key entry state
  newKeyInput = signal('');
  detectionState = signal<{
    type: 'exact' | 'ambiguous' | 'unknown';
    providerId?: string;
    providerName?: string;
    matches?: { id: string; name: string }[];
  } | null>(null);
  editingKeyProvider = signal<string | null>(null);
  savedKeysList = computed(() => {
    const keys = this.llmKeys();
    const providers = this.llmProviders();
    return Object.entries(keys)
      .filter(([, key]) => key.length > 0)
      .map(([providerId, key]) => {
        const provider = providers.find(p => p.id === providerId);
        const masked = key.length > 12
          ? key.substring(0, 6) + '...' + key.substring(key.length - 4)
          : '***';
        return {
          providerId,
          providerName: provider?.name || providerId,
          maskedKey: masked,
        };
      });
  });

  // Hardware — in-memory only this commit. The backend persistence path
  // (authService.getHardware / saveHardware) was removed with the auth
  // strip; structured hardware fields will move into SettingsStore in a
  // follow-on (see Plan 3 Task 4 for the broader API-removal cleanup).
  gpuModel = '';
  vramGb = 8;
  ramGb = 16;
  cpuModel = '';
  cpuCores: number | null = null;
  cpuSpeedGhz: number | null = null;
  hardwareTier = '';
  hardwareRawText = '';
  storageDrives = '';
  storageDrivesSignal = signal('');
  parsedDrives = computed(() => {
    const raw = this.storageDrivesSignal();
    if (!raw) return [];
    return raw.split(',').map(part => {
      const m = part.trim().match(/^([A-Z]:)\s*(\d+)\s*GB\s*free\s*\/\s*(\d+)\s*GB$/i);
      if (!m) return null;
      const freeGb = parseInt(m[2]);
      const totalGb = parseInt(m[3]);
      const usedPct = totalGb > 0 ? Math.round(((totalGb - freeGb) / totalGb) * 100) : 0;
      return { letter: m[1], freeGb, totalGb, usedPct };
    }).filter((d): d is NonNullable<typeof d> => d !== null);
  });
  scanLoading = signal(false);
  showHelpGuide = signal(false);
  commandCopied = signal(false);
  powershellCommand = `$gpu=Get-CimInstance Win32_VideoController|Sort-Object AdapterRAM -Descending|Select -First 1;$g=$gpu.Name;try{$v=[math]::Round((nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits 2>$null|Select -First 1)/1024)}catch{$v=0};if(!$v){$v=[math]::Round($gpu.AdapterRAM/1GB)};$c=(Get-CimInstance Win32_Processor).Name;$r=[math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory/1GB);$n=(Get-CimInstance Win32_Processor).NumberOfCores;$t=(Get-CimInstance Win32_Processor).NumberOfLogicalProcessors;$d=(Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3"|ForEach-Object{"$($_.DeviceID) $([math]::Round($_.FreeSpace/1GB))GB free / $([math]::Round($_.Size/1GB))GB"}) -join ", ";"GPU: $g\`nVRAM: $v GB\`nCPU: $c\`nCores: $n cores / $t threads\`nRAM: $r GB\`nDrives: $d"`;

  // Notifications — single survivor toggle (the email-coupled toggles went
  // away with auth; this one shows a browser notification when generation
  // finishes and is local to this browser).
  notifyOnComplete = false;

  constructor(
    private specParser: SpecParserService,
    private notifications: NotificationService,
    private hardwareDetector: HardwareDetectorService,
    private settingsStore: SettingsStore,
  ) {}

  ngOnInit(): void {
    this.loadSettings();
    this.loadLlmProviders();
    this.loadLlmKeys();
  }

  onKeyPaste(event: ClipboardEvent): void {
    const pasted = event.clipboardData?.getData('text')?.trim();
    if (!pasted) return;
    // Let the input update first, then run detection
    setTimeout(() => this.runDetection(pasted), 0);
  }

  addKey(): void {
    const key = this.newKeyInput().trim();
    if (!key) return;

    const state = this.detectionState();
    if (state?.type === 'exact' && state.providerId) {
      this.saveDetectedKey(state.providerId, key);
    } else if (!state) {
      // Run detection if not yet run (user typed instead of pasting)
      this.runDetection(key);
    }
    // For ambiguous/unknown, user must pick from dropdown first (confirmProvider)
  }

  confirmProvider(providerId: string): void {
    if (!providerId) return;
    const key = this.newKeyInput().trim();
    if (!key) return;
    this.saveDetectedKey(providerId, key);
  }

  deleteKey(providerId: string): void {
    // Persist deletion to localStorage via SettingsStore — also updates the
    // shared signal, but we keep our local llmKeys signal in sync for the
    // template's existing computed bindings.
    this.settingsStore.removeLlmKey(providerId);
    this.llmKeys.update(keys => {
      const updated = { ...keys };
      delete updated[providerId];
      return updated;
    });
    this.notifications.success('API key removed');
  }

  testOllamaConnection(): void {
    this.ollamaStatus.set('unknown');
    // Direct browser fetch to Ollama's `/api/tags`. Ollama runs locally so
    // CORS is fine in practice; an unreachable URL falls into the catch.
    const baseUrl = this.ollamaUrl().replace(/\/v1\/?$/, '').replace(/\/$/, '');
    fetch(`${baseUrl}/api/tags`)
      .then((res) => res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`)))
      .then((data: { models?: { name: string }[] }) => {
        const models = (data.models ?? []).map((m) => m.name);
        this.ollamaStatus.set('connected');
        this.ollamaModels.set(models);
        this.ollamaError.set('');
        if (models.length > 0 && !models.includes(this.ollamaSelectedModel())) {
          this.ollamaSelectedModel.set(models[0]);
        }
        const model = this.ollamaSelectedModel();
        this.settingsStore.setOllamaUrl(this.ollamaUrl());
        this.settingsStore.setOllamaModel(model);
        this.llmKeys.update(k => ({ ...k, ollama: this.ollamaUrl(), ollama_model: model }));
        this.notifications.success('Connected to Ollama!');
      })
      .catch(() => {
        this.ollamaStatus.set('error');
        this.ollamaError.set('Could not reach the server');
      });
  }

  onOllamaModelChange(model: string): void {
    this.ollamaSelectedModel.set(model);
    this.llmKeys.update(k => ({ ...k, ollama_model: model }));
    this.settingsStore.setOllamaModel(model);
  }

  reassignKey(oldProviderId: string, newProviderId: string): void {
    if (!newProviderId) return;
    const keys = this.llmKeys();
    const key = keys[oldProviderId];
    if (!key) return;

    // Remove old, add new — persist both changes to localStorage
    this.settingsStore.removeLlmKey(oldProviderId);
    this.settingsStore.setLlmKey(newProviderId, key);
    this.llmKeys.update(k => {
      const updated = { ...k };
      delete updated[oldProviderId];
      updated[newProviderId] = key;
      return updated;
    });

    this.editingKeyProvider.set(null);
    const provider = this.llmProviders().find(p => p.id === newProviderId);
    this.notifications.success(`Key reassigned to ${provider?.name || newProviderId}`);
  }

  private runDetection(key: string): void {
    const result = detectProvider(key, this.llmProviders());

    if (!result) {
      this.detectionState.set({ type: 'unknown' });
      return;
    }

    if (result.confidence === 'exact') {
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

  private saveDetectedKey(providerId: string, key: string): void {
    this.llmKeys.update(keys => ({ ...keys, [providerId]: key }));
    this.settingsStore.setLlmKey(providerId, key);

    const provider = this.llmProviders().find(p => p.id === providerId);
    this.notifications.success(`${provider?.name || providerId} key saved`);

    // Reset input state
    this.newKeyInput.set('');
    this.detectionState.set(null);
  }

  async autoDetect(): Promise<void> {
    this.scanLoading.set(true);
    try {
      const detected = await this.hardwareDetector.detect();
      if (!detected.formatted) {
        this.scanLoading.set(false);
        this.notifications.error('Could not detect hardware. Try pasting your specs manually.');
        return;
      }
      this.hardwareRawText = detected.formatted;
      // Apply CPU cores directly from browser API — more reliable than text parsing
      if (detected.cpuCores) this.cpuCores = detected.cpuCores;
      // Warn when deviceMemory is capped by the browser (8 GB ceiling)
      if (detected.ramCapped) {
        this.notifications.info(
          'RAM shown as 8 GB — browser privacy limits prevent reading true RAM. Use Paste & Scan for accurate results.',
        );
      }
      // Pure-client parse + classify — was POST /api/specs/parse.
      try {
        const response = this.specParser.parseAndClassify(detected.formatted);
        this.scanLoading.set(false);
        this.applyParsedSpecs(response);
        this.notifications.success('Hardware detected successfully');
      } catch {
        this.scanLoading.set(false);
        this.notifications.error('Hardware detected but failed to classify. You can adjust fields manually.');
      }
    } catch {
      this.scanLoading.set(false);
      this.notifications.error('Could not detect hardware. Try pasting your specs manually.');
    }
  }

  copyCommand(): void {
    navigator.clipboard.writeText(this.powershellCommand).then(() => {
      this.commandCopied.set(true);
      setTimeout(() => this.commandCopied.set(false), 2000);
    });
  }

  scanHardware(): void {
    if (!this.hardwareRawText.trim()) return;
    this.scanLoading.set(true);
    // Pure-client parse + classify — was POST /api/specs/parse.
    try {
      const response = this.specParser.parseAndClassify(this.hardwareRawText);
      this.scanLoading.set(false);
      this.applyParsedSpecs(response);
      this.notifications.success('Hardware info scanned successfully');
    } catch {
      this.scanLoading.set(false);
      this.notifications.error('Failed to scan hardware info');
    }
  }

  private applyParsedSpecs(response: any): void {
    if (response.specs) {
      if (response.specs.gpu) this.gpuModel = response.specs.gpu;
      if (response.specs.cpu) this.cpuModel = response.specs.cpu;
      if (response.specs.ram_gb) this.ramGb = response.specs.ram_gb;
      if (response.specs.vram_mb) this.vramGb = Math.round(response.specs.vram_mb / 1024);
      if (response.specs.cpu_cores) this.cpuCores = response.specs.cpu_cores;
      if (response.specs.cpu_speed_ghz) this.cpuSpeedGhz = response.specs.cpu_speed_ghz;
      if (response.specs.storage_drives) {
        this.storageDrives = response.specs.storage_drives;
        this.storageDrivesSignal.set(response.specs.storage_drives);
      }
    }
    if (response.tier) this.hardwareTier = response.tier;
  }

  private loadSettings(): void {
    // Notification prefs are localStorage-only (Plan 3 Task 2). Only the
    // notify-on-complete toggle survives the auth strip — the email-coupled
    // toggles went away with the email delivery path.
    this.notifyOnComplete = this.settingsStore.notifyOnComplete();

    // Hardware-spec persistence — replaces the deleted authService get/save
    // round-trip. Structured fields live in `hardwareSpecs`, raw paste text
    // in `hardwareSpec`, tier in `hardwareTier`.
    const savedSpecs = this.settingsStore.hardwareSpecs();
    if (savedSpecs.gpu) this.gpuModel = savedSpecs.gpu;
    if (savedSpecs.cpu) this.cpuModel = savedSpecs.cpu;
    if (savedSpecs.ram_gb) this.ramGb = savedSpecs.ram_gb;
    if (savedSpecs.vram_mb) this.vramGb = Math.round(savedSpecs.vram_mb / 1024);
    if (savedSpecs.cpu_cores) this.cpuCores = savedSpecs.cpu_cores;
    if (savedSpecs.cpu_speed_ghz) this.cpuSpeedGhz = savedSpecs.cpu_speed_ghz;
    if (savedSpecs.storage_drives) {
      this.storageDrives = savedSpecs.storage_drives;
      this.storageDrivesSignal.set(savedSpecs.storage_drives);
    }
    this.hardwareRawText = this.settingsStore.hardwareSpec();
    this.hardwareTier = this.settingsStore.hardwareTier();
  }

  private loadLlmProviders(): void {
    // Static registry — no backend lookup needed (was GET /settings/llm-providers).
    this.llmProviders.set(LLM_PROVIDERS);
  }

  private loadLlmKeys(): void {
    // Read keys synchronously from SettingsStore (localStorage-backed).
    const keys = this.settingsStore.llmKeys();
    this.llmKeys.set(keys);

    // Restore Ollama URL + model — these have dedicated SettingsStore signals
    // that take precedence over anything legacy ollama keys may carry.
    const ollamaUrl = this.settingsStore.ollamaUrl();
    if (ollamaUrl) {
      this.ollamaUrl.set(ollamaUrl);
    }
    const ollamaModel = this.settingsStore.ollamaModel();
    if (ollamaModel) {
      this.ollamaSelectedModel.set(ollamaModel);
    }
    if (ollamaUrl || keys['ollama']) {
      this.testOllamaConnection();
    }
  }

  saveSettings(): void {
    // Notification prefs — only `notifyOnComplete` survives into the no-auth
    // world (Plan 3 Task 3 stripped the email delivery path).
    this.settingsStore.setNotifyOnComplete(this.notifyOnComplete);

    // Hardware-spec persistence — Task 4 wires this through SettingsStore now
    // that the backend round-trip (auth.saveHardware) is gone. Structured
    // fields are stored as a single `HardwareSpecs` object; the raw paste
    // text and tier label live alongside it for display restoration.
    this.settingsStore.setHardwareSpecs({
      gpu: this.gpuModel || undefined,
      cpu: this.cpuModel || undefined,
      ram_gb: this.ramGb || undefined,
      vram_mb: this.vramGb ? this.vramGb * 1024 : undefined,
      cpu_cores: this.cpuCores ?? undefined,
      cpu_speed_ghz: this.cpuSpeedGhz ?? undefined,
      storage_drives: this.storageDrives || undefined,
    });
    this.settingsStore.setHardwareSpec(this.hardwareRawText);
    this.settingsStore.setHardwareTier(this.hardwareTier);

    // LLM API keys are written to localStorage on every individual edit
    // (saveDetectedKey / deleteKey / reassignKey / Ollama auto-save); the
    // explicit "Save Settings" button just confirms success to the user.
    this.notifications.success('Settings saved successfully');
  }
}
