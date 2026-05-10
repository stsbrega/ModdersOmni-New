import { Injectable, signal, WritableSignal } from '@angular/core';
import { HardwareSpecs } from '../../shared/models/specs.model';

export interface StorageDrive { drive: string; free_gb: number; }

const KEYS = {
  llmKeys: 'settings.llmKeys',
  hardwareSpec: 'settings.hardwareSpec',
  hardwareSpecs: 'settings.hardwareSpecs',
  hardwareTier: 'settings.hardwareTier',
  storageDrives: 'settings.storageDrives',
  ollamaUrl: 'settings.ollamaUrl',
  ollamaModel: 'settings.ollamaModel',
  notifyOnComplete: 'settings.notifyOnComplete',
} as const;

function readJson<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

@Injectable({ providedIn: 'root' })
export class SettingsStore {
  readonly llmKeys: WritableSignal<Record<string, string>>;
  /** Raw freeform hardware text (paste output). Kept for backwards compat. */
  readonly hardwareSpec: WritableSignal<string>;
  /**
   * Structured hardware specs (gpu / vram_mb / cpu / ram_gb / cpu_cores /
   * cpu_speed_ghz / storage_drives). Replaces the deleted
   * `auth.getHardware/saveHardware` round-trip — fields persist locally now.
   */
  readonly hardwareSpecs: WritableSignal<HardwareSpecs>;
  /** Tier label (low/mid/high/ultra) — cached from the last classify call. */
  readonly hardwareTier: WritableSignal<string>;
  readonly storageDrives: WritableSignal<StorageDrive[]>;
  readonly ollamaUrl: WritableSignal<string>;
  readonly ollamaModel: WritableSignal<string>;
  readonly notifyOnComplete: WritableSignal<boolean>;

  constructor() {
    this.llmKeys = signal(readJson(KEYS.llmKeys, {} as Record<string, string>));
    this.hardwareSpec = signal(readJson(KEYS.hardwareSpec, ''));
    this.hardwareSpecs = signal(readJson(KEYS.hardwareSpecs, {} as HardwareSpecs));
    this.hardwareTier = signal(readJson(KEYS.hardwareTier, ''));
    this.storageDrives = signal(readJson(KEYS.storageDrives, [] as StorageDrive[]));
    this.ollamaUrl = signal(readJson(KEYS.ollamaUrl, 'http://localhost:11434'));
    this.ollamaModel = signal(readJson(KEYS.ollamaModel, ''));
    this.notifyOnComplete = signal(readJson(KEYS.notifyOnComplete, false));
  }

  setLlmKey(provider: string, key: string): void {
    const next = { ...this.llmKeys(), [provider]: key };
    localStorage.setItem(KEYS.llmKeys, JSON.stringify(next));
    this.llmKeys.set(next);
  }

  removeLlmKey(provider: string): void {
    const next = { ...this.llmKeys() };
    delete next[provider];
    localStorage.setItem(KEYS.llmKeys, JSON.stringify(next));
    this.llmKeys.set(next);
  }

  setHardwareSpec(value: string): void {
    localStorage.setItem(KEYS.hardwareSpec, JSON.stringify(value));
    this.hardwareSpec.set(value);
  }

  setHardwareSpecs(value: HardwareSpecs): void {
    localStorage.setItem(KEYS.hardwareSpecs, JSON.stringify(value));
    this.hardwareSpecs.set(value);
  }

  setHardwareTier(value: string): void {
    localStorage.setItem(KEYS.hardwareTier, JSON.stringify(value));
    this.hardwareTier.set(value);
  }

  setStorageDrives(value: StorageDrive[]): void {
    localStorage.setItem(KEYS.storageDrives, JSON.stringify(value));
    this.storageDrives.set(value);
  }

  setOllamaUrl(value: string): void {
    localStorage.setItem(KEYS.ollamaUrl, JSON.stringify(value));
    this.ollamaUrl.set(value);
  }

  setOllamaModel(value: string): void {
    localStorage.setItem(KEYS.ollamaModel, JSON.stringify(value));
    this.ollamaModel.set(value);
  }

  setNotifyOnComplete(value: boolean): void {
    localStorage.setItem(KEYS.notifyOnComplete, JSON.stringify(value));
    this.notifyOnComplete.set(value);
  }

  clearAll(): void {
    for (const key of Object.values(KEYS)) localStorage.removeItem(key);
    this.llmKeys.set({});
    this.hardwareSpec.set('');
    this.hardwareSpecs.set({});
    this.hardwareTier.set('');
    this.storageDrives.set([]);
    this.ollamaUrl.set('http://localhost:11434');
    this.ollamaModel.set('');
    this.notifyOnComplete.set(false);
  }
}
