import { TestBed } from '@angular/core/testing';
import { HardwareDetectorService } from './hardware-detector.service';

describe('HardwareDetectorService', () => {
  let svc: HardwareDetectorService;
  const clean = (raw: string): string =>
    (svc as unknown as { cleanGpuString(r: string): string }).cleanGpuString(raw);

  beforeEach(() => {
    TestBed.configureTestingModule({});
    svc = TestBed.inject(HardwareDetectorService);
  });

  describe('cleanGpuString', () => {
    it('extracts NVIDIA model from ANGLE string', () => {
      expect(
        clean('ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)'),
      ).toBe('NVIDIA GeForce RTX 4070');
    });

    it('extracts AMD model from ANGLE string', () => {
      expect(
        clean('ANGLE (AMD, AMD Radeon RX 7900 XTX Direct3D11 vs_5_0 ps_5_0, D3D11)'),
      ).toBe('AMD Radeon RX 7900 XTX');
    });

    it('extracts Intel Arc model from ANGLE string', () => {
      expect(
        clean('ANGLE (Intel, Intel(R) Arc(TM) A770 Direct3D11 vs_5_0 ps_5_0, D3D11)'),
      ).toBe('Intel(R) Arc(TM) A770');
    });

    it('leaves plain Mesa strings alone', () => {
      expect(clean('Mesa Intel(R) UHD Graphics 630')).toBe('Mesa Intel(R) UHD Graphics 630');
    });
  });

  describe('detect', () => {
    it('keeps CPU cores out of the formatted text but exposes them directly', async () => {
      Object.defineProperty(navigator, 'hardwareConcurrency', { value: 16, configurable: true });
      Object.defineProperty(navigator, 'deviceMemory', { value: 4, configurable: true });
      try {
        const hw = await svc.detect();
        expect(hw.cpuCores).toBe(16);
        expect(hw.formatted.split('\n')).not.toContain('CPU Cores: 16');
        expect(hw.formatted.split('\n').every((l) => /^(GPU|RAM): /.test(l))).toBeTrue();
      } finally {
        delete (navigator as unknown as Record<string, unknown>)['hardwareConcurrency'];
        delete (navigator as unknown as Record<string, unknown>)['deviceMemory'];
      }
    });

    it('formats RAM when deviceMemory is available', async () => {
      Object.defineProperty(navigator, 'deviceMemory', { value: 4, configurable: true });
      try {
        const hw = await svc.detect();
        expect(hw.ramGb).toBe(4);
        expect(hw.ramCapped).toBeFalse();
        expect(hw.formatted).toContain('RAM: 4 GB');
      } finally {
        delete (navigator as unknown as Record<string, unknown>)['deviceMemory'];
      }
    });

    it('flags ramCapped at the 8 GB browser ceiling', async () => {
      Object.defineProperty(navigator, 'deviceMemory', { value: 8, configurable: true });
      try {
        expect((await svc.detect()).ramCapped).toBeTrue();
      } finally {
        delete (navigator as unknown as Record<string, unknown>)['deviceMemory'];
      }
    });
  });
});
