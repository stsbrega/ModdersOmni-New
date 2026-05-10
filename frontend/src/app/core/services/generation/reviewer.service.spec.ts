/**
 * Tests for reviewer.service.ts.
 *
 * Source of truth: `backend/app/services/generation/reviewer.py`
 *
 * Plan deviations (verified against Python ground truth):
 *   - Plan said the verdict format is `VERDICT: APPROVE` / `VERDICT: REJECT`.
 *     Python ACTUALLY emits/parses **JSON**: `{approved, flagged, rejected}`
 *     arrays. Tests below assert the JSON-based protocol Python uses.
 *   - Plan said malformed verdict → "fail-closed reject". Python's actual
 *     fail-closed is `ReviewResult(skipped=true)` — leaves the modlist alone.
 *     False rejections are worse than false approvals (per the prompt).
 *   - Python has TWO entry points: per-phase review (`review_phase`) AND
 *     comprehensive end-of-run review (`review_comprehensive`). Both ported.
 *   - Reviewer dependency: in Python it's an internal `LLMProvider` resolved
 *     from settings. In TS the orchestrator passes an `LLMConfig` directly
 *     (so the dispatcher can route to whichever model is configured for the
 *     overseer pass).
 */
import { TestBed } from '@angular/core/testing';

import { ReviewerService } from './reviewer.service';
import { LLMDispatcherService } from '../llm/dispatcher.service';
import { createEmptySnapshot } from './session';
import type { GenerationSessionSnapshot } from './types';
import type { LLMConfig, LLMResponse } from '../llm/types';

const REVIEWER_CFG: LLMConfig = {
  provider: 'gemini',
  model: 'gemini-2.5-pro',
  apiKey: 'test-key',
};

function fakeResponse(content: string): LLMResponse {
  return { content, toolCalls: [], finishReason: 'stop' };
}

describe('ReviewerService', () => {
  let svc: ReviewerService;
  let dispatchSpy: jasmine.SpyObj<LLMDispatcherService>;
  let snapshot: GenerationSessionSnapshot;

  beforeEach(() => {
    dispatchSpy = jasmine.createSpyObj<LLMDispatcherService>(
      'LLMDispatcherService',
      ['complete'],
    );
    TestBed.configureTestingModule({
      providers: [
        { provide: LLMDispatcherService, useValue: dispatchSpy },
      ],
    });
    svc = TestBed.inject(ReviewerService);
    snapshot = createEmptySnapshot('skyrimspecialedition');

    // Two mods added in the current phase, one carryover from a prior phase.
    snapshot.modlist = [
      {
        nexus_mod_id: 100,
        name: 'Old Mod',
        reason: 'carryover',
        load_order: 1,
      },
      {
        nexus_mod_id: 200,
        name: 'SKSE',
        reason: 'core',
        load_order: 2,
      },
      {
        nexus_mod_id: 300,
        name: 'SkyUI',
        reason: 'UI',
        load_order: 3,
      },
    ];
    snapshot.description_cache = {
      '200': 'Script extender description',
      '300': 'UI overhaul description',
    };
  });

  // ───────────────────────────────────────────────────────────────────
  // reviewPhase — the per-phase JSON-based reviewer
  // ───────────────────────────────────────────────────────────────────

  describe('reviewPhase', () => {
    it('approves mods listed in the response.approved array', async () => {
      dispatchSpy.complete.and.resolveTo(
        fakeResponse(
          JSON.stringify({
            approved: [200, 300],
            flagged: [],
            rejected: [],
          }),
        ),
      );

      const result = await svc.reviewPhase({
        snapshot,
        phaseName: 'Essentials',
        gameName: 'Skyrim Special Edition',
        gameVersion: 'SE',
        playstyleName: 'Vanilla+',
        hardwareContext: 'GPU: RTX 3080 (10GB VRAM)',
        prePhaseModIds: new Set([100]),
        overseerConfig: REVIEWER_CFG,
      });

      expect(result.approved).toEqual([200, 300]);
      expect(result.flagged).toEqual([]);
      expect(result.rejected).toEqual([]);
      expect(result.skipped).toBeFalse();
      // No removals on pure approval.
      expect(snapshot.modlist.length).toBe(3);
    });

    it('removes rejected mods from snapshot.modlist (Python mutates session)', async () => {
      dispatchSpy.complete.and.resolveTo(
        fakeResponse(
          JSON.stringify({
            approved: [200],
            flagged: [],
            rejected: [
              { mod_id: 300, name: 'SkyUI', reason: 'redundant' },
            ],
          }),
        ),
      );

      const result = await svc.reviewPhase({
        snapshot,
        phaseName: 'Essentials',
        gameName: 'Skyrim Special Edition',
        gameVersion: 'SE',
        playstyleName: 'Vanilla+',
        hardwareContext: 'GPU: RTX 3080',
        prePhaseModIds: new Set([100]),
        overseerConfig: REVIEWER_CFG,
      });

      expect(result.rejected.length).toBe(1);
      expect(result.rejected[0]['mod_id']).toBe(300);
      expect(snapshot.modlist.map((m) => m['nexus_mod_id'])).toEqual([
        100, 200,
      ]);
    });

    it('appends flagged entries to snapshot.review_flags with phase tag', async () => {
      dispatchSpy.complete.and.resolveTo(
        fakeResponse(
          JSON.stringify({
            approved: [200],
            flagged: [
              {
                mod_id: 300,
                name: 'SkyUI',
                issue: 'may need patch',
                severity: 'warning',
              },
            ],
            rejected: [],
          }),
        ),
      );

      await svc.reviewPhase({
        snapshot,
        phaseName: 'UI',
        gameName: 'Skyrim Special Edition',
        gameVersion: 'SE',
        playstyleName: 'Vanilla+',
        hardwareContext: '',
        prePhaseModIds: new Set([100]),
        overseerConfig: REVIEWER_CFG,
      });

      expect(snapshot.review_flags.length).toBe(1);
      const f = snapshot.review_flags[0] as Record<string, unknown>;
      expect(f['phase']).toBe('UI');
      expect(f['mod_id']).toBe(300);
      expect(f['severity']).toBe('warning');
    });

    it('handles markdown-fenced JSON (strips ``` wrappers like Python)', async () => {
      dispatchSpy.complete.and.resolveTo(
        fakeResponse(
          '```json\n' +
            JSON.stringify({
              approved: [200, 300],
              flagged: [],
              rejected: [],
            }) +
            '\n```',
        ),
      );

      const result = await svc.reviewPhase({
        snapshot,
        phaseName: 'Essentials',
        gameName: 'Skyrim',
        gameVersion: 'SE',
        playstyleName: 'V+',
        hardwareContext: '',
        prePhaseModIds: new Set([100]),
        overseerConfig: REVIEWER_CFG,
      });

      expect(result.skipped).toBeFalse();
      expect(result.approved).toEqual([200, 300]);
    });

    it('returns skipped=true on malformed JSON (matches Python — fail-OPEN, not closed)', async () => {
      dispatchSpy.complete.and.resolveTo(
        fakeResponse('I am not sure what to think.'),
      );

      const result = await svc.reviewPhase({
        snapshot,
        phaseName: 'Essentials',
        gameName: 'Skyrim',
        gameVersion: 'SE',
        playstyleName: 'V+',
        hardwareContext: '',
        prePhaseModIds: new Set([100]),
        overseerConfig: REVIEWER_CFG,
      });

      // Python's _parse_review_response returns ReviewResult(skipped=True).
      // No mods are removed — false rejections are worse than false approvals.
      expect(result.skipped).toBeTrue();
      expect(snapshot.modlist.length).toBe(3);
    });

    it('returns skipped=true with no LLM call when no new mods were added', async () => {
      // pre_phase = current => no diff
      const result = await svc.reviewPhase({
        snapshot,
        phaseName: 'Essentials',
        gameName: 'Skyrim',
        gameVersion: 'SE',
        playstyleName: 'V+',
        hardwareContext: '',
        prePhaseModIds: new Set([100, 200, 300]),
        overseerConfig: REVIEWER_CFG,
      });

      expect(result.skipped).toBeTrue();
      expect(dispatchSpy.complete).not.toHaveBeenCalled();
    });

    it('returns skipped=true when the dispatcher throws (fail-OPEN, not closed)', async () => {
      dispatchSpy.complete.and.rejectWith(new Error('rate limited'));

      const result = await svc.reviewPhase({
        snapshot,
        phaseName: 'Essentials',
        gameName: 'Skyrim',
        gameVersion: 'SE',
        playstyleName: 'V+',
        hardwareContext: '',
        prePhaseModIds: new Set([100]),
        overseerConfig: REVIEWER_CFG,
      });

      // Python wraps the LLM call in try/except — failures never block generation.
      expect(result.skipped).toBeTrue();
      expect(snapshot.modlist.length).toBe(3);
    });

    it('filters out rejected mod_ids that were not added in THIS phase', async () => {
      dispatchSpy.complete.and.resolveTo(
        fakeResponse(
          JSON.stringify({
            approved: [200],
            flagged: [],
            rejected: [
              // 100 was a carryover from a prior phase — must be ignored.
              { mod_id: 100, name: 'Old Mod', reason: 'noooo' },
              { mod_id: 300, name: 'SkyUI', reason: 'ok' },
            ],
          }),
        ),
      );

      const result = await svc.reviewPhase({
        snapshot,
        phaseName: 'Essentials',
        gameName: 'Skyrim',
        gameVersion: 'SE',
        playstyleName: 'V+',
        hardwareContext: '',
        prePhaseModIds: new Set([100]),
        overseerConfig: REVIEWER_CFG,
      });

      // Only 300 is a valid new-phase mod; 100 is filtered out.
      expect(result.rejected.length).toBe(1);
      expect(result.rejected[0]['mod_id']).toBe(300);
      // 100 is still in the modlist (was never removable).
      expect(snapshot.modlist.find((m) => m['nexus_mod_id'] === 100)).toBeTruthy();
    });

    it('passes the review prompt to the dispatcher with system+user messages', async () => {
      dispatchSpy.complete.and.resolveTo(
        fakeResponse(
          JSON.stringify({ approved: [200, 300], flagged: [], rejected: [] }),
        ),
      );

      await svc.reviewPhase({
        snapshot,
        phaseName: 'Essentials',
        gameName: 'Skyrim Special Edition',
        gameVersion: 'SE',
        playstyleName: 'Vanilla+',
        hardwareContext: 'GPU: RTX 3080',
        prePhaseModIds: new Set([100]),
        overseerConfig: REVIEWER_CFG,
      });

      const [cfgArg, reqArg] = dispatchSpy.complete.calls.mostRecent().args;
      expect(cfgArg).toBe(REVIEWER_CFG);
      expect(reqArg.messages.length).toBe(2);
      expect(reqArg.messages[0].role).toBe('system');
      // System prompt includes the phase name + game.
      expect(reqArg.messages[0].content).toContain('Essentials');
      expect(reqArg.messages[0].content).toContain('Skyrim Special Edition');
      // System prompt asks for JSON with approved/flagged/rejected.
      expect(reqArg.messages[0].content).toContain('"approved"');
      expect(reqArg.messages[0].content).toContain('"flagged"');
      expect(reqArg.messages[0].content).toContain('"rejected"');
      expect(reqArg.messages[1].role).toBe('user');
    });
  });

  // ───────────────────────────────────────────────────────────────────
  // reviewComprehensive — the post-pipeline holistic review
  // ───────────────────────────────────────────────────────────────────

  describe('reviewComprehensive', () => {
    it('returns skipped=true when modlist is empty (no work to do)', async () => {
      snapshot.modlist = [];
      const r = await svc.reviewComprehensive({
        snapshot,
        gameName: 'Skyrim',
        gameVersion: 'SE',
        playstyleName: 'V+',
        hardwareContext: '',
        overseerConfig: REVIEWER_CFG,
      });
      expect(r.skipped).toBeTrue();
      expect(dispatchSpy.complete).not.toHaveBeenCalled();
    });

    it('parses the cross-phase JSON shape and removes critical rejections', async () => {
      dispatchSpy.complete.and.resolveTo(
        fakeResponse(
          JSON.stringify({
            cross_phase_conflicts: [
              {
                mod_a: 'SKSE',
                mod_b: 'Old Mod',
                issue: 'order',
                severity: 'warning',
              },
            ],
            vram_assessment: {
              estimated_total_mb: 4096,
              within_budget: true,
              heavy_mods: [],
            },
            load_order_issues: [],
            theme_coherence: { score: 8, notes: 'good' },
            missing_essentials: [],
            rejected: [
              { mod_id: 300, name: 'SkyUI', reason: 'crash' },
            ],
          }),
        ),
      );

      const r = await svc.reviewComprehensive({
        snapshot,
        gameName: 'Skyrim',
        gameVersion: 'SE',
        playstyleName: 'V+',
        hardwareContext: '',
        overseerConfig: REVIEWER_CFG,
      });

      expect(r.theme_coherence['score']).toBe(8);
      expect(r.cross_phase_conflicts.length).toBe(1);
      expect(snapshot.modlist.find((m) => m['nexus_mod_id'] === 300)).toBeUndefined();
      // Cross-phase conflicts get persisted as review_flags too.
      expect(snapshot.review_flags.length).toBeGreaterThan(0);
    });
  });
});
