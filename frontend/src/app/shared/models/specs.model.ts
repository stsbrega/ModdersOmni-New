export interface HardwareSpecs {
  gpu?: string;
  vram_mb?: number;
  cpu?: string;
  ram_gb?: number;
  cpu_cores?: number;
  cpu_speed_ghz?: number;
  storage_drives?: string;
}

export interface TierScores {
  vram: number;
  cpu: number;
  ram: number;
  gpu_gen: number;
  overall: number;
}

export interface SpecsParseResponse {
  specs: HardwareSpecs;
  raw_text: string;
  parse_method: string;
  tier?: string;
  tier_scores?: TierScores;
}
