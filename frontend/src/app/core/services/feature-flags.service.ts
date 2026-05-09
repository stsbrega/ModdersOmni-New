import { Injectable, signal, WritableSignal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class FeatureFlagsService {
  readonly useClientPipeline: WritableSignal<boolean>;

  constructor() {
    const stored = localStorage.getItem('feature.useClientPipeline') === 'true';
    this.useClientPipeline = signal(stored);
  }

  setUseClientPipeline(value: boolean): void {
    localStorage.setItem('feature.useClientPipeline', String(value));
    this.useClientPipeline.set(value);
  }
}
