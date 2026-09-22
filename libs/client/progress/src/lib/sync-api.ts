import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { AUTH_CONFIG } from '@world-quiz/client/auth';
import {
  type SessionHistoryPage,
  sessionHistoryPageSchema,
  type SessionResult,
  sessionResultSchema,
  type SubmitSessionRequest,
} from '@world-quiz/shared/contracts';
import { firstValueFrom } from 'rxjs';

/**
 * The API calls of the sync. `authInterceptor` adds the access token and
 * renews it once on 401; responses are parsed with the shared contract.
 */
@Injectable({ providedIn: 'root' })
export class SyncApi {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(AUTH_CONFIG).apiUrl;

  /**
   * Records a session; a retry of the same request is answered 200 with the
   * stored result. The result carries the server's grading and, for a
   * challenge, its verdict.
   */
  async submit(request: SubmitSessionRequest): Promise<SessionResult> {
    const body = await firstValueFrom(
      this.http.post(`${this.apiUrl}/v1/sessions`, request),
    );
    return sessionResultSchema.parse(body);
  }

  async history(after: string | null): Promise<SessionHistoryPage> {
    let params = new HttpParams();
    if (after) params = params.set('after', after);
    const body = await firstValueFrom(
      this.http.get(`${this.apiUrl}/v1/sessions`, { params }),
    );
    return sessionHistoryPageSchema.parse(body);
  }
}
