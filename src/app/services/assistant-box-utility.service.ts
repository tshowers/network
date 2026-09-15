import { Injectable } from '@angular/core';
import { AssistantBoxHelperService } from './assistant-box-helper.service';
import { LoggerService } from './logger.service';
import { ConversationService } from './conversation.service';

export type AssistantHistoryMessage = { role: 'user' | 'assistant'; content: string; };

/**
 * Trimmed port of TODD's AssistantBoxUtilityService. The contact-summary
 * helpers (getContactInsightHtml, getPrimaryEmailFrom/PhoneFrom,
 * buildRouteForContact, cleanExtractedName) are the slice
 * ContactLocalAssistantService actually needs and carry no cross-product
 * knowledge. Everything Outreach/Catalyst-specific (campaign prompts, demo
 * script, email-draft extraction) is dropped, not ported.
 */
@Injectable( { providedIn: 'root' } )
export class AssistantBoxUtilityService {
  constructor ( private assistantBoxHelperService: AssistantBoxHelperService, private logger: LoggerService, private conversationService: ConversationService ) { }

  public normalizeModelOutputToHtml ( input: any ): string {
    const raw = String( input ?? '' );
    if ( !raw.trim() ) return '';

    const pre = raw.replace( /\*\*(.+?)\*\*/g, '<strong>$1</strong>' );
    const looksHtml = /<\s*[a-zA-Z][\s\S]*?>/.test( pre );

    const html = looksHtml
      ? pre
      : this.assistantBoxHelperService.convertMarkdownToHtml( pre );

    return this.assistantBoxHelperService.normalizeAssistantHtml(
      this.linkifySlashRoutes( html )
    );
  }

  public linkifySlashRoutes ( input: string ): string {
    const s = String( input ?? '' );
    if ( !s ) return s;

    if ( s.includes( 'href="/' ) || s.includes( "href='/" ) ) return s;

    const routeRegex = /(^|[\s\(\[\{>\"\'])(\/[^\s\)\]\}\>\"\']+)/g;

    return s.replace( routeRegex, ( _full, boundary: string, route: string ) => {
      const unquoted = route.replace( /^['\"]+|['\"]+$/g, '' );
      const m = unquoted.match( /^(\/[^\s\)\]\}\>\"\']+)([\.,;:!?]+)?$/ );
      const cleanRoute = ( m?.[1] || unquoted ).trim();
      const trail = m?.[2] || '';

      if ( !cleanRoute.startsWith( '/' ) ) return `${boundary}${route}`;

      const a = `<a href="${cleanRoute}" class="route-link" data-path="${cleanRoute}">${cleanRoute}</a>`;
      return `${boundary}${a}${trail}`;
    } );
  }

  // Turn contact._insight into a small HTML block for the assistant
  public getContactInsightHtml ( contact: any ): string | null {
    const raw =
      contact?._insight ||
      contact?.insight ||
      ( contact?.meta && ( contact.meta._insight || contact.meta.insight ) );

    if ( !raw || typeof raw !== 'string' ) return null;

    let text = raw.replace( /\r\n/g, '\n' ).trim();
    if ( !text ) return null;

    text = text.replace( /<\/?[^>]+>/g, '' );

    const lines = text
      .split( /\n+/ )
      .map( l => ( l || '' ).trim() )
      .filter( Boolean );

    const sectionDefs: Array<{ key: string; label: string; re: RegExp; }> = [
      { key: 'tip', label: 'Relationship Tip', re: /^(relationship\s+tip|tip)\s*:\s*/i },
      { key: 'action', label: 'Recommended Action', re: /^(recommended\s+action|action)\s*:\s*/i },
      { key: 'task', label: 'Suggested Task', re: /^(suggested\s+task|task)\s*:\s*/i }
    ];

    const sections: Array<{ label: string; value: string; }> = [];

    for ( const line of lines ) {
      const def = sectionDefs.find( d => d.re.test( line ) );
      if ( def ) {
        const value = line.replace( def.re, '' ).trim();
        if ( value ) sections.push( { label: def.label, value } );
        continue;
      }

      if ( sections.length ) {
        sections[sections.length - 1].value = `${sections[sections.length - 1].value}\n${line}`.trim();
      }
    }

    if ( sections.length ) {
      const rows = sections.map( s => {
        const body = this.assistantBoxHelperService.convertMarkdownToHtml( ( s.value || '' ).trim() );
        return `
          <div class="assistant-insight-row">
            <div class="assistant-insight-label"><strong>${s.label}</strong></div>
            <div class="assistant-insight-body">${body}</div>
          </div>
        `.trim();
      } ).join( '' );

      return `
        <div class="assistant-insight-block">
          ${rows}
        </div>
      `;
    }

    const normalized = text.replace( /\n{3,}/g, '\n\n' );
    const body = this.assistantBoxHelperService.convertMarkdownToHtml( normalized );

    return `
      <div class="assistant-insight-block">
        <strong>Relationship Insight</strong>
        <div class="assistant-insight-body">
          ${body}
        </div>
      </div>
    `;
  }

  public getPrimaryEmailFrom ( c: any ): string {
    return c?.email || ( Array.isArray( c?.emailAddresses ) && c.emailAddresses[0]?.emailAddress ) || '';
  }

  public getPrimaryPhoneFrom ( c: any ): string {
    return ( Array.isArray( c?.phoneNumbers ) && c.phoneNumbers[0]?.phoneNumber ) || '';
  }

  public resolveContactId ( c: any ): string {
    return c?.id || c?.uid || c?.loginID || '';
  }

  public buildRouteForContact ( c: any, displayName: string ): { path: string; param?: any; } {
    const id = this.resolveContactId( c );
    if ( id ) return { path: `/contact/${id}` };
    return { path: '/contact-list', param: { q: displayName } };
  }

  public cleanExtractedName ( raw: string ): string {
    return ( raw || '' ).replace( /[.,!?]$/, '' ).trim();
  }

  public getConfirmPrimaryLabel ( pendingAction: { action: string; param: any; } | null ): string {
    if ( !pendingAction ) return '✅ Yes, do it';

    if ( pendingAction.action === 'navigate' ) {
      const p = pendingAction.param;
      if ( p && typeof p === 'object' && p.path ) {
        if ( p.path.includes( 'contact-list' ) ) return p.params ? 'Apply' : '📇 Open Contact List';
        if ( p.path.includes( 'contact/' ) ) return '👤 Open Contact';
        return '➡️ Open';
      }
      const route = String( p || '' );
      if ( route.includes( 'contact/' ) ) return '👤 Open Contact';
      if ( route.includes( 'contact-list' ) ) return '📇 Open Contact List';
      return '➡️ Open';
    }

    return '✅ Yes, do it';
  }

  public loadHistoryFromStorage ( historyStorageKey: string | null, externalMode: boolean ): AssistantHistoryMessage[] {
    if ( !historyStorageKey || !externalMode ) return [];
    try {
      const raw = localStorage.getItem( historyStorageKey );
      if ( !raw ) return [];
      const parsed = JSON.parse( raw );
      return Array.isArray( parsed ) ? parsed as AssistantHistoryMessage[] : [];
    } catch ( e ) {
      this.logger.error( 'ASSISTANT_BOX_HISTORY_LOAD_ERROR', e );
      return [];
    }
  }

  public persistHistory ( historyStorageKey: string | null, externalMode: boolean, history: AssistantHistoryMessage[] ): void {
    if ( !historyStorageKey || !externalMode ) return;
    try {
      const trimmed = history.slice( -50 );
      localStorage.setItem( historyStorageKey, JSON.stringify( trimmed ) );
      this.conversationService.setHistory( trimmed );
    } catch ( e ) {
      this.logger.error( 'ASSISTANT_BOX_HISTORY_SAVE_ERROR', e );
    }
  }

  public normalizeInlineReply ( reply: any ): { kind: string; payload: any; apply: { route: string; param?: any | null; }; } | null {
    if ( !reply || !reply.inline ) return null;

    if ( typeof reply.inline === 'object' && reply.inline.kind ) {
      return reply.inline;
    }

    if ( typeof reply.inline === 'string' ) {
      return {
        kind: 'genericText',
        payload: { text: String( reply.inline || '' ).trim() },
        apply: { route: reply.route || '/contact-list', param: reply.param || null }
      };
    }

    return null;
  }

  public getConfirmActionMessage ( pendingAction: { action: string, param: any; } | null ): string {
    const action = pendingAction?.action;
    const param = pendingAction?.param;

    if ( !action ) return 'Action available.';

    switch ( action ) {
      case 'navigate':
        if ( typeof param === 'string' && param.includes( '/contact/' ) ) return 'Open this contact?';
        if ( typeof param === 'string' && param.includes( '/contact-list' ) ) return 'Open the Contact List?';
        if ( param?.path?.includes( '/contact-list' ) ) return 'Open the Contact List?';
        return 'Open this page?';

      case 'addNewContact':
        return 'Create this contact?';

      case 'updateContactField':
        return 'Update this contact field?';

      case 'addContactField':
        return 'Add this contact detail?';

      default:
        return 'Do you want TODD to do this?';
    }
  }
}
