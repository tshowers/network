import { Injectable } from '@angular/core';

export interface LandingEngagementConfig {
  featureKey: string;
  title: string;
  description: string;
  primaryRoute: string;
  pricingRoute: string;
}

/**
 * No-op stand-in for LandingPageEngagementContextService. The real one
 * feeds scroll-depth/exit-intent/CTA-click signals to TODD's assistant bus
 * so the assistant can react to visitor engagement - since this app
 * deliberately doesn't carry the full assistant bus (see the assistant-box
 * scoping decision), there's nothing for these signals to feed. Kept as a
 * same-shaped no-op rather than deleted so the ported component's
 * structure - and the option to wire real analytics here later - stays
 * intact.
 */
@Injectable( { providedIn: 'root' } )
export class LandingEngagementService {
  start ( _config: LandingEngagementConfig ): void { }
  stop (): void { }
  markPrimaryCtaClick (): void { }
  markPricingCtaClick (): void { }
  markExitIntent (): void { }
  updateScrollDepth ( _depth: number ): void { }
}
