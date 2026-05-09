import { TestBed } from '@angular/core/testing';
import { SpecParserService } from './spec-parser.service';

/**
 * Tests assert against the Python `parse_specs_regex` ground truth
 * (backend/app/services/spec_parser.py) — NOT against the plan's example
 * test stubs, which used renamed fields (`vramGb`/`ramGb`) and CPU
 * fragments without an "AMD" prefix that the Python regex rejects.
 *
 * Field naming follows the existing `HardwareSpecs` model:
 *   vram_mb (megabytes), ram_gb, cpu_cores, cpu_speed_ghz, storage_drives.
 */
describe('SpecParserService', () => {
  let svc: SpecParserService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    svc = TestBed.inject(SpecParserService);
  });

  it('parses a complete modern spec', () => {
    // "AMD" prefix is required by CPU_PATTERNS; the lookup table then
    // fills in cores/speed from "7800x3d".
    const r = svc.parse('RTX 4080 16GB, AMD Ryzen 7 7800X3D, 32GB DDR5');
    expect(r.gpu).toBe('RTX 4080');
    expect(r.cpu).toContain('7800X3D');
    expect(r.ram_gb).toBe(32);
    // VRAM falls back to GPU table: rtx 4080 -> 16 GB = 16384 MB.
    expect(r.vram_mb).toBe(16 * 1024);
    // Inferred from the CPU table (cores 8, boost 5.0 GHz).
    expect(r.cpu_cores).toBe(8);
    expect(r.cpu_speed_ghz).toBe(5.0);
  });

  it('infers VRAM from GPU lookup when not explicit', () => {
    // "RTX 3080" alone has no VRAM keyword; GPU lookup fills 10 GB.
    // (RAM_PATTERNS in the Python source require a "RAM"/"DDR"/"Memory"
    //  prefix — bare "16GB RAM" with digits before the keyword is not
    //  matched. We pick a phrasing the regex actually accepts.)
    const r = svc.parse('RTX 3080, 16GB DDR4');
    expect(r.gpu).toBe('RTX 3080');
    expect(r.vram_mb).toBe(10 * 1024);
    expect(r.ram_gb).toBe(16);
  });

  it('returns undefined for missing fields', () => {
    const r = svc.parse('RTX 4080');
    expect(r.gpu).toBe('RTX 4080');
    expect(r.cpu).toBeUndefined();
    expect(r.ram_gb).toBeUndefined();
    expect(r.cpu_cores).toBeUndefined();
    expect(r.cpu_speed_ghz).toBeUndefined();
    expect(r.storage_drives).toBeUndefined();
  });

  it('handles GTX-era cards (1080 Ti -> 11 GB)', () => {
    const r = svc.parse('GTX 1080 Ti');
    expect(r.gpu).toBe('GTX 1080 Ti');
    // 11 GB in MB.
    expect(r.vram_mb).toBe(11 * 1024);
  });

  it('reads VRAM directly when expressed in MB with GDDR/Video keywords', () => {
    // 12288 MB GDDR6 — matches the "GB|MB GDDR" pattern; >=1024 stays as MB.
    const r = svc.parse('GeForce RTX 4070, 12288 MB GDDR6X');
    expect(r.gpu).toContain('RTX 4070');
    expect(r.vram_mb).toBe(12288);
  });

  it('parses an AMD Radeon spec from the GPU table', () => {
    // Confirms the AMD table path (Radeon RX 7900 XTX -> 24 GB).
    const r = svc.parse('AMD Radeon RX 7900 XTX, AMD Ryzen 9 7950X, 64GB DDR5');
    expect(r.gpu).toContain('RX 7900 XTX');
    expect(r.vram_mb).toBe(24 * 1024);
    expect(r.cpu).toContain('7950X');
    expect(r.ram_gb).toBe(64);
    // CPU table fills in 7950x: 16 cores @ 5.7 GHz.
    expect(r.cpu_cores).toBe(16);
    expect(r.cpu_speed_ghz).toBe(5.7);
  });

  it('explicit cores/speed in text override CPU lookup table', () => {
    // User says "16 cores @ 4.5 GHz" — the regex picks those up first;
    // table inference only fires when fields are still undefined.
    const r = svc.parse('AMD Ryzen 7 7800X3D, 16-core, 4.5 GHz, 32GB DDR5');
    expect(r.cpu_cores).toBe(16); // from text, NOT the table's 8
    expect(r.cpu_speed_ghz).toBe(4.5); // from text, NOT the table's 5.0
  });

  it('extracts MB-expressed RAM and converts to GB', () => {
    // "Total Physical Memory: 32,651 MB" -> ~32 GB after rounding.
    const r = svc.parse('Total Physical Memory: 32,651 MB');
    expect(r.ram_gb).toBe(32);
  });

  it('captures storage drive line', () => {
    const r = svc.parse('Drives: C: 110GB free / 931GB, D: 412GB free / 1863GB');
    expect(r.storage_drives).toBe('C: 110GB free / 931GB, D: 412GB free / 1863GB');
  });

  it('returns an empty result for a non-hardware string', () => {
    const r = svc.parse('Hello world, this has no hardware mentions.');
    expect(r.gpu).toBeUndefined();
    expect(r.cpu).toBeUndefined();
    expect(r.vram_mb).toBeUndefined();
    expect(r.ram_gb).toBeUndefined();
  });
});
