import { Injectable, signal, WritableSignal } from '@angular/core';

export interface StorageDrive { drive: string; free_gb: number; }

const KEYS = {
  llmKeys: 'settings.llmKeys',
  hardwareSpec: 'settings.hardwareSpec',
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
  readonly hardwareSpec: WritableSignal<string>;
  readonly storageDrives: WritableSignal<StorageDrive[]>;
  readonly ollamaUrl: WritableSignal<string>;
  readonly ollamaModel: WritableSignal<string>;
  readonly notifyOnComplete: WritableSignal<boolean>;

  constructor() {
    this.llmKeys = signal(readJson(KEYS.llmKeys, {} as Record<string, string>));
    this.hardwareSpec = signal(readJson(KEYS.hardwareSpec, ''));
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
    this.storageDrives.set([]);
    this.ollamaUrl.set('http://localhost:11434');
    this.ollamaModel.set('');
    this.notifyOnComplete.set(false);
  }
}
