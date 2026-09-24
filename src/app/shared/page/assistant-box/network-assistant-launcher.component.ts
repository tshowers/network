import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, NgZone, OnDestroy, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { AssistantBoxComponent } from './assistant-box.component';
import { NetworkAuthService } from '../../../services/network-auth.service';
import { NetworkAssistantPageContext, NetworkAssistantSignalService } from '../../../services/network-assistant-signal.service';

type GuidanceTone = 'neutral' | 'progress' | 'attention' | 'ready';

interface NetworkGuidanceCard {
  eyebrow: string;
  title: string;
  message: string;
  whyItMatters: string;
  bullets: string[];
  stageLabel: string;
  tone: GuidanceTone;
  icon: string;
  nextStage?: string;
}

/** What the template actually binds to - the tone class is precomputed here
 *  so [ngClass] can read a plain field instead of calling a method. */
type RenderedGuidanceCard = NetworkGuidanceCard & { toneClass: string };

/**
 * Network's launcher shell - a small, from-scratch equivalent of TODD's
 * todd-assistant.component.ts (the hidden-until-hover-in-the-corner pill
 * that expands into the chat window). That original is 2,300+ lines because
 * it also carries suite-wide onboarding (ToddActivationStateService,
 * ToddCounselingContractService - entitlements/audience/cross-sell logic
 * spanning all six TODD systems), which is exactly what the assistant-box
 * scoping decision keeps out of this app. The launcher chrome (hotzone,
 * reveal timing, glass window, avatar header) is ported near-verbatim from
 * todd-assistant.component.ts/css since it's pure UI. The guidance card is
 * NOT a port - ToddCounselingContractService reasons over paid-module counts
 * across the whole suite and can't be meaningfully scoped to one product.
 * This is a new, small, rule-based card computed only from the contact
 * stats contact-home.component.ts already publishes to the bus.
 *
 * Shows regardless of login state (matches TODD's own guest-preview
 * behavior): logged out, there's no account data yet, so the card orients
 * a visitor to what this page/product does instead of giving a
 * personalized next move; logged in, it switches to the real
 * contact-stats-driven guidance above.
 */
@Component( {
  selector: 'app-network-assistant-launcher',
  standalone: true,
  imports: [CommonModule, AssistantBoxComponent],
  templateUrl: './network-assistant-launcher.component.html',
  styleUrls: ['./network-assistant-launcher.component.css'],
} )
export class NetworkAssistantLauncherComponent implements OnInit, OnDestroy {
  private readonly authService = inject( NetworkAuthService );
  private readonly assistantBus = inject( NetworkAssistantSignalService );
  private readonly router = inject( Router );
  private readonly zone = inject( NgZone );
  // document.addEventListener below has no meaning during prerendering
  // (Node, no document) — gate ngOnInit's listener setup on this instead of
  // adding a guard at every call site.
  private readonly isBrowser = isPlatformBrowser( inject( PLATFORM_ID ) );

  private readonly launcherHotzoneSize = 180;
  private readonly launcherRevealDurationMs = 2400;
  private launcherHideTimer: ReturnType<typeof setTimeout> | null = null;

  showAssistant = false;
  launcherVisible = false;
  hasUnread = false;
  pageContext: NetworkAssistantPageContext | null = null;
  isLoggedIn = false;

  userId: string | null = null;
  tenantId: string | null = null;

  private readonly subscriptions: Subscription[] = [];

  private readonly onDocumentMouseMove = ( event: MouseEvent ): void => {
    if ( this.isInBottomRightHotzone( event.clientX, event.clientY ) && !this.isOverOtherInteractiveElement( event.target ) ) {
      this.revealLauncherTemporarily();
    }
  };

  private readonly onDocumentTouchStart = ( event: TouchEvent ): void => {
    const touch = event.touches?.[0];
    if ( touch && this.isInBottomRightHotzone( touch.clientX, touch.clientY ) && !this.isOverOtherInteractiveElement( event.target ) ) {
      this.revealLauncherTemporarily();
    }
  };

  /**
   * The hotzone is a broad 180x180 proximity area, not just the pill's own
   * footprint - on narrower viewports a page's own bottom-right-anchored
   * button (e.g. a wizard's primary action) can fall inside it. Revealing
   * the pill there put it, at a higher z-index, physically on top of that
   * button for the rest of the same synthetic event sequence, so a click
   * meant for the page's button landed on the pill instead (toggling the
   * chat open) and the page's own action never fired. Skip the reveal
   * whenever the pointer/touch is already on top of some other clickable
   * element - that means the user is reaching for that, not the assistant.
   */
  private isOverOtherInteractiveElement ( target: EventTarget | null ): boolean {
    if ( !( target instanceof Element ) ) return false;
    if ( target.closest( '.todd-assistant-root' ) ) return false;
    return !!target.closest( 'button, a, input, select, textarea, [role="button"]' );
  }

  ngOnInit (): void {
    this.subscriptions.push(
      this.authService.isLoggedIn().subscribe( ( loggedIn ) => { this.isLoggedIn = loggedIn; this.refreshGuidanceCard(); } ),
      this.authService.getUserId().subscribe( ( id ) => ( this.userId = id || null ) ),
      this.authService.getTenantId().subscribe( ( id ) => ( this.tenantId = id || null ) ),
      this.assistantBus.pageContext$.subscribe( ( ctx ) => { this.pageContext = ctx; this.refreshGuidanceCard(); } ),
      this.assistantBus.unread$.subscribe( ( unread ) => ( this.hasUnread = unread ) ),
    );

    // Bound manually (rather than @HostListener) and outside Angular's zone:
    // @HostListener always runs its callback inside the zone, which means
    // zone.js schedules a full app-wide change detection pass after every
    // single mousemove/touchstart anywhere on the page, whether or not the
    // pointer is anywhere near the hotzone. On a page with other listeners
    // that also run inside the zone (this app's Angular Router, other
    // global listeners), that adds up to change detection running far more
    // often than the on-screen state actually changes - the fix is to only
    // re-enter the zone (`this.zone.run`) on the rare occasion the pointer
    // is actually in the hotzone and launcherVisible needs to update.
    if ( !this.isBrowser ) return;
    this.zone.runOutsideAngular( () => {
      document.addEventListener( 'mousemove', this.onDocumentMouseMove, { passive: true } );
      document.addEventListener( 'touchstart', this.onDocumentTouchStart, { passive: true } );
    } );
  }

  ngOnDestroy (): void {
    if ( this.launcherHideTimer ) clearTimeout( this.launcherHideTimer );
    this.subscriptions.forEach( ( s ) => s.unsubscribe() );
    if ( !this.isBrowser ) return;
    document.removeEventListener( 'mousemove', this.onDocumentMouseMove );
    document.removeEventListener( 'touchstart', this.onDocumentTouchStart );
  }

  private isInBottomRightHotzone ( clientX: number, clientY: number ): boolean {
    return clientX >= ( window.innerWidth - this.launcherHotzoneSize )
      && clientY >= ( window.innerHeight - this.launcherHotzoneSize );
  }

  private revealLauncherTemporarily (): void {
    this.zone.run( () => {
      this.launcherVisible = true;
      if ( this.launcherHideTimer ) clearTimeout( this.launcherHideTimer );

      if ( this.showAssistant ) return;

      this.launcherHideTimer = setTimeout( () => {
        if ( !this.showAssistant ) this.launcherVisible = false;
      }, this.launcherRevealDurationMs );
    } );
  }

  toggleAssistant (): void {
    this.showAssistant = !this.showAssistant;
    if ( this.showAssistant ) {
      this.launcherVisible = true;
      if ( this.launcherHideTimer ) clearTimeout( this.launcherHideTimer );
      this.assistantBus.clearAssistantUnread();
    }
  }

  dismissAssistant (): void {
    this.showAssistant = false;
    this.launcherVisible = false;
  }

  onAssistantNavigate ( target: { path: string; queryParams?: any; fragment?: string; } ): void {
    if ( !target?.path ) return;
    void this.router.navigate( [target.path], { queryParams: target.queryParams, fragment: target.fragment } );
  }

  guidanceCard: RenderedGuidanceCard | null = null;

  private refreshGuidanceCard (): void {
    const card = this.isLoggedIn ? this.computeGuidanceCard( this.pageContext ) : this.guestOrientationCard;
    this.guidanceCard = card ? { ...card, toneClass: `todd-activation-card--${card.tone}` } : null;
  }

  /**
   * Guest/logged-out mode: there's no account data to reason about yet, so
   * this plays the role TODD's guest-preview landing chat plays - orient a
   * visitor to what this page does and how to use it, rather than a
   * personalized next move.
   */
  private get guestOrientationCard (): NetworkGuidanceCard {
    return {
      eyebrow: 'WHAT IS THIS PAGE',
      stageLabel: 'Overview',
      tone: 'neutral',
      icon: 'fa-solid fa-compass',
      title: 'Network keeps your relationships connected',
      message: 'TODD uses your contacts, companies, deals, and conversations to tell you who needs attention next and where revenue might be slipping away. Sign in to see it work with your own data.',
      whyItMatters: "A contact list alone doesn't tell you what to do next - Network gives TODD the context to figure that out for you.",
      bullets: [
        'Import or add contacts to start tracking relationship health.',
        'TODD flags who’s gone quiet and who’s ready for a follow-up.',
        'Ask this chat how Network works, or what TODD actually does.',
      ],
    };
  }

  /** Dispatches on the `feature` each page publishes - one card builder per page. */
  private computeGuidanceCard ( ctx: NetworkAssistantPageContext | null ): NetworkGuidanceCard | null {
    if ( !ctx ) return null;

    switch ( String( ctx.feature || '' ).toLowerCase() ) {
      case 'contacts': return this.contactHomeCard( ctx );
      case 'contact-list': return this.contactListCard( ctx );
      case 'contact-import': return this.contactImportCard( ctx );
      case 'contact-edit': return this.contactEditCard( ctx );
      case 'pipeline': return this.pipelineCard( ctx );
      default: return null;
    }
  }

  private contactHomeCard ( ctx: NetworkAssistantPageContext ): NetworkGuidanceCard | null {
    const summary = ctx.summary || {};
    const total = Number( summary['totalContacts'] || 0 );
    const enriched = Number( summary['enrichedContacts'] || 0 );
    const validEmail = Number( summary['validEmailContacts'] || 0 );
    const atLimit = summary['atContactLimit'] === true;
    const blockerMessage = String( summary['blockerMessage'] || '' );

    if ( atLimit ) {
      return {
        eyebrow: 'CAPACITY',
        stageLabel: 'At contact limit',
        tone: 'attention',
        icon: 'fa-solid fa-triangle-exclamation',
        title: "You've reached your contact limit",
        message: blockerMessage || "TODD can't add more contacts until you free up space or upgrade.",
        whyItMatters: "New contacts can't be imported or created while you're at capacity.",
        bullets: ['Review the contact list to remove or merge records.', 'Upgrade for more capacity if the network keeps growing.'],
      };
    }

    if ( total === 0 ) {
      return {
        eyebrow: 'GETTING STARTED',
        stageLabel: 'No contacts yet',
        tone: 'attention',
        icon: 'fa-solid fa-triangle-exclamation',
        title: 'Start building your network',
        message: "TODD doesn't see any contacts yet. Import a list or add people one at a time to get relationship health tracking started.",
        whyItMatters: 'Network is where TODD learns who exists before it can tell you who needs attention.',
        bullets: ['Import a CSV of contacts, or add one manually.', 'TODD starts tracking health the moment contacts land here.'],
      };
    }

    const enrichedPct = total > 0 ? enriched / total : 0;
    const validPct = total > 0 ? validEmail / total : 0;

    if ( enrichedPct < 0.5 || validPct < 0.5 ) {
      return {
        eyebrow: 'RELATIONSHIP HEALTH',
        stageLabel: 'Enrichment in progress',
        tone: 'progress',
        icon: 'fa-solid fa-hourglass-half',
        title: 'Keep enrichment moving',
        message: `TODD sees ${total.toLocaleString()} contacts. ${Math.round( enrichedPct * 100 )}% are enriched and ${Math.round( validPct * 100 )}% have valid emails so far.`,
        whyItMatters: 'Enriched, verified records are what makes a contact actionable instead of just a name.',
        bullets: [
          `${Math.round( validPct * 100 )}% have valid, verified emails.`,
          `${Math.round( enrichedPct * 100 )}% are enriched with full contact data.`,
          'Open the Contact List to see which records still need attention.',
        ],
        nextStage: 'Pipeline activation',
      };
    }

    return {
      eyebrow: 'RELATIONSHIP HEALTH',
      stageLabel: 'Ready',
      tone: 'ready',
      icon: 'fa-solid fa-circle-check',
      title: 'The relationship graph is ready for its next layer',
      message: `TODD sees ${total.toLocaleString()} contacts. Review the health signals, keep enrichment moving, and open Pipeline when you are ready to turn relationships into decisions.`,
      whyItMatters: 'Network tells TODD who exists and how trustworthy the record is; Pipeline tells TODD what should happen next.',
      bullets: [
        `Valid email (${Math.round( validPct * 100 )}%) and enriched (${Math.round( enrichedPct * 100 )}%) counts show whether records are becoming actionable.`,
        'Open Pipeline when you’re ready to turn relationships into decisions.',
      ],
      nextStage: 'Pipeline activation',
    };
  }

  private contactListCard ( ctx: NetworkAssistantPageContext ): NetworkGuidanceCard {
    const summary = ctx.summary || {};
    const total = Number( summary['totalContacts'] || 0 );
    const filtered = Number( summary['filteredCount'] ?? total );
    const searchText = String( summary['searchText'] || '' ).trim();

    if ( total === 0 ) {
      return {
        eyebrow: 'CONTACT LIST',
        stageLabel: 'Empty',
        tone: 'attention',
        icon: 'fa-solid fa-triangle-exclamation',
        title: 'This list is empty',
        message: "You don't have any contacts yet. Import a CSV or add someone directly to start browsing your network here.",
        whyItMatters: 'The Contact List is where you browse, search, and open individual records once they exist.',
        bullets: ['Import a CSV of contacts.', 'Or add one contact manually.'],
      };
    }

    if ( searchText && filtered === 0 ) {
      return {
        eyebrow: 'CONTACT LIST',
        stageLabel: 'No matches',
        tone: 'attention',
        icon: 'fa-solid fa-magnifying-glass',
        title: `No matches for "${searchText}"`,
        message: 'Nothing in your network matches that search. Try a different name, company, or email, or clear the search to see everyone.',
        whyItMatters: 'Search looks across name, company, profession, and email - a typo or partial match can hide someone who is actually there.',
        bullets: [`${total.toLocaleString()} total contacts in your network.`],
      };
    }

    if ( searchText ) {
      return {
        eyebrow: 'CONTACT LIST',
        stageLabel: 'Filtered',
        tone: 'neutral',
        icon: 'fa-solid fa-magnifying-glass',
        title: `Showing ${filtered.toLocaleString()} of ${total.toLocaleString()} contacts`,
        message: `Filtered by "${searchText}". Click any row to open that contact, or clear the search to browse everyone.`,
        whyItMatters: 'Search narrows by name, company, profession, or email so you can find one person fast.',
        bullets: [],
      };
    }

    return {
      eyebrow: 'CONTACT LIST',
      stageLabel: 'Browsing',
      tone: 'neutral',
      icon: 'fa-solid fa-address-book',
      title: `Browsing ${total.toLocaleString()} contacts`,
      message: 'Click any contact to open their record, use the search box to narrow the list, or sort by clicking a column header.',
      whyItMatters: 'This is the full-network view - Relationships (the cockpit) is where TODD surfaces who actually needs attention.',
      bullets: [],
    };
  }

  private contactImportCard ( ctx: NetworkAssistantPageContext ): NetworkGuidanceCard {
    const summary = ctx.summary || {};
    const currentStep = Number( summary['currentStep'] || 0 );
    const processing = summary['processing'] === true;
    const importCompleted = summary['importCompleted'] === true;
    const csvRowCount = Number( summary['csvRowCount'] || 0 );
    const mappedRowCount = Number( summary['mappedRowCount'] || 0 );
    const contactCount = Number( summary['contactCount'] || 0 );
    const successCount = Number( summary['successCount'] || 0 );
    const failureCount = Number( summary['failureCount'] || 0 );

    if ( importCompleted ) {
      return {
        eyebrow: 'IMPORT',
        stageLabel: 'Complete',
        tone: 'ready',
        icon: 'fa-solid fa-circle-check',
        title: 'Your import is complete',
        message: `${successCount.toLocaleString()} contact${successCount === 1 ? '' : 's'} written into Network${failureCount ? `, ${failureCount} failed` : ''}. Review them in the Contact List, or start another import.`,
        whyItMatters: 'Freshly imported contacts are the best time to review and clean up before they go stale.',
        bullets: [],
      };
    }

    if ( processing ) {
      return {
        eyebrow: 'IMPORT',
        stageLabel: 'Writing',
        tone: 'progress',
        icon: 'fa-solid fa-hourglass-half',
        title: 'Writing contacts into Network',
        message: 'The import is running now. Stay on this page until it finishes.',
        whyItMatters: 'Leaving mid-write risks an incomplete import.',
        bullets: [],
      };
    }

    if ( currentStep >= 3 ) {
      return {
        eyebrow: 'IMPORT',
        stageLabel: 'Confirm',
        tone: 'progress',
        icon: 'fa-solid fa-hourglass-half',
        title: 'Ready to write these contacts',
        message: `${( contactCount || mappedRowCount || csvRowCount ).toLocaleString()} record${( contactCount || mappedRowCount || csvRowCount ) === 1 ? '' : 's'} staged for import. This is the last check before anything lands in your network.`,
        whyItMatters: 'This is the quality gate - confirm looks right before you commit.',
        bullets: [],
      };
    }

    if ( currentStep === 2 ) {
      return {
        eyebrow: 'IMPORT',
        stageLabel: 'Review',
        tone: 'progress',
        icon: 'fa-solid fa-hourglass-half',
        title: 'Review the mapped rows',
        message: `${( mappedRowCount || csvRowCount ).toLocaleString()} mapped row${( mappedRowCount || csvRowCount ) === 1 ? '' : 's'} ready for inspection. Spot-check a few before continuing so field mistakes don't multiply.`,
        whyItMatters: 'Mistakes here (wrong column mapped to email, etc.) are cheap to fix now and expensive to fix after import.',
        bullets: [],
      };
    }

    if ( currentStep === 1 ) {
      return {
        eyebrow: 'IMPORT',
        stageLabel: 'Map Fields',
        tone: 'progress',
        icon: 'fa-solid fa-hourglass-half',
        title: 'Match the columns to contact fields',
        message: `The file is in (${csvRowCount.toLocaleString()} row${csvRowCount === 1 ? '' : 's'}) - tell TODD which column is name, company, email, and the rest so it can move safely into preview.`,
        whyItMatters: 'The field map is what turns a spreadsheet into structured contacts.',
        bullets: [],
      };
    }

    return {
      eyebrow: 'IMPORT',
      stageLabel: 'Upload',
      tone: 'neutral',
      icon: 'fa-solid fa-upload',
      title: 'Upload a CSV to get started',
      message: 'Drop a CSV file here, or use the sample file to see how import works. TODD will help with mapping, review, and the final write.',
      whyItMatters: 'This is the front door for building your network in bulk instead of one contact at a time.',
      bullets: [],
    };
  }

  private contactEditCard ( ctx: NetworkAssistantPageContext ): NetworkGuidanceCard {
    const summary = ctx.summary || {};
    const isNewContact = summary['isNewContact'] !== false;
    const missing = Array.isArray( summary['missingFields'] ) ? summary['missingFields'] as string[] : [];
    const limitMessage = String( summary['limitMessage'] || '' );

    if ( limitMessage ) {
      return {
        eyebrow: 'CONTACT LIMIT',
        stageLabel: 'At limit',
        tone: 'attention',
        icon: 'fa-solid fa-triangle-exclamation',
        title: "You've used your free contacts",
        message: limitMessage,
        whyItMatters: "TODD can't save a new contact until there's room, or the account is upgraded.",
        bullets: [],
      };
    }

    if ( missing.length ) {
      return {
        eyebrow: isNewContact ? 'ADD CONTACT' : 'EDIT CONTACT',
        stageLabel: 'Missing info',
        tone: 'progress',
        icon: 'fa-solid fa-hourglass-half',
        title: 'A few fields are still missing',
        message: `TODD is still missing: ${missing.join( ', ' )}. Fill in what you have - none of it is required to save, but more here means better matching and enrichment later.`,
        whyItMatters: 'Complete records are what makes search, enrichment, and pipeline tracking actually useful.',
        bullets: [],
      };
    }

    return {
      eyebrow: isNewContact ? 'ADD CONTACT' : 'EDIT CONTACT',
      stageLabel: isNewContact ? 'New' : 'Editing',
      tone: 'ready',
      icon: 'fa-solid fa-circle-check',
      title: isNewContact ? 'Ready to save this contact' : 'This record looks complete',
      message: isNewContact
        ? 'The basics are filled in. Step through the rest of the wizard for more detail, or save now.'
        : 'All the core fields are filled in. Update anything that changed, then save.',
      whyItMatters: 'Once saved, this contact shows up in the Contact List and Relationships cockpit immediately.',
      bullets: [],
    };
  }

  private pipelineCard ( ctx: NetworkAssistantPageContext ): NetworkGuidanceCard {
    const summary = ctx.summary || {};
    const pipelineContactCount = Number( summary['pipelineContactCount'] || 0 );
    const momentumScore = Number( summary['momentumScore'] || 0 );
    const closedWonCount = Number( summary['closedWonCount'] || 0 );

    if ( pipelineContactCount === 0 ) {
      return {
        eyebrow: 'PIPELINE',
        stageLabel: 'Empty',
        tone: 'attention',
        icon: 'fa-solid fa-triangle-exclamation',
        title: 'No contacts are in a pipeline stage yet',
        message: 'Pipeline groups contacts by status (Lead Generation, Qualification, Negotiation, and so on). Set a status on a contact to see it show up here.',
        whyItMatters: 'Without a stage, TODD can’t tell you what’s moving toward a close versus what’s stuck.',
        bullets: [],
      };
    }

    return {
      eyebrow: 'PIPELINE',
      stageLabel: momentumScore >= 40 ? 'Strong' : momentumScore >= 15 ? 'Building' : 'Early',
      tone: momentumScore >= 40 ? 'ready' : momentumScore >= 15 ? 'progress' : 'attention',
      icon: momentumScore >= 40 ? 'fa-solid fa-circle-check' : 'fa-solid fa-hourglass-half',
      title: momentumScore >= 40 ? 'Late-stage momentum is strong' : 'Most of the pipeline is still early-stage',
      message: `${pipelineContactCount.toLocaleString()} contact${pipelineContactCount === 1 ? '' : 's'} have a pipeline stage. ${closedWonCount.toLocaleString()} closed won so far.`,
      whyItMatters: 'Late-stage volume (Negotiation or later) is the strongest signal of near-term revenue.',
      bullets: [`${momentumScore}% of the pipeline is in Negotiation or later.`],
    };
  }
}
