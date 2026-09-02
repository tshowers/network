import { Injectable } from '@angular/core';

/**
 * Deliberately minimal stand-in for the real AffiliateTrackingService
 * (264 lines: URL-param capture, session/local storage promotion, legacy
 * referral-code fallback, route-change "touch" tracking). Checkout works
 * fine with no referrerUid at all (it's an optional field), so full
 * affiliate attribution wasn't ported - revisit if/when Network actually
 * runs an affiliate program of its own.
 */
@Injectable( { providedIn: 'root' } )
export class AffiliateReferrerService {
  getReferrerUid (): string | null {
    return null;
  }
}
