import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { getAuth } from 'firebase/auth';
import { firstValueFrom } from 'rxjs';
import { ProfileCompletion } from '@taliferro/ui/platform/profile-choices.model';
import { environment } from '../../environments/environment';

export type OnboardingStepId = 'contacts' | 'cleanup' | 'profile' | 'review' | 'reachOut';

export interface OnboardingStep {
  id: OnboardingStepId;
  title: string;
  /** "You", "Automatic", "You · 1 minute". */
  kicker: string;
  detail: string;
  done: boolean;
  /** False until the step can be started (review and reach out wait for cleanup). */
  available: boolean;
  /** TODD does it - never the current step, never has an action. */
  automatic: boolean;
}

export interface NetworkOnboarding {
  steps: OnboardingStep[];
  completedSteps: number;
  totalSteps: number;
  allDone: boolean;
  firstName: string;
  profileCompletion: ProfileCompletion;
  aiProfile: { answered: number; total: number };
  counts: { imported: number; emails: number; checked: number; fixed: number; enriched: number; flagged: number; reachedOut: number };
  state: { weeklyDigest: boolean; outreachOpenedAt: string | null; neverOpenedBannerDismissedAt: string | null };
}

export type OnboardingPatch = { weeklyDigest?: boolean; outreachOpened?: true; dismissNeverOpenedBanner?: true };

const OUTREACH_URL = 'https://outreach.taliferro.tech';

/**
 * Network's five-step setup checklist (`GET/PATCH /api/network/onboarding`,
 * todd-backend gettingStarted.service.js computeNetworkOnboarding;
 * design_handoff_network_onboarding). Checked off from the tenant's real
 * contacts and the shared profile, so it follows the user across devices.
 * One copy for the header's Setup pill, Home and Help.
 */
@Injectable( { providedIn: 'root' } )
export class NetworkOnboardingService {
  private readonly http = inject( HttpClient );
  private readonly isBrowser = isPlatformBrowser( inject( PLATFORM_ID ) );
  private inFlight: Promise<NetworkOnboarding | null> | null = null;

  /** null until loaded, or when signed out. */
  readonly onboarding = signal<NetworkOnboarding | null>( null );

  /** The first step the user still has to do - TODD's own step is never "current". */
  readonly currentStepId = computed<OnboardingStepId | null>( () =>
    this.onboarding()?.steps.find( ( step ) => !step.done && !step.automatic )?.id ?? null );

  /** Reloads from the server. Never throws - a failed load keeps the last state. */
  refresh (): Promise<NetworkOnboarding | null> {
    if ( !this.isBrowser ) return Promise.resolve( null );
    if ( this.inFlight ) return this.inFlight;
    this.inFlight = ( async () => {
      try {
        const user = getAuth().currentUser;
        if ( !user ) {
          this.onboarding.set( null );
          return null;
        }
        const response = await firstValueFrom( this.http.get<{ data: NetworkOnboarding }>(
          `${environment.backendURL}/network/onboarding`, { headers: await this.headers() } ) );
        this.onboarding.set( response.data );
        return response.data;
      } catch {
        return this.onboarding();
      } finally {
        this.inFlight = null;
      }
    } )();
    return this.inFlight;
  }

  async update ( patch: OnboardingPatch ): Promise<void> {
    try {
      const response = await firstValueFrom( this.http.patch<{ data: NetworkOnboarding }>(
        `${environment.backendURL}/network/onboarding`, patch, { headers: await this.headers() } ) );
      this.onboarding.set( response.data );
    } catch ( error ) {
      console.warn( '[NetworkOnboardingService] update failed', error );
    }
  }

  clear (): void {
    this.onboarding.set( null );
  }

  /** Where a step's action goes. reachOut opens Outreach instead (openOutreach). */
  routeFor ( step: OnboardingStep ): string {
    switch ( step.id ) {
      case 'contacts': return '/contact-import';
      case 'profile': return '/profile';
      default: return '/contact-list';
    }
  }

  actionFor ( step: OnboardingStep ): string {
    switch ( step.id ) {
      case 'contacts': return 'Import';
      case 'cleanup': return 'Watch';
      case 'profile': return 'Answer';
      case 'review': return 'Review';
      default: return 'Reach out';
    }
  }

  /** Opens Outreach in a new tab and checks off "Start reaching out". */
  openOutreach (): void {
    window.open( `${OUTREACH_URL}/?source=network`, '_blank', 'noopener' );
    void this.update( { outreachOpened: true } );
  }

  private async headers (): Promise<Record<string, string>> {
    const user = getAuth().currentUser;
    if ( !user ) throw new Error( 'Please sign in again.' );
    return { Authorization: `Bearer ${await user.getIdToken()}` };
  }
}
