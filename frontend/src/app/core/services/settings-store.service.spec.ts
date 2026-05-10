import { TestBed } from '@angular/core/testing';
import { SettingsStore } from './settings-store.service';

describe('SettingsStore', () => {
  let svc: SettingsStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    svc = TestBed.inject(SettingsStore);
  });

  it('llmKeys() defaults to empty record', () => {
    expect(svc.llmKeys()).toEqual({});
  });

  it('setLlmKey persists and updates the signal', () => {
    svc.setLlmKey('gemini', 'AIza-fake');
    expect(svc.llmKeys()['gemini']).toBe('AIza-fake');
    // Re-read from a fresh inject to confirm persistence
    const svc2 = TestBed.inject(SettingsStore);
    // setting in same TestBed reuses the singleton; instead read raw localStorage
    expect(JSON.parse(localStorage.getItem('settings.llmKeys') ?? '{}').gemini).toBe('AIza-fake');
  });

  it('removeLlmKey deletes the entry', () => {
    svc.setLlmKey('gemini', 'AIza-fake');
    svc.removeLlmKey('gemini');
    expect(svc.llmKeys()['gemini']).toBeUndefined();
  });

  it('hardwareSpec() defaults to empty string and round-trips', () => {
    expect(svc.hardwareSpec()).toBe('');
    svc.setHardwareSpec('RTX 4080 16GB, Ryzen 7 7800X3D, 32GB DDR5');
    expect(svc.hardwareSpec()).toContain('7800X3D');
  });

  it('storageDrives() defaults to empty array and round-trips', () => {
    expect(svc.storageDrives()).toEqual([]);
    svc.setStorageDrives([{ drive: 'C', free_gb: 800 }]);
    expect(svc.storageDrives()[0].drive).toBe('C');
  });

  it('clearAll wipes every settings.* key', () => {
    svc.setLlmKey('gemini', 'AIza-fake');
    svc.setHardwareSpec('test');
    svc.clearAll();
    expect(svc.llmKeys()).toEqual({});
    expect(svc.hardwareSpec()).toBe('');
  });
});
