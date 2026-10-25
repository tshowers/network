import { Injectable, inject } from '@angular/core';

import { NetworkNotificationService } from './network-notification.service';
import { NetworkOnboardingService } from './network-onboarding.service';

const OUTREACH_URL = 'https://outreach.taliferro.tech';
/** Ids per link; Outreach opens with these selected. */
const MAX_CONTACTS = 50;

/**
 * Every "Email" action in Network: opens Outreach's composer with the
 * contacts preselected and a first draft from the profile
 * (`/compose-email?contactIds=…&source=network&draft=profile`, the same
 * link todd-backend's networkOnboardingEmails.service.js sends). Without
 * Outreach, Outreach shows its own browse notice and subscribe button.
 */
@Injectable( { providedIn: 'root' } )
export class OutreachLinkService {
  private readonly notifications = inject( NetworkNotificationService );
  private readonly onboarding = inject( NetworkOnboardingService );

  composeUrl ( contactIds: string[] ): string {
    const ids = contactIds.filter( Boolean ).slice( 0, MAX_CONTACTS ).map( encodeURIComponent ).join( ',' );
    return ids ? `${OUTREACH_URL}/compose-email?contactIds=${ids}&source=network&draft=profile` : `${OUTREACH_URL}/compose-email?source=network`;
  }

  /**
   * @param contactIds Who to email.
   * @param label For the toast: "Priya Raman", "9 contacts".
   */
  open ( contactIds: string[], label: string ): void {
    this.notifications.show( 'Outreach', `Opening Outreach with ${label} selected…`, 'info' );
    window.open( this.composeUrl( contactIds ), '_blank', 'noopener' );
    void this.onboarding.update( { outreachOpened: true } );
  }
}
