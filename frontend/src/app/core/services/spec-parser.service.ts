import { Injectable } from '@angular/core';
import { HardwareSpecs, SpecsParseResponse, TierScores } from '../../shared/models/specs.model';

/**
 * SpecParserService — TS port of `backend/app/services/spec_parser.py`.
 *
 * Parses freeform hardware spec text (browser auto-detection output, dxdiag
 * dumps, casual one-liners) into a structured `HardwareSpecs`. Pure regex —
 * no LLM fallback in the client port (the Python `parse_specs_llm` path is a
 * server concern; the client uses regex only).
 *
 * Field naming matches `specs.model.ts` (snake_case, vram in MEGABYTES, ram
 * in gigabytes) — consistent with the existing Python contract surfaced via
 * `/api/specs/parse`. The plan's example tests used `vramGb`/`ramGb`; we
 * stuck with the existing model to avoid breaking callers.
 */

// GPU model patterns — ordered most specific to least.
const GPU_PATTERNS: readonly RegExp[] = [
  /(NVIDIA\s+GeForce\s+[A-Z]{2,3}\s+\d{3,4}\s*(?:Ti\s*(?:SUPER)?|SUPER|XT)?)/i,
  /(GeForce\s+[A-Z]{2,3}\s+\d{3,4}\s*(?:Ti\s*(?:SUPER)?|SUPER|XT)?)/i,
  /(AMD\s+Radeon\s+RX\s+\d{3,4}\s*(?:XTX|XT)?)/i,
  /(Radeon\s+RX\s+\d{3,4}\s*(?:XTX|XT)?)/i,
  /(Intel\s+Arc\s+[A-Z]\d{3,4}[A-Z]?)/i,
  // Bare RTX/GTX without GeForce prefix — last so the prefixed forms win.
  /((?:RTX|GTX)\s+\d{3,4}\s*(?:Ti\s*(?:SUPER)?|SUPER)?)/i,
];

// VRAM patterns — explicit "GDDR/VRAM/Video Memory" anchors only.
// A bare "16GB" beside a GPU name will NOT match; the GPU lookup table fills
// it in instead. This mirrors the Python intent.
const VRAM_PATTERNS: readonly RegExp[] = [
  /(\d+)(?:\.\d+)?\s*GB\s*(?:GDDR\d[A-Z]?|VRAM|Video\s*(?:RAM|Memory))/i,
  /(?:VRAM|Video\s*(?:RAM|Memory)|Dedicated\s*(?:GPU|Video)\s*Memory|Total\s*Available\s*Graphics\s*Memory)\s*[:=]?\s*(\d+)(?:\.\d+)?\s*(?:GB|MB)/i,
  /(\d{4,})\s*MB\s*(?:GDDR|VRAM|Video|Dedicated)/i,
  /(?:GDDR\d[A-Z]?)\s*[:=]?\s*(\d+)(?:\.\d+)?\s*(?:GB|MB)/i,
];

// CPU model patterns.
const CPU_PATTERNS: readonly RegExp[] = [
  /(Intel\s+Core\s+(?:Ultra\s+)?\d?\s*i\d[- ]\d{4,5}[A-Z]{0,3})/i,
  /(Intel\s+Core\s+i\d[- ]\d{4,5}[A-Z]{0,3})/i,
  /(AMD\s+Ryzen\s+\d\s+\d{4}X?\d?[A-Z]*(?:\s*3D)?)/i,
  /(Intel\s+Core\s+Ultra\s+\d\s+\d{3}[A-Z]?)/i,
  /(AMD\s+Ryzen\s+\d\s+\d{3,4}[A-Z]*)/i,
  // System-info "Processor: ..." lines — last as a coarse fallback.
  /(?:Processor|CPU)\s*[:=]?\s*(.+?)(?:\s*@|\s*\d+\.\d+\s*GHz|\n|$)/i,
];

// RAM patterns — most specific first; lookbehinds avoid VRAM/GDDR collisions.
const RAM_PATTERNS: readonly RegExp[] = [
  /(?:System\s*Memory|System\s*RAM)\s*[:=]?\s*(\d{1,3})(?:\.\d+)?\s*GB/i,
  /(\d{1,3})\s*GB\s*DDR\d/i,
  /(?<!V)(?:RAM)\s*[:=]?\s*(\d{1,3})(?:\.\d+)?\s*GB/i,
  /(?:Installed\s*(?:Physical\s*)?Memory|Total\s*Physical\s*Memory)\s*(?:\(RAM\))?\s*[:=]?\s*(\d{1,3})(?:[.,]\d+)?\s*GB/i,
  /(?<!Video\s)(?<!GPU\s)(?<!Dedicated\s)Memory\s*(?:\(RAM\))?\s*[:=]?\s*(\d[\d,]{3,6})\s*MB/i,
  /(?<!Video\s)(?<!GPU\s)(?<!Dedicated\s)Memory\s*[:=]?\s*(\d{1,3})(?:\.\d+)?\s*GB/i,
  /(\d{1,3})\s*GB\s*(?:installed|total|physical|usable)/i,
];

// CPU core count patterns.
const CPU_CORE_PATTERNS: readonly RegExp[] = [
  /(\d{1,2})\s*-?\s*[Cc]ore/i,
  /(\d{1,2})\s*[Cc]ores/i,
  /(\d{1,2})\s*C\s*\/\s*\d{1,2}\s*T/i, // "8C/16T"
  /[Cc]ores?\s*[:=]?\s*(\d{1,2})/i,
  /(\d{1,2})\s*(?:physical\s+)?(?:cores|processors)/i,
];

// CPU speed patterns.
const CPU_SPEED_PATTERNS: readonly RegExp[] = [
  /(\d+\.\d+)\s*GHz/i,
  /(?:Base|Boost|Clock|Speed|Frequency)\s*[:=]?\s*(\d+\.\d+)\s*GHz/i,
  /@\s*(\d+\.\d+)\s*GHz/i,
];

// Storage drive line — captures everything after "Drives:" until newline.
const DRIVE_PATTERN = /[Dd]rives?\s*[:=]?\s*(.+)/;

/**
 * GPU model -> VRAM in MB. Used to infer VRAM when text has a GPU name but
 * no explicit VRAM value (the typical browser-WebGL detection case). Keys
 * are lowercased; lookup is longest-key-wins so "rtx 4070 ti super" beats
 * "rtx 4070".
 */
const GPU_VRAM_TABLE: Readonly<Record<string, number>> = {
  // NVIDIA RTX 50 series
  'rtx 5090': 32 * 1024,
  'rtx 5080': 16 * 1024,
  'rtx 5070 ti': 16 * 1024,
  'rtx 5070': 12 * 1024,
  'rtx 5060 ti': 16 * 1024,
  'rtx 5060': 8 * 1024,
  // NVIDIA RTX 40 series
  'rtx 4090': 24 * 1024,
  'rtx 4080 super': 16 * 1024,
  'rtx 4080': 16 * 1024,
  'rtx 4070 ti super': 16 * 1024,
  'rtx 4070 ti': 12 * 1024,
  'rtx 4070 super': 12 * 1024,
  'rtx 4070': 12 * 1024,
  'rtx 4060 ti': 8 * 1024,
  'rtx 4060': 8 * 1024,
  // NVIDIA RTX 30 series
  'rtx 3090 ti': 24 * 1024,
  'rtx 3090': 24 * 1024,
  'rtx 3080 ti': 12 * 1024,
  'rtx 3080': 10 * 1024,
  'rtx 3070 ti': 8 * 1024,
  'rtx 3070': 8 * 1024,
  'rtx 3060 ti': 8 * 1024,
  'rtx 3060': 12 * 1024,
  'rtx 3050': 8 * 1024,
  // NVIDIA RTX 20 series
  'rtx 2080 ti': 11 * 1024,
  'rtx 2080 super': 8 * 1024,
  'rtx 2080': 8 * 1024,
  'rtx 2070 super': 8 * 1024,
  'rtx 2070': 8 * 1024,
  'rtx 2060 super': 8 * 1024,
  'rtx 2060': 6 * 1024,
  // NVIDIA GTX 16 series
  'gtx 1660 ti': 6 * 1024,
  'gtx 1660 super': 6 * 1024,
  'gtx 1660': 6 * 1024,
  'gtx 1650 super': 4 * 1024,
  'gtx 1650': 4 * 1024,
  // NVIDIA GTX 10 series
  'gtx 1080 ti': 11 * 1024,
  'gtx 1080': 8 * 1024,
  'gtx 1070 ti': 8 * 1024,
  'gtx 1070': 8 * 1024,
  'gtx 1060': 6 * 1024,
  'gtx 1050 ti': 4 * 1024,
  'gtx 1050': 2 * 1024,
  // AMD RX 9000 series
  'rx 9070 xt': 16 * 1024,
  'rx 9070': 16 * 1024,
  // AMD RX 7000 series
  'rx 7900 xtx': 24 * 1024,
  'rx 7900 xt': 20 * 1024,
  'rx 7900 gre': 16 * 1024,
  'rx 7800 xt': 16 * 1024,
  'rx 7700 xt': 12 * 1024,
  'rx 7600 xt': 16 * 1024,
  'rx 7600': 8 * 1024,
  // AMD RX 6000 series
  'rx 6950 xt': 16 * 1024,
  'rx 6900 xt': 16 * 1024,
  'rx 6800 xt': 16 * 1024,
  'rx 6800': 16 * 1024,
  'rx 6750 xt': 12 * 1024,
  'rx 6700 xt': 12 * 1024,
  'rx 6650 xt': 8 * 1024,
  'rx 6600 xt': 8 * 1024,
  'rx 6600': 8 * 1024,
  'rx 6500 xt': 4 * 1024,
  // AMD RX 5000 series
  'rx 5700 xt': 8 * 1024,
  'rx 5700': 8 * 1024,
  'rx 5600 xt': 6 * 1024,
  'rx 5500 xt': 8 * 1024,
  // Intel Arc
  'arc b580': 12 * 1024,
  'arc a770': 16 * 1024,
  'arc a750': 8 * 1024,
  'arc a580': 8 * 1024,
  'arc a380': 6 * 1024,
};

/**
 * CPU model -> { cores, speed_ghz }. Used to infer CPU specs when the text
 * has a CPU name but no explicit core/speed values. User-provided values
 * always take priority over table values.
 */
interface CpuTableRow {
  readonly cores: number;
  readonly speed_ghz: number;
}

const CPU_SPECS_TABLE: Readonly<Record<string, CpuTableRow>> = {
  // AMD Ryzen — 3D V-Cache
  '7800x3d': { cores: 8, speed_ghz: 5.0 },
  '9800x3d': { cores: 8, speed_ghz: 5.2 },
  // AMD Ryzen 9000 / 7000 / 5000
  '9950x': { cores: 16, speed_ghz: 5.7 },
  '9900x': { cores: 12, speed_ghz: 5.6 },
  '7950x': { cores: 16, speed_ghz: 5.7 },
  '7900x': { cores: 12, speed_ghz: 5.6 },
  '7700x': { cores: 8, speed_ghz: 5.4 },
  '5800x3d': { cores: 8, speed_ghz: 4.5 },
  '5800x': { cores: 8, speed_ghz: 4.7 },
  '5600x': { cores: 6, speed_ghz: 4.6 },
  '5600': { cores: 6, speed_ghz: 4.4 },
  // Intel 14th / 13th / 12th gen
  '14900k': { cores: 24, speed_ghz: 6.0 },
  '14700k': { cores: 20, speed_ghz: 5.6 },
  '14600k': { cores: 14, speed_ghz: 5.3 },
  '13900k': { cores: 24, speed_ghz: 5.8 },
  '13700k': { cores: 16, speed_ghz: 5.4 },
  '13600k': { cores: 14, speed_ghz: 5.1 },
  '12900k': { cores: 16, speed_ghz: 5.2 },
  '12700k': { cores: 12, speed_ghz: 5.0 },
  '12600k': { cores: 10, speed_ghz: 4.9 },
  '12400f': { cores: 6, speed_ghz: 4.4 },
  // Intel Core Ultra
  'ultra 9 285k': { cores: 24, speed_ghz: 5.7 },
  'ultra 7 265k': { cores: 20, speed_ghz: 5.5 },
  'ultra 5 245k': { cores: 14, speed_ghz: 5.2 },
};

// ---------------------------------------------------------------------------
// Tier classification — mirrors `backend/app/services/tier_classifier.py`.
// Scores GPU generation, VRAM, CPU, RAM into a 0-100 overall and maps to
// a tier name. Front-end normalizes per-axis scores to a 0-5 scale to match
// the existing `SpecsParseResponse.tier_scores` UI (see specs.model.ts).
// ---------------------------------------------------------------------------

const NVIDIA_GENS: readonly [RegExp, number][] = [
  [/(?:RTX\s*)?50\d{2}/i, 25],
  [/(?:RTX\s*)?40\d{2}/i, 23],
  [/(?:RTX\s*)?30\d{2}/i, 20],
  [/(?:RTX\s*)?20\d{2}/i, 15],
  [/GTX\s*16\d{2}/i, 12],
  [/GTX\s*10\d{2}/i, 10],
  [/GTX\s*9\d{2}/i, 5],
];
const AMD_GENS: readonly [RegExp, number][] = [
  [/RX\s*9\d{3}/i, 25],
  [/RX\s*7\d{3}/i, 23],
  [/RX\s*6\d{3}/i, 20],
  [/RX\s*5\d{3}/i, 15],
  [/RX\s*[45]\d{2}/i, 8],
];
const ARC_GENS: readonly [RegExp, number][] = [
  [/Arc\s*B\d{3}/i, 20],
  [/Arc\s*A\d{3}/i, 15],
];

function scoreGpuGeneration(gpu?: string): number {
  if (!gpu) return 0;
  for (const set of [NVIDIA_GENS, AMD_GENS, ARC_GENS]) {
    for (const [pattern, score] of set) {
      if (pattern.test(gpu)) return score;
    }
  }
  return 5;
}

function scoreVram(vramMb?: number): number {
  if (!vramMb) return 0;
  const gb = vramMb / 1024;
  if (gb >= 16) return 30;
  if (gb >= 12) return 27;
  if (gb >= 8) return 23;
  if (gb >= 6) return 18;
  if (gb >= 4) return 12;
  return 5;
}

const CPU_FAMILY_CORES: readonly [RegExp, number][] = [
  [/Ryzen\s*5\s*[79]6\d{2}/i, 6],
  [/Ryzen\s*7\s*[79][78]\d{2}/i, 8],
  [/Ryzen\s*9\s*[79]950/i, 16],
  [/Ryzen\s*9\s*[79]900/i, 12],
  [/Core\s*i5-1[34]6\d{2}/i, 14],
  [/Core\s*i7-1[34]7\d{2}/i, 20],
  [/Core\s*i9-1[34]9\d{2}/i, 24],
  [/Ultra\s*5\s*245K?/i, 14],
  [/Ultra\s*7\s*265K?/i, 20],
  [/Ultra\s*9\s*285K?/i, 24],
];
function inferCoresFromModel(cpu?: string): number | undefined {
  if (!cpu) return undefined;
  for (const [pattern, cores] of CPU_FAMILY_CORES) {
    if (pattern.test(cpu)) return cores;
  }
  return undefined;
}

function scoreCpu(cpu?: string, cores?: number, speedGhz?: number): number {
  let score = 0;
  const effectiveCores = cores ?? inferCoresFromModel(cpu);
  if (effectiveCores !== undefined) {
    if (effectiveCores >= 16) score = 18;
    else if (effectiveCores >= 12) score = 15;
    else if (effectiveCores >= 8) score = 12;
    else if (effectiveCores >= 6) score = 8;
    else if (effectiveCores >= 4) score = 5;
    else score = 2;
  }
  if (speedGhz !== undefined) {
    if (speedGhz >= 5.0) score += 4;
    else if (speedGhz >= 4.5) score += 3;
    else if (speedGhz >= 4.0) score += 2;
    else if (speedGhz >= 3.5) score += 1;
  }
  if (cpu) {
    const highPerf = [
      '7800X3D', '7950X3D', '7950X', '7900X', '7900',
      '9800X3D', '9950X', '9900X', '9700X',
      '14900K', '13900K', '12900K', '14700K', '13700K',
      'Ultra 9 285', 'Ultra 7 265', 'Ultra 9', 'Ultra 7',
    ];
    const lower = cpu.toLowerCase();
    if (highPerf.some((m) => lower.includes(m.toLowerCase()))) score += 3;
  }
  return Math.min(score, 25);
}

function scoreRam(ramGb?: number): number {
  if (!ramGb) return 0;
  if (ramGb >= 64) return 20;
  if (ramGb >= 32) return 17;
  if (ramGb >= 16) return 12;
  if (ramGb >= 8) return 5;
  return 2;
}

function tierFromScore(overall: number): string {
  if (overall >= 76) return 'ultra';
  if (overall >= 56) return 'high';
  if (overall >= 31) return 'mid';
  return 'low';
}

@Injectable({ providedIn: 'root' })
export class SpecParserService {
  /**
   * Parse hardware specs from freeform text. Mirrors `parse_specs_regex`
   * in the Python source. Returns a `HardwareSpecs` whose unfound fields
   * are `undefined` (TS analogue of Python's `None`).
   */
  parse(rawText: string): HardwareSpecs {
    const gpu = this.firstMatch(rawText, GPU_PATTERNS);
    let vramMb = this.parseVram(rawText);

    // GPU known but VRAM not in text -> infer from lookup table.
    if (gpu && vramMb === undefined) {
      vramMb = this.inferVramFromGpu(gpu);
    }

    const cpu = this.firstMatch(rawText, CPU_PATTERNS);
    let cores = this.parseCpuCores(rawText);
    let speed = this.parseCpuSpeed(rawText);

    // CPU known but cores/speed not explicit -> consult lookup table.
    if (cpu && (cores === undefined || speed === undefined)) {
      [cores, speed] = this.inferCpuSpecs(cpu, cores, speed);
    }

    const specs: HardwareSpecs = {};
    if (gpu !== undefined) specs.gpu = gpu;
    if (vramMb !== undefined) specs.vram_mb = vramMb;
    if (cpu !== undefined) specs.cpu = cpu;
    const ramGb = this.parseRam(rawText);
    if (ramGb !== undefined) specs.ram_gb = ramGb;
    if (cores !== undefined) specs.cpu_cores = cores;
    if (speed !== undefined) specs.cpu_speed_ghz = speed;
    const drives = this.parseDrives(rawText);
    if (drives !== undefined) specs.storage_drives = drives;
    return specs;
  }

  /**
   * Parse + tier-classify in one call, returning the same `SpecsParseResponse`
   * shape the deleted `/api/specs/parse` endpoint produced.
   *
   * Per-axis scores are normalized to a 0-5 scale to match the existing UI's
   * progress bars (`tier_scores!.vram * 20` for percentage). The tier name
   * (`low`/`mid`/`high`/`ultra`) is derived from the raw 0-100 sum, NOT from
   * the normalized scores — keeps the bucket boundaries stable across the
   * normalization step.
   */
  parseAndClassify(rawText: string): SpecsParseResponse {
    const specs = this.parse(rawText);

    const vramScore = scoreVram(specs.vram_mb);
    const gpuGenScore = scoreGpuGeneration(specs.gpu);
    const cpuScore = scoreCpu(specs.cpu, specs.cpu_cores, specs.cpu_speed_ghz);
    const ramScore = scoreRam(specs.ram_gb);
    const overall = vramScore + gpuGenScore + cpuScore + ramScore;

    const tier = tierFromScore(overall);
    const tierScores: TierScores = {
      vram: Math.round((vramScore / 30) * 5 * 10) / 10,
      cpu: Math.round((cpuScore / 25) * 5 * 10) / 10,
      ram: Math.round((ramScore / 20) * 5 * 10) / 10,
      gpu_gen: Math.round((gpuGenScore / 25) * 5 * 10) / 10,
      overall: Math.round((overall / 100) * 5 * 10) / 10,
    };

    return {
      specs,
      raw_text: rawText,
      parse_method: 'regex',
      tier,
      tier_scores: tierScores,
    };
  }

  // --- private helpers -----------------------------------------------------

  private firstMatch(text: string, patterns: readonly RegExp[]): string | undefined {
    for (const pattern of patterns) {
      const m = pattern.exec(text);
      if (m) return m[1].trim();
    }
    return undefined;
  }

  private parseVram(text: string): number | undefined {
    for (const pattern of VRAM_PATTERNS) {
      const m = pattern.exec(text);
      if (m) {
        const value = parseInt(m[1], 10);
        // Heuristic: values >=1024 are already in MB, smaller values are GB.
        return value >= 1024 ? value : value * 1024;
      }
    }
    return undefined;
  }

  private parseRam(text: string): number | undefined {
    for (const pattern of RAM_PATTERNS) {
      const m = pattern.exec(text);
      if (m) {
        const raw = m[1].replace(/,/g, '');
        const value = parseInt(raw, 10);
        // 32768 MB -> 32 GB. Round to nearest int.
        return value >= 1024 ? Math.round(value / 1024) : value;
      }
    }
    return undefined;
  }

  private parseCpuCores(text: string): number | undefined {
    for (const pattern of CPU_CORE_PATTERNS) {
      const m = pattern.exec(text);
      if (m) {
        const cores = parseInt(m[1], 10);
        if (cores >= 1 && cores <= 128) return cores;
      }
    }
    return undefined;
  }

  private parseCpuSpeed(text: string): number | undefined {
    for (const pattern of CPU_SPEED_PATTERNS) {
      const m = pattern.exec(text);
      if (m) {
        const speed = parseFloat(m[1]);
        if (speed >= 0.5 && speed <= 8.0) return speed;
      }
    }
    return undefined;
  }

  private parseDrives(text: string): string | undefined {
    const m = DRIVE_PATTERN.exec(text);
    return m ? m[1].trim() : undefined;
  }

  private inferVramFromGpu(gpuName: string): number | undefined {
    if (!gpuName) return undefined;
    const lower = gpuName.toLowerCase();
    // Longest key first so e.g. "rtx 4070 ti super" wins over "rtx 4070".
    const keys = Object.keys(GPU_VRAM_TABLE).sort((a, b) => b.length - a.length);
    for (const key of keys) {
      if (lower.includes(key)) return GPU_VRAM_TABLE[key];
    }
    return undefined;
  }

  private inferCpuSpecs(
    cpuName: string,
    cores: number | undefined,
    speed: number | undefined,
  ): [number | undefined, number | undefined] {
    if (!cpuName) return [cores, speed];
    const lower = cpuName.toLowerCase();
    const keys = Object.keys(CPU_SPECS_TABLE).sort((a, b) => b.length - a.length);
    for (const key of keys) {
      if (lower.includes(key)) {
        const row = CPU_SPECS_TABLE[key];
        if (cores === undefined) cores = row.cores;
        if (speed === undefined) speed = row.speed_ghz;
        break;
      }
    }
    return [cores, speed];
  }
}
