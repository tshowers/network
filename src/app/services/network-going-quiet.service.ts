import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { getAuth } from 'firebase/auth';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface GoingQuietItem {
  contactId: string;
  name: string;
  firstName: string;
  title: string;
  company: string;
  email: string;
  kind: 'quiet' | 'opened_no_reply';
  days: number;
  /** "last talked 41 days ago" / "opened your last email, no reply". */
  reason: string;
  /** A one-paragraph note in the user's voice; empty without Network. */
  draftPreview: string;
}

export interface GoingQuiet {
  items: GoingQuietItem[];
  repliesThisWeek: number;
  /** Contacts with a checked, deliverable email - what "Email them in Outreach" opens with. */
  readyContactIds: string[];
}

/**
 * "Going quiet" on Home (`/api/network/going-quiet`, todd-backend
 * networkGoingQuiet.service.js; design_handoff_network_onboarding 10).
 */
@Injectable( { providedIn: 'root' } )
export class NetworkGoingQuietService {
  private readonly http = inject( HttpClient );
  private readonly base = `${environment.backendURL}/network/going-quiet`;

  async load (): Promise<GoingQuiet> {
    const response = await firstValueFrom( this.http.get<{ data: GoingQuiet }>( this.base, { headers: await this.headers() } ) );
    return response.data;
  }

  async snooze ( contactId: string ): Promise<void> {
    await firstValueFrom( this.http.post( `${this.base}/${contactId}/snooze`, {}, { headers: await this.headers() } ) );
  }

  private async headers (): Promise<Record<string, string>> {
    const user = getAuth().currentUser;
    if ( !user ) throw new Error( 'Please sign in again.' );
    return { Authorization: `Bearer ${await user.getIdToken()}` };
  }
}
