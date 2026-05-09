/**
 * Plugin token management service.
 *
 * Wraps the /api/plugin/tokens endpoints for creating, listing,
 * and revoking long-lived plugin authentication tokens used by
 * MO2/Vortex mod manager plugins.
 */

import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of } from 'rxjs';

export interface PluginTokenInfo {
  id: number;
  name: string;
  scopes: string;
  revoked: boolean;
  created_at: string;
  last_used_at: string | null;
  expires_at: string;
}

export interface PluginTokenCreated {
  token: string;
  id: number;
  name: string;
  scopes: string;
  expires_at: string;
}

@Injectable({
  providedIn: 'root',
})
export class PluginTokenService {
  private baseUrl = window.__env?.API_URL || '/api';

  readonly tokens = signal<PluginTokenInfo[]>([]);
  readonly loading = signal<boolean>(false);

  /** Holds the raw token immediately after creation (shown once). */
  readonly justCreatedToken = signal<string | null>(null);

  constructor(private http: HttpClient) {}

  loadTokens(): Observable<PluginTokenInfo[]> {
    this.loading.set(true);
    return this.http
      .get<PluginTokenInfo[]>(`${this.baseUrl}/plugin/tokens`)
      .pipe(
        tap((tokens) => {
          this.tokens.set(tokens);
          this.loading.set(false);
        }),
        catchError(() => {
          this.loading.set(false);
          return of([]);
        }),
      );
  }

  createToken(
    name: string,
    expiryDays: number = 90,
  ): Observable<PluginTokenCreated> {
    return this.http
      .post<PluginTokenCreated>(`${this.baseUrl}/plugin/tokens`, {
        name,
        scopes: 'export,download',
        expiry_days: expiryDays,
      })
      .pipe(
        tap((result) => {
          this.justCreatedToken.set(result.token);
          // Reload the list to include the new token
          this.loadTokens().subscribe();
        }),
      );
  }

  revokeToken(tokenId: number): Observable<void> {
    return this.http
      .delete<void>(`${this.baseUrl}/plugin/tokens/${tokenId}`)
      .pipe(
        tap(() => {
          // Remove from local state
          this.tokens.update((tokens) =>
            tokens.filter((t) => t.id !== tokenId),
          );
        }),
      );
  }

  revokeAllTokens(): Observable<{ revoked_count: number }> {
    return this.http
      .delete<{ revoked_count: number }>(`${this.baseUrl}/plugin/tokens`)
      .pipe(
        tap(() => {
          this.tokens.set([]);
        }),
      );
  }

  clearCreatedToken(): void {
    this.justCreatedToken.set(null);
  }
}
