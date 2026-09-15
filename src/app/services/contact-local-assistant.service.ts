import { Injectable } from '@angular/core';
import { NetworkDataService } from './network-data.service';
import { AssistantBoxUtilityService } from './assistant-box-utility.service';
import { AssistantBoxHelperService } from './assistant-box-helper.service';
import { MomentumNudgeService } from './momentum-nudge.service';

export interface ContactFilterParseResult {
    handled: boolean;
    key?: string;
    value?: string;
    filters?: any;
    message?: string;
}

export interface ContactLookupParseResult {
    handled: boolean;
    variant?: 'question' | 'imperative';
    name?: string;
}

/**
 * Port of TODD's ContactLocalAssistantService. The only real change from
 * the original is the data layer it calls: TODD's ContactService.findByName
 * / getLastContactDate become NetworkDataService.findContactsByName here
 * (client-side filter over getAllContacts, same as list.component.ts's own
 * loadData()), threaded through with tenantId since this app doesn't have
 * ContactService's implicit tenant resolution. Network doesn't track a
 * lastContacted field yet, so "when did I last contact X" answers fall back
 * to the contact record's own fields only - no separate lookup.
 */
@Injectable( { providedIn: 'root' } )
export class ContactLocalAssistantService {
    constructor (
        private dataService: NetworkDataService,
        private util: AssistantBoxUtilityService,
        private helper: AssistantBoxHelperService,
        private momentum: MomentumNudgeService,
    ) { }

    tryFilterParse ( raw: string ): ContactFilterParseResult | null {
        if ( !raw ) return null;
        const text = raw.trim();

        const certMatch = text.match( /\b(mbe|dbe|8\s*a|8a|wbe|sbe|vbe|lbe|smb|sdvosb|edwosb|wosb)\b/i );

        const m1 = text.match( /\bfilter\s+contacts\s+by\s+(tag|category|status|technology|type|profile\s*type|profile|certification)(?:\s+by)?(?:\s+(.*))?$/i );
        const m2 = text.match( /\b(?:find|show|list|get)\s+(?:me\s+)?contacts\s+(?:in|with|by)\s+(?:the\s+)?(tag|category|status|technology|type|profile\s*type|profile|certification)\s+(.*)$/i );

        let key: string | null = null;
        let rawVal: string | null = null;
        if ( m1 ) { key = m1[1]; rawVal = ( m1[2] || '' ).trim(); }
        else if ( m2 ) { key = m2[1]; rawVal = ( m2[2] || '' ).trim(); }

        if ( !key && certMatch ) { key = 'profileType'; rawVal = certMatch[1]; }
        if ( !key && !rawVal ) return null;

        const map: Record<string, string> = {
            tag: 'capability',
            technology: 'capability',
            category: 'category',
            status: 'status',
            type: 'profileType',
            profile: 'profileType',
            'profile type': 'profileType',
            certification: 'profileType',
            profileType: 'profileType',
        } as const;

        const normalizedKey = ( key || '' ).toLowerCase().replace( /\s+/g, ' ' );
        const qpKey = map[normalizedKey] || ( certMatch ? 'profileType' : 'q' );
        const value = ( rawVal || '' ).replace( /^by\s+/i, '' ).trim() || ( certMatch ? certMatch[1] : '' );
        const filters: any = value ? { [qpKey]: value } : { openFilters: true };

        const msg = value
            ? `Opening the <strong>Contact List</strong> filtered by <strong>${qpKey}</strong> = <strong>${value}</strong>…`
            : `Open the <em>Contact List</em> to choose a ${normalizedKey || 'filter'}? Click <em>Apply</em>.`;

        return { handled: true, key: qpKey, value, filters, message: msg };
    }

    tryLookupByNameParse ( raw: string ): ContactLookupParseResult | null {
        const p = ( raw || '' ).trim();
        if ( !p ) return null;

        const imperative = p.match( /^\s*(find|lookup|show|get)\s+(?:me\s+)?(?:contact|person)\s+(.+)$/i );
        const isInContacts = p.match( /^\s*is\s+(.+?)\s+in\s+my\s+contacts?\s*\??$/i );
        if ( !imperative && !isInContacts ) return null;

        const name = imperative ? imperative[2] : isInContacts![1];
        if ( !name ) return null;

        return {
            handled: true,
            variant: imperative ? 'imperative' : 'question',
            name: name.trim(),
        };
    }

    /* -------------------- Deep local handlers (async) -------------------- */
    private isLikelyPersonName ( raw: string ): boolean {
        if ( !raw ) return false;
        const s = raw.trim();
        if ( !s ) return false;
        const parts = s.split( /\s+/ );
        if ( parts.length === 0 || parts.length > 3 ) return false;
        const nameRe = /^[A-Z][a-zA-Z'’\-]+$/;
        return parts.every( p => nameRe.test( p ) );
    }

    private reSummarize = /^(?:summarize|summary of|overview of|give me (?:a )?summary of|recap)\s+(.+)$/i;
    private reContactQuestion = /^(?:what|when|how|who|where|which|do|does|did|is|are|can|should).+?\s(?:of|for|about|with)\s+(.+)$/i;
    private reLastContact = /^(?:when|what)\b.*(?:last\s*(?:email|contact(?:ed)?|follow[-\s]?up))\s*(?:with|for)?\s+(.+)$/i;
    private reDirectQA = /^(?:what|when|how|who|where|which|do|does|did|is|are|can|should)\s+.+?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})$/;

    async tryLocal ( prompt: string, tenantId: string ): Promise<{
        handled: boolean;
        assistantResponse?: string;
        inlineReply?: any;
        pendingAction?: { action: string; param: any; } | null;
        showConfirmPrompt?: boolean;
    } | null> {
        const raw = ( prompt || '' ).trim();
        if ( !raw || !tenantId ) return null;

        let m = raw.match( this.reSummarize );
        if ( m && m[1] ) {
            const name = this.util.cleanExtractedName( m[1] );
            return await this.buildContactSummary( name, tenantId );
        }

        m = raw.match( this.reContactQuestion ) || raw.match( this.reLastContact ) || raw.match( this.reDirectQA );
        if ( m && m[1] ) {
            const candidate = this.util.cleanExtractedName( m[1] );
            if ( this.isLikelyPersonName( candidate ) ) {
                return await this.buildContactAnswer( raw, candidate, tenantId );
            }
        }

        const lookup = this.tryLookupByNameParse( raw );
        if ( lookup && lookup.handled && lookup.name ) {
            if ( lookup.variant === 'question' ) {
                return await this.lookupExistsQuestion( lookup.name, tenantId );
            } else {
                return await this.buildContactSummary( lookup.name, tenantId );
            }
        }

        return null;
    }

    private async lookupExistsQuestion ( rawName: string, tenantId: string ) {
        const name = this.util.cleanExtractedName( rawName );
        const found = await this.findFirstByName( name, tenantId );
        if ( found && found.id ) {
            return {
                handled: true,
                assistantResponse: `${name} is in your contacts. Open it?`,
                pendingAction: { action: 'navigate', param: `/contact/${found.id}` },
                showConfirmPrompt: true
            };
        } else {
            return { handled: true, assistantResponse: `${name} is not in your contacts.`, pendingAction: null, showConfirmPrompt: false };
        }
    }

    private async buildContactSummary ( rawName: string, tenantId: string ) {
        const name = this.util.cleanExtractedName( rawName );
        const contact = await this.findFirstByName( name, tenantId );
        if ( !contact ) {
            return { handled: true, assistantResponse: `${name} is not in your contacts.`, inlineReply: null, showConfirmPrompt: false };
        }

        const displayName = ( contact as any ).displayName || [contact.firstName, contact.lastName].filter( Boolean ).join( ' ' ).trim() || name;
        const primaryEmail = this.util.getPrimaryEmailFrom( contact );
        const primaryPhone = this.util.getPrimaryPhoneFrom( contact );
        let location = '';
        if ( Array.isArray( ( contact as any ).addresses ) && ( contact as any ).addresses.length ) {
            const a = ( contact as any ).addresses[0];
            location = [a.city, a.state, a.country].filter( Boolean ).join( ', ' );
        }
        let tags: string[] = [];
        if ( Array.isArray( contact.category ) ) {
            tags = contact.category.filter( Boolean ).slice( 0, 8 );
        } else if ( typeof contact.category === 'string' && contact.category ) {
            tags = [contact.category];
        }

        const lastActivity = ( contact as any ).lastContacted ? new Date( ( contact as any ).lastContacted ).toLocaleDateString() : '';

        const payload: any = {
            id: this.util.resolveContactId( contact ),
            name: displayName,
            title: contact.profession || contact.status || '',
            company: ( contact as any ).company?.name || '',
            email: primaryEmail,
            phone: primaryPhone,
            location,
            tags,
            lastActivity,
        };

        const route = this.util.buildRouteForContact( contact, displayName );
        let response = `Here's a quick summary for ${payload.name}.`;
        const insightHtml = this.util.getContactInsightHtml( contact );
        if ( insightHtml ) response += this.helper.normalizeAssistantHtml( `<hr/>${insightHtml}` );

        try { this.momentum.register( {} ); } catch { }

        return {
            handled: true,
            assistantResponse: response,
            inlineReply: { kind: 'contactSummary', payload, apply: { route: route.path, param: route.param } },
            pendingAction: null,
            showConfirmPrompt: false
        };
    }

    private async buildContactAnswer ( question: string, rawName: string, tenantId: string ) {
        const name = this.util.cleanExtractedName( rawName );
        const contact = await this.findFirstByName( name, tenantId );
        if ( !contact ) {
            return { handled: true, assistantResponse: `${name} is not in your contacts.`, inlineReply: null, showConfirmPrompt: false };
        }
        const displayName = ( contact as any ).displayName || [contact.firstName, contact.lastName].filter( Boolean ).join( ' ' ).trim() || name;
        const lowerQ = question.toLowerCase();
        const email = this.util.getPrimaryEmailFrom( contact );
        const phone = this.util.getPrimaryPhoneFrom( contact );
        const role = contact.profession || contact.status || '';
        const company = ( contact as any ).company?.name || '';
        let categories: string[] = [];
        if ( Array.isArray( contact.category ) ) {
            categories = contact.category.filter( Boolean );
        } else if ( typeof contact.category === 'string' && contact.category ) {
            categories = [contact.category];
        }
        const evidence: string[] = [];
        let answer = 'I can’t find that info.';
        if ( lowerQ.includes( 'email' ) && email ) { answer = email; evidence.push( 'email/emailAddresses' ); }
        if ( ( lowerQ.includes( 'phone' ) || lowerQ.includes( 'cell' ) || lowerQ.includes( 'mobile' ) ) && phone ) { answer = phone; evidence.push( 'phoneNumbers' ); }
        if ( ( lowerQ.includes( 'title' ) || lowerQ.includes( 'role' ) || lowerQ.includes( 'position' ) ) && role ) { answer = role; evidence.push( 'profession/status' ); }
        if ( ( lowerQ.includes( 'company' ) || lowerQ.includes( 'employer' ) ) && company ) { answer = company; evidence.push( 'company.name' ); }
        if ( ( lowerQ.includes( 'tag' ) || lowerQ.includes( 'category' ) || lowerQ.includes( 'capabilit' ) ) && categories.length ) { answer = categories.join( ', ' ); evidence.push( 'category' ); }

        const wantLastContact =
            lowerQ.includes( 'last email' ) ||
            lowerQ.includes( 'last contacted' ) ||
            lowerQ.includes( 'last contact' ) ||
            lowerQ.includes( 'last follow up' ) ||
            lowerQ.includes( 'last follow-up' );

        if ( wantLastContact && ( contact as any ).lastContacted ) {
            answer = new Date( ( contact as any ).lastContacted ).toLocaleDateString();
            evidence.push( 'lastContacted' );
        }

        const route = this.util.buildRouteForContact( contact, displayName );
        let response = `Answer for ${displayName}: ${answer}`;
        const insightHtml = this.util.getContactInsightHtml( contact );
        if ( insightHtml ) response += this.helper.normalizeAssistantHtml( `<hr/>${insightHtml}` );
        try { this.momentum.register( {} ); } catch { }

        return {
            handled: true,
            assistantResponse: response,
            inlineReply: { kind: 'contactAnswer', payload: { question, answer, evidence }, apply: { route: route.path, param: route.param } },
            pendingAction: null,
            showConfirmPrompt: false
        };
    }

    private async findFirstByName ( name: string, tenantId: string ): Promise<any | null> {
        const result = await this.dataService.findContactsByName( tenantId, name ).catch( () => [] as any[] );
        return ( Array.isArray( result ) && result[0] ) || null;
    }
}
