import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { finalize, map, Observable, switchMap, tap } from 'rxjs';
import {
  User,
  TokenResponse,
  RegisterRequest,
  LoginRequest,
  UserHardware,
  HardwareUpdateRequest,
  OAuthProviderInfo,
} from '../../shared/models/auth.model';

const TOKEN_KEY = 'access_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private baseUrl = window.__env?.API_URL || '/api';
  private _user = signal<User | null>(null);
  private _initialized = signal(false);

  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => !!this._user());
  readonly isEmailVerified = computed(() => this._user()?.email_verified ?? false);
  /** True once the initial auth check (profile load or token-absent fast path) has settled. */
  readonly initialized = this._initialized.asReadonly();

  constructor(
    private http: HttpClient,
    private router: Router,
  ) {
    if (this.getAccessToken()) {
      this.loadProfileAsync()
        .pipe(finalize(() => this._initialized.set(true)))
        .subscribe();
    } else {
      this._initialized.set(true);
    }
  }

  // --- Token Management ---

  getAccessToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  setAccessToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  }

  clearAccessToken(): void {
    localStorage.removeItem(TOKEN_KEY);
  }

  // --- Auth Endpoints ---

  register(data: RegisterRequest): Observable<User> {
    return this.http
      .post<TokenResponse>(`${this.baseUrl}/auth/register`, data, { withCredentials: true })
      .pipe(
        tap((res) => this.setAccessToken(res.access_token)),
        switchMap(() => this.loadProfileAsync()),
      );
  }

  login(data: LoginRequest): Observable<User> {
    return this.http
      .post<TokenResponse>(`${this.baseUrl}/auth/login`, data, { withCredentials: true })
      .pipe(
        tap((res) => this.setAccessToken(res.access_token)),
        switchMap(() => this.loadProfileAsync()),
      );
  }

  refreshToken(): Observable<TokenResponse> {
    return this.http
      .post<TokenResponse>(`${this.baseUrl}/auth/refresh`, {}, { withCredentials: true })
      .pipe(
        tap((res) => {
          this.setAccessToken(res.access_token);
        }),
      );
  }

  logout(): void {
    this.http
      .post(`${this.baseUrl}/auth/logout`, {}, { withCredentials: true })
      .subscribe({ error: () => {} });
    this.clearAccessToken();
    this._user.set(null);
    this.router.navigate(['/auth/login']);
  }

  // --- Profile ---

  loadProfile(): void {
    this.loadProfileAsync().subscribe();
  }

  loadProfileAsync(): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/auth/me`).pipe(
      tap({
        next: (user) => this._user.set(user),
        error: () => {
          this.clearAccessToken();
          this._user.set(null);
        },
      }),
    );
  }

  updateProfile(data: { display_name?: string; avatar_url?: string }): Observable<User> {
    return this.http.put<User>(`${this.baseUrl}/auth/me`, data).pipe(
      tap((user) => this._user.set(user)),
    );
  }

  // --- Hardware ---

  getHardware(): Observable<UserHardware | null> {
    return this.http.get<UserHardware | null>(`${this.baseUrl}/auth/me/hardware`);
  }

  saveHardware(data: HardwareUpdateRequest): Observable<UserHardware> {
    return this.http.put<UserHardware>(`${this.baseUrl}/auth/me/hardware`, data).pipe(
      tap((hw) => {
        const current = this._user();
        if (current) {
          this._user.set({ ...current, hardware: hw });
        }
      }),
    );
  }

  get savedHardware(): UserHardware | undefined {
    return this._user()?.hardware ?? undefined;
  }

  // --- OAuth ---

  getOAuthProviders(): Observable<string[]> {
    return this.http
      .get<{ providers: string[] }>(`${this.baseUrl}/auth/oauth/providers`)
      .pipe(map((res) => res.providers));
  }

  oauthLogin(provider: 'google' | 'discord'): void {
    // Top-level navigation to the backend init endpoint. Backend responds
    // with a 302 to the provider and sets an HttpOnly SameSite=Lax cookie
    // binding the CSRF state + PKCE verifier to this user agent.
    window.location.href = `${this.baseUrl}/auth/oauth/${provider}`;
  }

  // --- Connected Accounts ---

  getConnectedAccounts(): Observable<OAuthProviderInfo[]> {
    return this.http.get<OAuthProviderInfo[]>(`${this.baseUrl}/auth/me/connected-accounts`);
  }

  disconnectAccount(provider: string): Observable<{ status: string; message: string }> {
    return this.http.delete<{ status: string; message: string }>(`${this.baseUrl}/auth/me/connected-accounts/${provider}`);
  }

  // --- Email Verification ---

  verifyEmail(token: string): Observable<{ status: string; message: string }> {
    return this.http.post<{ status: string; message: string }>(`${this.baseUrl}/auth/verify-email`, { token });
  }

  resendVerification(): Observable<{ status: string; message: string }> {
    return this.http.post<{ status: string; message: string }>(`${this.baseUrl}/auth/resend-verification`, {});
  }

  // --- Password Reset ---

  forgotPassword(email: string): Observable<{ status: string; message: string }> {
    return this.http.post<{ status: string; message: string }>(`${this.baseUrl}/auth/forgot-password`, { email });
  }

  resetPassword(token: string, newPassword: string): Observable<{ status: string; message: string }> {
    return this.http.post<{ status: string; message: string }>(`${this.baseUrl}/auth/reset-password`, {
      token,
      new_password: newPassword,
    });
  }

  // --- Account Deletion ---

  deleteAccount(): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/user/me`, {
      headers: { 'X-Confirm-Delete': 'DELETE' },
    });
  }
}
