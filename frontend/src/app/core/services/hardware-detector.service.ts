import { Injectable } from '@angular/core';

export interface DetectedHardware {
  gpu: string | null;
  cpuCores: number | null;
  ramGb: number | null;
  /** True when ramGb is capped by browser privacy (deviceMemory tops out at 8 GB). */
  ramCapped: boolean;
  formatted: string;
}

@Injectable({ providedIn: 'root' })
export class HardwareDetectorService {
  /**
   * Detect hardware using browser APIs (WebGL, Navigator).
   * Returns whatever the browser can provide — GPU is the most reliable.
   */
  async detect(): Promise<DetectedHardware> {
    const gpu = this.detectGpu();
    const cpuCores = navigator.hardwareConcurrency || null;
    // deviceMemory is a Chrome-only API not in all TypeScript lib definitions
    const ramGb = ('deviceMemory' in navigator ? (navigator.deviceMemory as number) : null) || null;
    // deviceMemory caps at 8 GB for browser privacy — flag when we hit the ceiling
    const ramCapped = ramGb !== null && ramGb >= 8;

    // Only include GPU and RAM in the formatted text sent to the backend parser.
    // CPU Cores must NOT be included here — the CPU_PATTERNS regex would match
    // "CPU Cores: 16" and misidentify it as the CPU model name (Bug #10).
    // cpuCores is still available directly on this object for the settings component.
    const lines: string[] = [];
    if (gpu) lines.push(`GPU: ${gpu}`);
    if (ramGb) lines.push(`RAM: ${ramGb} GB`);

    return {
      gpu,
      cpuCores,
      ramGb,
      ramCapped,
      formatted: lines.join('\n'),
    };
  }

  private detectGpu(): string | null {
    // Try WebGL debug renderer info
    try {
      const canvas = document.createElement('canvas');
      const gl =
        canvas.getContext('webgl2') ||
        canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl');

      if (gl && (gl instanceof WebGLRenderingContext || gl instanceof WebGL2RenderingContext)) {
        const ext = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
        if (ext) {
          const renderer = (gl as WebGLRenderingContext).getParameter(ext.UNMASKED_RENDERER_WEBGL);
          if (renderer) {
            return this.cleanGpuString(renderer);
          }
        }
      }
    } catch {
      // WebGL not available
    }

    return null;
  }

  /**
   * Clean the raw WebGL renderer string to extract just the GPU model.
   * Raw strings look like:
   *   "ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)"
   *   "ANGLE (AMD, AMD Radeon RX 7900 XTX Direct3D11 vs_5_0 ps_5_0, D3D11)"
   *   "ANGLE (Intel, Intel(R) Arc(TM) A770 Direct3D11 vs_5_0 ps_5_0, D3D11)"
   *   "Mesa Intel(R) UHD Graphics 630"
   */
  private cleanGpuString(raw: string): string {
    // Extract from ANGLE(...) format — take the second comma-separated part
    const angleMatch = raw.match(/ANGLE\s*\([^,]+,\s*(.+?)(?:\s+Direct3D|\s+OpenGL|\s*,)/i);
    if (angleMatch) {
      return angleMatch[1].trim();
    }

    // Strip common prefixes/suffixes
    let cleaned = raw
      .replace(/^ANGLE\s*\(\s*/, '')
      .replace(/\)\s*$/, '')
      .replace(/Direct3D\d*\s*vs_\d+_\d+\s*ps_\d+_\d+/i, '')
      .replace(/D3D\d+/i, '')
      .replace(/OpenGL.*$/i, '')
      .replace(/,\s*$/, '')
      .trim();

    // If still has vendor prefix like "NVIDIA, NVIDIA GeForce RTX 4070", take after last comma
    const parts = cleaned.split(',');
    if (parts.length > 1) {
      cleaned = parts[parts.length - 1].trim();
    }

    return cleaned || raw;
  }
}
