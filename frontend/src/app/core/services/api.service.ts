import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Game, Playstyle } from '../../shared/models/game.model';
import { HardwareSpecs, SpecsParseResponse } from '../../shared/models/specs.model';
import { Modlist, LlmProvider, InstallGuide, SizeSummary } from '../../shared/models/mod.model';
import { GenerationStartResponse, SizePreset } from '../../shared/models/generation.model';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private baseUrl = window.__env?.API_URL || '/api';

  constructor(private http: HttpClient) {}

  // Games
  getGames(): Observable<Game[]> {
    return this.http.get<Game[]>(`${this.baseUrl}/games/`);
  }

  getPlaystyles(gameId: number): Observable<Playstyle[]> {
    return this.http.get<Playstyle[]>(`${this.baseUrl}/games/${gameId}/playstyles`);
  }

  // Hardware Specs
  parseSpecs(rawText: string): Observable<SpecsParseResponse> {
    return this.http.post<SpecsParseResponse>(`${this.baseUrl}/specs/parse`, {
      raw_text: rawText,
    });
  }

  // Generation
  startGeneration(request: {
    game_id: number;
    playstyle_id?: number;
    game_version?: string;
    gpu?: string;
    vram_mb?: number;
    cpu?: string;
    ram_gb?: number;
    cpu_cores?: number;
    cpu_speed_ghz?: number;
    available_storage_gb?: number;
    custom_description?: string;
    requested_mods?: string[];
    llm_credentials?: { provider: string; api_key: string; base_url?: string; model?: string }[];
    preset?: SizePreset;
  }): Observable<GenerationStartResponse> {
    return this.http.post<GenerationStartResponse>(`${this.baseUrl}/generation/start`, request);
  }

  getGenerationLog(generationId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/generation/${generationId}/log`);
  }

  getModlist(modlistId: string): Observable<Modlist> {
    return this.http.get<Modlist>(`${this.baseUrl}/modlist/${modlistId}`);
  }

  getModlistLog(modlistId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/modlist/${modlistId}/log`);
  }

  getSizeSummary(modlistId: string): Observable<SizeSummary> {
    return this.http.get<SizeSummary>(`${this.baseUrl}/modlist/${modlistId}/size-summary`);
  }

  getModlistGuide(modlistId: string, version?: string | null): Observable<InstallGuide> {
    const params = version ? `?version=${encodeURIComponent(version)}` : '';
    return this.http.get<InstallGuide>(`${this.baseUrl}/modlist/${modlistId}/guide${params}`);
  }

  getModlistGuideMarkdownUrl(modlistId: string, version?: string | null): string {
    const params = version ? `?version=${encodeURIComponent(version)}` : '';
    return `${this.baseUrl}/modlist/${modlistId}/guide.md${params}`;
  }

  /** Public download URL for the MO2 import plugin (moddersomni_import.py). */
  getMo2PluginDownloadUrl(): string {
    return `${this.baseUrl}/plugin/mo2-import.py`;
  }

  getMyModlists(): Observable<Modlist[]> {
    return this.http.get<Modlist[]>(`${this.baseUrl}/modlist/mine`);
  }

  deleteModlist(modlistId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/modlist/${modlistId}`);
  }

  // LLM Providers (public)
  getLlmProviders(): Observable<LlmProvider[]> {
    return this.http.get<LlmProvider[]>(`${this.baseUrl}/settings/llm-providers`);
  }

  // LLM API Keys (auth required)
  getLlmKeys(): Observable<Record<string, string>> {
    return this.http.get<Record<string, string>>(`${this.baseUrl}/settings/llm-keys/raw`);
  }

  saveLlmKeys(keys: Record<string, string>): Observable<Record<string, string>> {
    return this.http.patch<Record<string, string>>(`${this.baseUrl}/settings/llm-keys`, keys);
  }

  // Settings
  getSettings(): Observable<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>(`${this.baseUrl}/settings/`);
  }

  updateSettings(settings: Record<string, unknown>): Observable<Record<string, unknown>> {
    return this.http.put<Record<string, unknown>>(`${this.baseUrl}/settings/`, settings);
  }

  // Stats (public)
  getStats(): Observable<{ modlists_generated: number; games_supported: number }> {
    return this.http.get<{ modlists_generated: number; games_supported: number }>(
      `${this.baseUrl}/stats/`
    );
  }

  // Ollama
  testOllamaConnection(
    baseUrl: string
  ): Observable<{ connected: boolean; models: string[]; error: string }> {
    return this.http.post<{ connected: boolean; models: string[]; error: string }>(
      `${this.baseUrl}/settings/ollama/test`,
      { base_url: baseUrl }
    );
  }

  // Compatibility
  checkCompatibility(
    modAName: string,
    modBName: string,
    gameSlug: string
  ): Observable<{
    compatible: boolean;
    issues: { description: string; severity: string; source: string }[];
    suggested_patches: string[];
    confidence: string;
  }> {
    return this.http.post<any>(`${this.baseUrl}/compatibility/check`, {
      mod_a_name: modAName,
      mod_b_name: modBName,
      game_slug: gameSlug,
    });
  }

  // Health
  healthCheck(): Observable<{ status: string; app: string }> {
    return this.http.get<{ status: string; app: string }>(`${this.baseUrl}/health`);
  }

  // Nexus OAuth
  getNexusOAuthStatus(): Observable<{
    configured: boolean;
    connected: boolean;
    username: string | null;
    scope: string | null;
    expires_at: string | null;
  }> {
    return this.http.get<any>(`${this.baseUrl}/nexus/oauth/status`);
  }

  startNexusOAuth(): Observable<{ authorize_url: string }> {
    return this.http.get<{ authorize_url: string }>(
      `${this.baseUrl}/nexus/oauth/authorize`,
      { withCredentials: true },
    );
  }

  disconnectNexusOAuth(): Observable<{ status: string }> {
    return this.http.post<{ status: string }>(`${this.baseUrl}/nexus/oauth/disconnect`, {});
  }

  publishModlistToNexus(
    modlistId: string,
    body: { title: string; description: string; listed: boolean },
  ): Observable<{
    success: boolean;
    collection_id: number | null;
    revision_id: number | null;
    slug: string | null;
    url: string | null;
  }> {
    return this.http.post<any>(`${this.baseUrl}/modlist/${modlistId}/publish-to-nexus`, body);
  }
}
