import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { getAuth } from 'firebase/auth';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface GettingStartedStep {
  id: 'profile' | 'contacts' | 'stages' | 'reachOut' | string;
  title: string;
  detail: string;
  done: boolean;
}

export interface GettingStarted {
  steps: GettingStartedStep[];
  completedSteps: number;
  totalSteps: number;
  allDone: boolean;
}

/**
 * Network's "Getting started" checklist (`GET /api/network/getting-started`,
 * todd-backend gettingStarted.service.js) - the same data network-ios's
 * GettingStartedView shows, checked off from the tenant's real contacts
 * and profile. Shown on the Help page, and opened after sign-in while
 * steps remain.
 */
@Injectable( { providedIn: 'root' } )
export class GettingStartedService {
  private readonly showAfterSignInKey = 'network_getting_started_show_after_sign_in';
  private readonly shownThisSessionKey = 'network_getting_started_shown';

  constructor ( private readonly http: HttpClient ) { }

  async load (): Promise<GettingStarted | null> {
    const user = getAuth().currentUser;
    if ( !user ) return null;
    const response = await firstValueFrom( this.http.get<{ data: GettingStarted }>(
      `${environment.backendURL}/network/getting-started`,
      { headers: { Authorization: `Bearer ${await user.getIdToken()}` } },
    ) );
    return response.data;
  }

  get showAfterSignIn (): boolean {
    try {
      return localStorage.getItem( this.showAfterSignInKey ) !== 'false';
    } catch {
      return true;
    }
  }

  set showAfterSignIn ( value: boolean ) {
    try {
      localStorage.setItem( this.showAfterSignInKey, String( value ) );
    } catch { }
  }

  /**
   * True at most once per browser session, when the user wants the
   * checklist after sign-in and still has steps left. Never throws.
   */
  async shouldShowAfterSignIn (): Promise<boolean> {
    try {
      if ( !this.showAfterSignIn || sessionStorage.getItem( this.shownThisSessionKey ) ) return false;
      const progress = await this.load();
      if ( !progress || progress.allDone ) return false;
      sessionStorage.setItem( this.shownThisSessionKey, '1' );
      return true;
    } catch {
      return false;
    }
  }

  /** Where each step's action goes on web. */
  routeFor ( step: GettingStartedStep ): string {
    switch ( step.id ) {
      case 'profile': return '/profile';
      case 'contacts': return '/contact-import';
      case 'stages': return '/contact-list';
      default: return '/app';
    }
  }

  actionFor ( step: GettingStartedStep ): string {
    switch ( step.id ) {
      case 'profile': return step.done ? 'View profile' : 'Complete profile';
      case 'contacts': return step.done ? 'Import more' : 'Import contacts';
      case 'stages': return step.done ? 'Review stages' : 'Set stages';
      default: return step.done ? 'Keep going' : 'Pick someone';
    }
  }
}
