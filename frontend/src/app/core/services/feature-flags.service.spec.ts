import { TestBed } from '@angular/core/testing';
import { FeatureFlagsService } from './feature-flags.service';

describe('FeatureFlagsService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  it('useClientPipeline defaults to false when not set', () => {
    const svc = TestBed.inject(FeatureFlagsService);
    expect(svc.useClientPipeline()).toBe(false);
  });

  it('reads useClientPipeline from localStorage', () => {
    localStorage.setItem('feature.useClientPipeline', 'true');
    const svc = TestBed.inject(FeatureFlagsService);
    expect(svc.useClientPipeline()).toBe(true);
  });

  it('setUseClientPipeline persists to localStorage and updates the signal', () => {
    const svc = TestBed.inject(FeatureFlagsService);
    svc.setUseClientPipeline(true);
    expect(localStorage.getItem('feature.useClientPipeline')).toBe('true');
    expect(svc.useClientPipeline()).toBe(true);

    svc.setUseClientPipeline(false);
    expect(localStorage.getItem('feature.useClientPipeline')).toBe('false');
    expect(svc.useClientPipeline()).toBe(false);
  });
});
