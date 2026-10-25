import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { getAuth } from 'firebase/auth';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export type CleanupStatus =
  | 'waiting' | 'checking' | 'filling'
  | 'verified' | 'enriched' | 'fixed' | 'flagged' | 'undeliverable'
  | 'deferred' | 'sample' | 'no_email';

export type FlagReason = 'undeliverable' | 'role_inbox' | 'catch_all';

export interface ImportRow {
  id: string;
  name: string;
  title: string;
  email: string;
  company: string;
  status: CleanupStatus;
  note: string;
  flagReason: FlagReason | null;
  /** "Kept", "Looking for a new email" - set once the user answers a flag. */
  resolution: string | null;
}

export interface ImportBatch {
  id: string;
  source: string;
  status: 'importing' | 'queued' | 'running' | 'done' | 'failed';
  total?: number;
  /** Email checks a tenant gets per day; the rest wait for the nightly run. */
  dailyLimit?: number;
  counts?: { processed: number; checked: number; fixed: number; enriched: number; flagged: number; deferred: number };
}

export interface FixLogEntry {
  id: string;
  contactId: string;
  kind: string;
  /** good (verified, enriched), attention (fixed, flagged), neutral. */
  tone: 'good' | 'attention' | 'neutral';
  text: string;
  at: string;
}

export interface ImportState {
  batch: ImportBatch;
  contacts: ImportRow[];
  fixLog: FixLogEntry[];
}

export type FlagAction = 'keep' | 'remove' | 'find_email';

/**
 * A Network import and the cleanup TODD runs right after it
 * (`/api/network/imports`, todd-backend networkImportCleanup.service.js;
 * design_handoff_network_onboarding 04–05). The import opens a batch, the
 * contacts are written tagged with it, then start() queues cleanup.
 */
@Injectable( { providedIn: 'root' } )
export class NetworkImportService {
  private readonly http = inject( HttpClient );
  private readonly base = `${environment.backendURL}/network/imports`;

  async create ( source: string, total: number ): Promise<string> {
    const response = await firstValueFrom( this.http.post<{ batchId: string }>(
      this.base, { source, total }, { headers: await this.headers() } ) );
    return response.batchId;
  }

  async start ( batchId: string ): Promise<void> {
    await firstValueFrom( this.http.post( `${this.base}/${batchId}/start`, {}, { headers: await this.headers() } ) );
  }

  async get ( batchId: string ): Promise<ImportState> {
    const response = await firstValueFrom( this.http.get<{ data: ImportState }>(
      `${this.base}/${batchId}`, { headers: await this.headers() } ) );
    return response.data;
  }

  async resolveFlag ( batchId: string, contactId: string, action: FlagAction ): Promise<ImportState> {
    const response = await firstValueFrom( this.http.post<{ data: ImportState }>(
      `${this.base}/${batchId}/flags/${contactId}`, { action }, { headers: await this.headers() } ) );
    return response.data;
  }

  isFinished ( batch: ImportBatch | null | undefined ): boolean {
    return batch?.status === 'done' || batch?.status === 'failed';
  }

  private async headers (): Promise<Record<string, string>> {
    const user = getAuth().currentUser;
    if ( !user ) throw new Error( 'Please sign in again.' );
    return { Authorization: `Bearer ${await user.getIdToken()}` };
  }
}
