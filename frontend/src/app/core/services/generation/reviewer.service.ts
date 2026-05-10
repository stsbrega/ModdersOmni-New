/**
 * Per-phase + comprehensive overseer reviewer.
 *
 * Faithful TS port of `backend/app/services/generation/reviewer.py`. The
 * reviewer runs an INDEPENDENT LLM pass after each generation phase (and once
 * more at the end) to catch stability, compatibility, and theme-fit issues
 * the discovery pass may have missed.
 *
 * Plan deviations (verified against Python ground truth):
 *   - Plan said the verdict format is `VERDICT: APPROVE` / `VERDICT: REJECT`.
 *     Python ACTUALLY emits and parses **JSON** with `approved/flagged/rejected`
 *     arrays. We mirror that protocol verbatim.
 *   - Plan's `parseVerdict()` regex is a guess — replaced by a real
 *     markdown-fence stripper + `JSON.parse` (matches Python's
 *     `_parse_review_response`).
 *   - Plan's "fail-closed reject on malformed JSON" is wrong. Python returns
 *     `ReviewResult(skipped=true)` — i.e., do nothing, leave mods in place.
 *     The prompt explicitly states "false rejections are worse than false
 *     approvals," so the safer fallback is to skip the review entirely.
 *   - Python has TWO entry points: `review_phase` (per-phase, JSON output)
 *     AND `review_comprehensive` (final holistic review, different JSON
 *     shape). Both ported.
 *   - Reviewer dependency: Python uses an internal `LLMProvider` resolved
 *     from settings (Gemini Pro fallback). In TS the orchestrator passes an
 *     `LLMConfig` directly so the dispatcher can route per spec Decision 5.
 *
 * Plan 1 Task 12.
 */
import { Injectable, inject } from '@angular/core';

import { LLMDispatcherService } from '../llm/dispatcher.service';
import type { LLMConfig } from '../llm/types';
import type {
  GenerationSessionSnapshot,
  KnowledgeFlag,
  ReviewFlag,
  SessionModEntry,
} from './types';

// ─────────────────────────────────────────────────────────────────────
// Result types — direct analogs of Python @dataclass ReviewResult /
// ComprehensiveReviewResult in reviewer.py.
// ─────────────────────────────────────────────────────────────────────

export interface ReviewResult {
  approved: number[];
  flagged: ReviewFlag[];
  rejected: ReviewFlag[];
  /** True if review was skipped (no key, parse error, network failure, etc.). */
  skipped: boolean;
}

export interface ComprehensiveReviewResult {
  cross_phase_conflicts: KnowledgeFlag[];
  vram_assessment: Record<string, unknown>;
  load_order_issues: KnowledgeFlag[];
  theme_coherence: Record<string, unknown>;
  missing_essentials: string[];
  rejected: ReviewFlag[];
  skipped: boolean;
}

export interface ReviewPhaseArgs {
  snapshot: GenerationSessionSnapshot;
  phaseName: string;
  gameName: string;
  gameVersion: string | null | undefined;
  playstyleName: string;
  hardwareContext: string;
  /** nexus_mod_ids that existed BEFORE this phase ran. */
  prePhaseModIds: Set<number>;
  overseerConfig: LLMConfig;
}

export interface ReviewComprehensiveArgs {
  snapshot: GenerationSessionSnapshot;
  gameName: string;
  gameVersion: string | null | undefined;
  playstyleName: string;
  hardwareContext: string;
  overseerConfig: LLMConfig;
}

// ─────────────────────────────────────────────────────────────────────
// Prompt builders — copied VERBATIM from reviewer.py f-strings, with
// Python interpolation translated to TS template literals.
// Wording is load-bearing: the prompt explicitly tells the model "When in
// doubt, APPROVE" and "false rejections are worse than false approvals."
// ─────────────────────────────────────────────────────────────────────

function buildReviewPrompt(
  snapshot: GenerationSessionSnapshot,
  phaseName: string,
  gameName: string,
  gameVersion: string | null | undefined,
  playstyleName: string,
  hardwareContext: string,
  newModIds: Set<number>,
): string {
  // Existing mods from prior phases (carryover summary).
  const existingMods = snapshot.modlist.filter(
    (m) => !newModIds.has(m['nexus_mod_id'] as number),
  );
  const existingSummary = existingMods.length
    ? existingMods
        .map(
          (m, i) =>
            `  ${i + 1}. ${m['name']} (ID: ${m['nexus_mod_id']})`,
        )
        .join('\n')
    : '  (none — this is the first phase)';

  // New mods with cached descriptions trimmed for the prompt.
  const newMods = snapshot.modlist.filter((m) =>
    newModIds.has(m['nexus_mod_id'] as number),
  );
  const newModsLines = newMods.map((m) => {
    const modIdStr = String(m['nexus_mod_id']);
    const desc = snapshot.description_cache[modIdStr] ?? '';
    const descPreview =
      desc.length > 1500 ? desc.slice(0, 1500) + '...' : desc;
    return (
      `- **${m['name']}** (ID: ${m['nexus_mod_id']})\n` +
      `  Reason: ${m['reason'] ?? 'N/A'}\n` +
      `  Description: ${descPreview}`
    );
  });
  const newModsText = newModsLines.length
    ? newModsLines.join('\n')
    : '  (no mods added)';

  const versionStr = gameVersion || 'any version';

  return `You are a mod compatibility and stability expert for ${gameName} (${versionStr}).

Your job: review the mods just added in the "${phaseName}" phase. Evaluate each for
stability, compatibility with the existing modlist, theme fit, and performance impact.

${hardwareContext}

PLAYSTYLE: ${playstyleName}

EXISTING MODLIST (from prior phases — already approved):
${existingSummary}

NEW MODS ADDED IN THIS PHASE ("${phaseName}"):
${newModsText}

Return ONLY valid JSON (no markdown fences, no explanation):
{
  "approved": [<list of nexus_mod_id integers that are safe>],
  "flagged": [
    {"mod_id": <int>, "name": "<str>", "issue": "<str>", "severity": "warning"}
  ],
  "rejected": [
    {"mod_id": <int>, "name": "<str>", "reason": "<str>"}
  ]
}

Criteria:
- REJECT mods with known stability issues or crashes for ${gameVersion || 'this game version'}
- REJECT mods that directly conflict with existing modlist entries
- REJECT mods that are clearly redundant (another mod already does the same thing)
- FLAG mods with potential compatibility concerns (severity: "warning")
- FLAG mods that may push VRAM or storage over budget (severity: "warning")
- APPROVE mods that are safe, compatible, and fit the playstyle
- When in doubt, APPROVE — false rejections are worse than false approvals`;
}

function buildComprehensiveReviewPrompt(
  snapshot: GenerationSessionSnapshot,
  gameName: string,
  gameVersion: string | null | undefined,
  playstyleName: string,
  hardwareContext: string,
): string {
  // Full modlist with cached descriptions.
  const modLines = snapshot.modlist.map((m, i) => {
    const desc = snapshot.description_cache[String(m['nexus_mod_id'])] ?? '';
    const descPreview =
      desc.length > 800 ? desc.slice(0, 800) + '...' : desc;
    return (
      `${i + 1}. **${m['name']}** (ID: ${m['nexus_mod_id']}, ` +
      `load_order: ${m['load_order'] ?? '?'})\n` +
      `   Reason: ${m['reason'] ?? 'N/A'}\n` +
      `   Description: ${descPreview}`
    );
  });
  const modlistText = modLines.length
    ? modLines.join('\n')
    : '(empty modlist)';

  // Patches.
  const patchLines = snapshot.patches.map((p) => {
    const patches = (p['patches_mods'] as string[] | undefined) ?? [];
    return (
      `- **${p['name']}** (ID: ${p['nexus_mod_id']}) — patches: ${patches.join(', ')}`
    );
  });
  const patchesText = patchLines.length
    ? patchLines.join('\n')
    : '(no patches)';

  // Existing knowledge flags from generation.
  const kfLines = snapshot.knowledge_flags.map((kf) => {
    const k = kf as Record<string, unknown>;
    return (
      `- ${k['mod_a'] ?? '?'} ↔ ${k['mod_b'] ?? '?'}: ${k['issue'] ?? ''} ` +
      `(severity: ${k['severity'] ?? '?'})`
    );
  });
  const kfText = kfLines.length
    ? kfLines.join('\n')
    : '(none flagged during generation)';

  const versionStr = gameVersion || 'any version';

  return `You are a senior mod compatibility expert performing a FINAL REVIEW of a complete ${gameName} (${versionStr}) modlist.

The modlist was generated by multiple AI models working phase-by-phase. Your job is to review
the COMPLETE list holistically — catching cross-phase issues that per-phase reviews would miss.

${hardwareContext}

PLAYSTYLE: ${playstyleName}

=== COMPLETE MODLIST (${snapshot.modlist.length} mods) ===
${modlistText}

=== COMPATIBILITY PATCHES (${snapshot.patches.length}) ===
${patchesText}

=== KNOWN ISSUES (flagged during generation) ===
${kfText}

Perform the following analysis and return ONLY valid JSON (no markdown fences):
{
  "cross_phase_conflicts": [
    {"mod_a": "<name>", "mod_b": "<name>", "issue": "<description>", "severity": "warning|critical"}
  ],
  "vram_assessment": {
    "estimated_total_mb": <int>,
    "within_budget": <bool>,
    "heavy_mods": ["<mod names consuming most VRAM>"]
  },
  "load_order_issues": [
    {"mod": "<name>", "issue": "<what should load before/after what>"}
  ],
  "theme_coherence": {
    "score": <1-10>,
    "notes": "<brief assessment of how well the list fits the ${playstyleName} playstyle>"
  },
  "missing_essentials": ["<mod names that are commonly needed but absent>"],
  "rejected": [
    {"mod_id": <int>, "name": "<str>", "reason": "<str>"}
  ]
}

Guidelines:
- Only REJECT mods with CRITICAL issues (crashes, hard conflicts). Do NOT reject for minor concerns.
- Cross-phase conflicts are the main value here — the per-phase reviewer already caught single-phase issues.
- VRAM assessment should be a rough estimate, not precise. Flag if clearly over budget.
- For load_order_issues, focus on hard requirements (e.g., "SKSE must load before SkyUI").
- For missing_essentials, only flag truly critical omissions for this playstyle.
- theme_coherence score: 8+ means good fit, 5-7 means acceptable, <5 means poor fit.`;
}

// ─────────────────────────────────────────────────────────────────────
// Parsers — copied 1:1 from reviewer.py:_parse_review_response and
// _parse_comprehensive_response. Both:
//   1. Strip ``` markdown fences if present.
//   2. JSON.parse the payload — on failure, return {skipped: true}.
//   3. Filter mod_ids against the set of valid candidates from this phase.
// ─────────────────────────────────────────────────────────────────────

/** Strip ```...``` fences (and a leading "json" hint) the LLM may add. */
function stripMarkdownFences(raw: string): string {
  let text = raw.trim();
  if (text.startsWith('```')) {
    // Drop the first fence line: either ``` or ```json plus the newline.
    const nl = text.indexOf('\n');
    text = nl >= 0 ? text.slice(nl + 1) : text.slice(3);
  }
  if (text.endsWith('```')) {
    text = text.slice(0, -3);
  }
  return text.trim();
}

function parseReviewResponse(
  raw: string,
  validModIds: Set<number>,
): ReviewResult {
  const text = stripMarkdownFences(raw);
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    return { approved: [], flagged: [], rejected: [], skipped: true };
  }

  const result: ReviewResult = {
    approved: [],
    flagged: [],
    rejected: [],
    skipped: false,
  };

  // Approved: only ints that are in the valid (current-phase) set.
  for (const m of (data['approved'] as unknown[]) ?? []) {
    if (typeof m === 'number' && Number.isInteger(m) && validModIds.has(m)) {
      result.approved.push(m);
    }
  }

  for (const e of (data['flagged'] as unknown[]) ?? []) {
    if (e && typeof e === 'object') {
      const entry = e as Record<string, unknown>;
      const id = entry['mod_id'];
      if (typeof id === 'number' && validModIds.has(id)) {
        result.flagged.push({
          mod_id: id,
          name: (entry['name'] as string) ?? 'Unknown',
          issue: (entry['issue'] as string) ?? '',
          severity: (entry['severity'] as string) ?? 'warning',
        });
      }
    }
  }

  for (const e of (data['rejected'] as unknown[]) ?? []) {
    if (e && typeof e === 'object') {
      const entry = e as Record<string, unknown>;
      const id = entry['mod_id'];
      if (typeof id === 'number' && validModIds.has(id)) {
        result.rejected.push({
          mod_id: id,
          name: (entry['name'] as string) ?? 'Unknown',
          reason: (entry['reason'] as string) ?? '',
        });
      }
    }
  }

  return result;
}

function parseComprehensiveResponse(
  raw: string,
  snapshot: GenerationSessionSnapshot,
): ComprehensiveReviewResult {
  const text = stripMarkdownFences(raw);
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    return {
      cross_phase_conflicts: [],
      vram_assessment: {},
      load_order_issues: [],
      theme_coherence: {},
      missing_essentials: [],
      rejected: [],
      skipped: true,
    };
  }

  // Validate rejected mod_ids against the full modlist (not just one phase).
  const allModIds = new Set(
    snapshot.modlist.map((m) => m['nexus_mod_id'] as number),
  );
  const validatedRejected: ReviewFlag[] = [];
  for (const e of (data['rejected'] as unknown[]) ?? []) {
    if (e && typeof e === 'object') {
      const entry = e as Record<string, unknown>;
      const id = entry['mod_id'];
      if (typeof id === 'number' && allModIds.has(id)) {
        validatedRejected.push({
          mod_id: id,
          name: (entry['name'] as string) ?? 'Unknown',
          reason: (entry['reason'] as string) ?? '',
        });
      }
    }
  }

  return {
    cross_phase_conflicts:
      (data['cross_phase_conflicts'] as KnowledgeFlag[]) ?? [],
    vram_assessment:
      (data['vram_assessment'] as Record<string, unknown>) ?? {},
    load_order_issues:
      (data['load_order_issues'] as KnowledgeFlag[]) ?? [],
    theme_coherence:
      (data['theme_coherence'] as Record<string, unknown>) ?? {},
    missing_essentials: (data['missing_essentials'] as string[]) ?? [],
    rejected: validatedRejected,
    skipped: false,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class ReviewerService {
  private readonly dispatcher = inject(LLMDispatcherService);

  /**
   * Run a per-phase review of newly added mods.
   *
   * Mirrors `reviewer.review_phase` in Python:
   *   - Computes the diff between current modlist and `prePhaseModIds`.
   *   - Skips review entirely if no mods were added.
   *   - Calls the LLM with the JSON-output review prompt.
   *   - On parse / network failure, returns `{skipped: true}` and leaves
   *     the modlist untouched (fail-OPEN, NOT fail-closed).
   *   - On success: removes rejected mods from `snapshot.modlist`,
   *     appends flagged entries to `snapshot.review_flags` (with
   *     phase tag), and returns the structured result.
   */
  async reviewPhase(args: ReviewPhaseArgs): Promise<ReviewResult> {
    const {
      snapshot,
      phaseName,
      gameName,
      gameVersion,
      playstyleName,
      hardwareContext,
      prePhaseModIds,
      overseerConfig,
    } = args;

    // Identify which mods were added in THIS phase.
    const currentModIds = new Set(
      snapshot.modlist.map((m) => m['nexus_mod_id'] as number),
    );
    const newModIds = new Set<number>();
    for (const id of currentModIds) {
      if (!prePhaseModIds.has(id)) newModIds.add(id);
    }

    if (newModIds.size === 0) {
      return { approved: [], flagged: [], rejected: [], skipped: true };
    }

    const prompt = buildReviewPrompt(
      snapshot,
      phaseName,
      gameName,
      gameVersion,
      playstyleName,
      hardwareContext,
      newModIds,
    );

    let raw: string;
    try {
      const resp = await this.dispatcher.complete(overseerConfig, {
        messages: [
          { role: 'system', content: prompt },
          {
            role: 'user',
            content: 'Review the new mods listed above. Return JSON only.',
          },
        ],
        // Reviewer is judgment-y, not creative — keep temp very low.
        // (Python uses provider.py defaults; 0.2 is the matching range.)
        temperature: 0.2,
      });
      raw = resp.content;
    } catch {
      // Never block generation on a review failure — Python wraps this
      // exact same try/except in review_phase.
      return { approved: [], flagged: [], rejected: [], skipped: true };
    }

    const result = parseReviewResponse(raw, newModIds);
    if (result.skipped) return result;

    // Apply rejections — remove rejected mods from the snapshot.
    if (result.rejected.length > 0) {
      const rejectedIds = new Set(
        result.rejected.map((r) => r['mod_id'] as number),
      );
      const filtered: SessionModEntry[] = snapshot.modlist.filter(
        (m) => !rejectedIds.has(m['nexus_mod_id'] as number),
      );
      // Mutate in place so the orchestrator's reference stays valid.
      snapshot.modlist.length = 0;
      snapshot.modlist.push(...filtered);
    }

    // Persist flagged entries with the phase tag (Python prepends `phase`).
    for (const flag of result.flagged) {
      snapshot.review_flags.push({
        phase: phaseName,
        ...(flag as Record<string, unknown>),
      });
    }

    return result;
  }

  /**
   * Run the final, comprehensive review across the full modlist.
   *
   * Mirrors `reviewer.review_comprehensive`. Returns the parsed report
   * structure (cross-phase conflicts, VRAM assessment, load-order issues,
   * theme score, missing essentials, critical rejections). On any failure,
   * returns `{skipped: true}` without mutating the modlist.
   */
  async reviewComprehensive(
    args: ReviewComprehensiveArgs,
  ): Promise<ComprehensiveReviewResult> {
    const {
      snapshot,
      gameName,
      gameVersion,
      playstyleName,
      hardwareContext,
      overseerConfig,
    } = args;

    if (snapshot.modlist.length === 0) {
      return {
        cross_phase_conflicts: [],
        vram_assessment: {},
        load_order_issues: [],
        theme_coherence: {},
        missing_essentials: [],
        rejected: [],
        skipped: true,
      };
    }

    const prompt = buildComprehensiveReviewPrompt(
      snapshot,
      gameName,
      gameVersion,
      playstyleName,
      hardwareContext,
    );

    let raw: string;
    try {
      const resp = await this.dispatcher.complete(overseerConfig, {
        messages: [
          { role: 'system', content: prompt },
          {
            role: 'user',
            content:
              'Perform the final comprehensive review. Return JSON only.',
          },
        ],
        temperature: 0.2,
      });
      raw = resp.content;
    } catch {
      return {
        cross_phase_conflicts: [],
        vram_assessment: {},
        load_order_issues: [],
        theme_coherence: {},
        missing_essentials: [],
        rejected: [],
        skipped: true,
      };
    }

    const result = parseComprehensiveResponse(raw, snapshot);
    if (result.skipped) return result;

    // Apply critical rejections.
    if (result.rejected.length > 0) {
      const rejectedIds = new Set(
        result.rejected.map((r) => r['mod_id'] as number),
      );
      const filtered: SessionModEntry[] = snapshot.modlist.filter(
        (m) => !rejectedIds.has(m['nexus_mod_id'] as number),
      );
      snapshot.modlist.length = 0;
      snapshot.modlist.push(...filtered);
    }

    // Persist cross-phase conflicts as review flags too — Python writes the
    // same shape so the dashboard can render them alongside per-phase flags.
    for (const conflict of result.cross_phase_conflicts) {
      const c = conflict as Record<string, unknown>;
      snapshot.review_flags.push({
        phase: 'comprehensive_review',
        mod_id: 0,
        name: `${c['mod_a'] ?? '?'} <> ${c['mod_b'] ?? '?'}`,
        issue: c['issue'] ?? '',
        severity: c['severity'] ?? 'warning',
      });
    }

    return result;
  }
}
