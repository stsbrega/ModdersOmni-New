import type { GenerationEvent } from '../../../shared/models/generation.model';
import type { TerminalLogEntry, TerminalLogLevel } from '../../../shared/components/ui';

/**
 * Pure mapper from a pipeline GenerationEvent to a TerminalLogEntry the
 * UiTerminalLogComponent can render. Keep this exhaustive: every event type
 * the pipeline emits (see core/services/generation/types.ts and the v2
 * EVENT_ICONS map at generation.component.ts:78) should have a deliberate
 * mapping. Unknown event types fall through to a default "info" entry that
 * surfaces the raw event.type so we can spot taxonomy drift in logs.
 */
export function eventToLogEntry(event: GenerationEvent): TerminalLogEntry {
  const e = event as any;
  switch (e.type as string) {
    case 'providers_ready':
      return { level: 'info', text: `providers ready — ${e.count ?? '?'} mods available` };
    case 'phase_start':
      return { level: 'info', text: `phase ${e.number ?? '?'}/${e.total_phases ?? '?'} — ${e.phase ?? 'unknown'}` };
    case 'searching':
      return { level: 'info', text: `searching nexus: ${e.query ?? '...'}` };
    case 'search_results':
      return { level: 'info', text: `${e.count ?? 0} results` };
    case 'reading_mod':
      return { level: 'info', text: `reading: ${e.mod_name ?? e.name ?? e.mod_id ?? '...'}` };
    case 'mod_added':
      return { level: 'ok', text: `added: ${e.mod?.name ?? e.name ?? 'mod'}` };
    case 'patch_added':
      return { level: 'ok', text: `patch added: ${e.patch?.name ?? e.name ?? 'patch'}` };
    case 'knowledge_flag':
      return { level: 'warn', text: e.message ?? e.issue ?? 'knowledge flag' };
    case 'thinking':
      return { level: 'info', text: e.text ?? e.message ?? 'thinking...' };
    case 'phase_complete':
      return { level: 'ok', text: `phase complete: ${e.phase ?? ''} (${e.mod_count ?? 0} mods)` };
    case 'retrying':
      return { level: 'warn', text: e.message ?? e.reason ?? 'retrying...' };
    case 'provider_error':
      return { level: 'err', text: `provider ${e.provider ?? '?'}: ${e.message ?? 'error'}` };
    case 'provider_switch':
      return { level: 'info', text: `switched provider: ${e.from_provider ?? e.from ?? '?'} → ${e.to_provider ?? e.to ?? '?'}` };
    case 'paused':
      return { level: 'warn', text: e.reason ?? 'paused' };
    case 'resumed':
      return { level: 'info', text: 'resumed' };
    case 'size_update':
      return { level: 'info', text: `size update: ${e.mod_count ?? 0} mods` };
    case 'complete':
      return { level: 'ok', text: 'generation complete' };
    case 'error':
      return { level: 'err', text: e.message ?? 'pipeline error' };
    case 'sweep_start':
      return { level: 'info', text: 'final sweep started' };
    case 'missing_requested_mod':
      return { level: 'warn', text: `mod not found: ${e.name ?? e.mod_name ?? '?'}` };
    case 'sweep_complete':
      return { level: 'info', text: 'final sweep complete' };
    default:
      return { level: 'info', text: `[${e.type}]` };
  }
}
