import { Injectable } from '@angular/core';

/**
 * Trimmed port of TODD's AssistantIntentRunnerService. The original also
 * decides early intercepts for Catalyst/composer/email-sent flows and
 * routes across four domains (task/document/survey/contact) - none of that
 * applies here, since this app only ever has one domain. Kept as its own
 * service (rather than inlined into the engine) so the shape matches
 * TODD's, in case a second domain is ever added to Network directly.
 */
@Injectable( { providedIn: 'root' } )
export class AssistantIntentRunnerService {
    /** Only one domain exists here, so this only ever confirms it applies. */
    routeDomain ( prompt: string ): 'contact' | null {
        const p = ( prompt || '' ).trim();
        if ( !p ) return null;
        const lower = p.toLowerCase();

        if ( /(\bcontact\b|\bcontacts\b|lead|leads|pipeline|prospect|phone|email|title|company|tag|category)/.test( lower ) ) return 'contact';

        return null;
    }
}
