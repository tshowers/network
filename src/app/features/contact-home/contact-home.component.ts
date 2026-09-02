import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription, combineLatest } from 'rxjs';
import { environment } from '../../../environments/environment';
import { NetworkAuthService } from '../../services/network-auth.service';
import { NetworkContactStateService } from '../../services/network-contact-state.service';
import { NetworkPageActionsService } from '../../services/network-page-actions.service';
import { NetworkAssistantSignalService } from '../../services/network-assistant-signal.service';
import { BackToTopComponent } from '../../shared/back-to-top/back-to-top.component';
import { ArcGaugeComponent, ArcGaugeTone } from '../../shared/arc-gauge/arc-gauge.component';
import { StatusLedComponent, StatusLedTone } from '../../shared/status-led/status-led.component';
import { PageAction } from '../../models/page-actions.models';
import { CockpitCommandDeckComponent, CockpitCommandDeckLink } from '../../shared/cockpit-command-deck/cockpit-command-deck.component';
import { CockpitBrowseModeBannerComponent } from '../../shared/cockpit-browse-mode-banner/cockpit-browse-mode-banner.component';
import { ReliefStatus, SeverityLevel } from '../../models/business-symptom.model';

interface NetworkLimitState {
  currentCount: number;
  baseLimit: number;
  extraPacks: number;
  effectiveLimit: number;
  remaining: number;
}

interface NetworkAuthContext {
  tenantId: string;
  userId: string;
  userEmail: string;
}

interface NetworkDashboardCounts {
  totalContacts: number;
  validEmailContacts: number;
  enrichedContacts: number;
  reconfiguredContacts: number;
  contactsNeedingFollowUp: number;
  subscriberContacts: number;
  importantContacts: number;
}

interface NetworkHealthMeter {
  id: string;
  label: string;
  value: number;
  max: number;
  tone: ArcGaugeTone;
  detail: string;
}

interface NetworkDiagnosisRow {
  id: string;
  title: string;
  severity: SeverityLevel;
  reliefStatus: ReliefStatus;
  symptom: string;
  evidence: string;
  treatment: string;
  relief: string;
  proofLabel: string;
  proofValue: number;
  proofMax: number;
  proofDetail: string;
  statusTone: StatusLedTone;
  severityLabel: string;
  reliefLabel: string;
}

/**
 * Ported from features/contact/contact-home/contact-home.component.ts -
 * this is the real /network/app home page (confirmed against TODD's own
 * app.routes.ts), replacing the quick-actions placeholder that route was
 * using until now.
 *
 * Data fetching (loadNetworkLimits/fetchDashboardCounts) is unchanged -
 * both hit todd-backend directly via fetch() with header-based auth, no
 * Firestore SDK involved, so nothing needed rewriting there. What's
 * dropped: ToddAssistantBusService and PageActionsService calls, both
 * swapped for no-op stubs (see those files for why) since this app
 * doesn't carry TODD's assistant bus or shared nav-shell chrome.
 */
@Component( {
  selector: 'app-contact-home',
  standalone: true,
  imports: [CommonModule, RouterModule, BackToTopComponent, ArcGaugeComponent, StatusLedComponent, CockpitCommandDeckComponent, CockpitBrowseModeBannerComponent],
  templateUrl: './contact-home.component.html',
  styleUrl: './contact-home.component.css'
} )
export class ContactHomeComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly emptyDashboardCounts: NetworkDashboardCounts = {
    totalContacts: 0,
    validEmailContacts: 0,
    enrichedContacts: 0,
    reconfiguredContacts: 0,
    contactsNeedingFollowUp: 0,
    subscriberContacts: 0,
    importantContacts: 0
  };

  isLoggedIn: boolean = false;
  isEmbedded = false;

  limits: NetworkLimitState | null = null;
  isLoadingLimits = false;
  limitsError = '';
  usagePercent = 0;
  usageWarning = '';
  usageWarningLevel: 'safe' | 'warning' | 'danger' | 'full' = 'safe';
  isAtContactLimit = false;

  dashboardCounts: NetworkDashboardCounts | null = null;
  isLoadingDashboardCounts = false;
  dashboardCountsError = '';

  momentumScore = 0;
  healthMeters: NetworkHealthMeter[] = [];
  diagnosisRows: NetworkDiagnosisRow[] = [];
  appStatusSummary = 'TODD is standing by. Connect the relationship graph to turn diagnosis, treatment, and relief monitoring on.';

  private readonly contactLimitAssistantMessage = 'You can’t generate more revenue because you’ve hit your contact limit.';
  private hasPushedLimitAssistantNudge = false;
  private authContextSubscription: Subscription | null = null;
  private loggedInSubscription: Subscription | null = null;
  private lastAuthContextKey = '';
  readonly relationshipsCommandDeckLinks: CockpitCommandDeckLink[] = [
    { label: 'Home', icon: 'house', routerLink: '/' },
    { label: 'Contact List', icon: 'address-book', routerLink: '/contact-list' },
    { label: 'Import Contacts', icon: 'file-import', routerLink: '/contact-import' },
    { label: 'Pipeline', icon: 'diagram-project', routerLink: '/contact-deal-flow' },
    { label: 'Add Contact', icon: 'user-plus', action: () => this.openAddContact() }
  ];

  constructor (
    private authService: NetworkAuthService,
    private assistantBus: NetworkAssistantSignalService,
    private route: ActivatedRoute,
    private router: Router,
    private contactState: NetworkContactStateService,
    private pageActionsService: NetworkPageActionsService
  ) { }

  ngOnInit (): void {
    this.isEmbedded = this.route.snapshot.queryParamMap.get( 'embedded' ) === 'true';
    this.recomputeDashboardDerivedState();
    this.setLoggedIn();
    this.watchAuthContext();
    this.publishPageContext();
    this.publishPageActions();
    this.assistantBus.emitAssistantActivity( {
      feature: 'contacts',
      page: 'contact-home',
      route: '/app',
      mode: 'dashboard',
      action: 'contact_home_opened',
      summary: {
        hasNetworkFeaturesPage: false,
      }
    } );
  }

  ngOnDestroy (): void {
    this.loggedInSubscription?.unsubscribe();
    this.authContextSubscription?.unsubscribe();
    this.pageActionsService.clearPageActions( 'contact-home-cockpit' );
    this.assistantBus.clearPageContext();
  }

  ngAfterViewInit (): void {
    window.scrollTo( 0, 0 );
  }

  openAddContact (): void {
    this.contactState.resetContact();
    void this.router.navigate( ['/contact-edit'] );
  }

  private publishPageActions (): void {
    this.pageActionsService.setPageActions( {
      pageId: 'contact-home-cockpit',
      context: {
        pageId: 'contact-home-cockpit',
        feature: 'contacts',
        entityType: 'contact',
        mode: 'dashboard'
      },
      actions: this.buildPageActions()
    } );
  }

  private buildPageActions (): PageAction[] {
    return [
      {
        id: 'contact-cockpit-add-contact',
        label: 'Add Contact',
        icon: 'fa-solid fa-user-plus',
        kind: 'callback',
        order: 10,
        group: 'context',
        handler: () => this.openAddContact()
      },
      {
        id: 'contact-cockpit-contact-list',
        label: 'Contact List',
        icon: 'fa-solid fa-address-book',
        kind: 'route',
        route: '/contact-list',
        order: 20,
        group: 'context'
      },
      {
        id: 'contact-cockpit-import',
        label: 'Import Contacts',
        icon: 'fa-solid fa-file-import',
        kind: 'route',
        route: '/contact-import',
        order: 30,
        group: 'context'
      },
      {
        id: 'contact-cockpit-pipeline',
        label: 'Pipeline',
        icon: 'fa-solid fa-chart-line',
        kind: 'route',
        route: '/contact-deal-flow',
        order: 40,
        group: 'context'
      }
    ];
  }

  private recomputeDashboardDerivedState (): void {
    this.momentumScore = this.computeMomentumScore();
    this.healthMeters = this.computeHealthMeters();
    this.diagnosisRows = this.computeDiagnosisRows();
    this.appStatusSummary = this.computeAppStatusSummary();
  }

  private computeMomentumScore (): number {
    const counts = this.activeDashboardCounts;
    if ( !counts.totalContacts ) return 0;

    const numerator = ( counts.validEmailContacts || 0 ) + ( counts.enrichedContacts || 0 ) + ( counts.reconfiguredContacts || 0 );
    return Math.round( ( numerator / ( counts.totalContacts * 3 ) ) * 100 );
  }

  get activeDashboardCounts (): NetworkDashboardCounts {
    return this.dashboardCounts ?? this.emptyDashboardCounts;
  }

  private computeHealthMeters (): NetworkHealthMeter[] {
    const counts = this.activeDashboardCounts;
    const totalContacts = counts.totalContacts || 0;
    const missingReachability = Math.max( 0, totalContacts - counts.validEmailContacts );
    const missingEnrichment = Math.max( 0, totalContacts - counts.enrichedContacts );
    const missingNextMove = Math.max( 0, totalContacts - counts.reconfiguredContacts );

    return [
      {
        id: 'relationship-health',
        label: 'Relationship health',
        value: this.percentValue( totalContacts - counts.contactsNeedingFollowUp, Math.max( totalContacts, counts.contactsNeedingFollowUp, 1 ) ),
        max: 100,
        tone: this.isLoggedIn ? this.healthToneFromSeverity( this.severityFromIssue( counts.contactsNeedingFollowUp, Math.max( counts.importantContacts, totalContacts ) ) ) : 'info',
        detail: this.isLoggedIn
          ? `${counts.contactsNeedingFollowUp} relationships need attention now.`
          : 'Waiting for live relationship signals.'
      },
      {
        id: 'data-readiness',
        label: 'Data readiness',
        value: this.percentValue( counts.enrichedContacts, totalContacts || 1 ),
        max: 100,
        tone: this.isLoggedIn ? this.healthToneFromSeverity( this.severityFromIssue( missingEnrichment, totalContacts ) ) : 'info',
        detail: this.isLoggedIn
          ? `${missingEnrichment} records still need enrichment.`
          : 'Data readiness will light up once the network is connected.'
      },
      {
        id: 'reachability',
        label: 'Reachability',
        value: this.percentValue( counts.validEmailContacts, totalContacts || 1 ),
        max: 100,
        tone: this.isLoggedIn ? this.healthToneFromSeverity( this.severityFromIssue( missingReachability, totalContacts ) ) : 'info',
        detail: this.isLoggedIn
          ? `${missingReachability} contacts are not safely reachable yet.`
          : 'Email verification remains idle in preview mode.'
      },
      {
        id: 'relief-progress',
        label: 'Relief progress',
        value: this.percentValue( counts.reconfiguredContacts, totalContacts || 1 ),
        max: 100,
        tone: this.isLoggedIn ? this.healthToneFromSeverity( this.severityFromIssue( missingNextMove, totalContacts ) ) : 'info',
        detail: this.isLoggedIn
          ? `${counts.reconfiguredContacts} contacts are ready for the next move.`
          : 'TODD will start surfacing next moves after sign-in.'
      }
    ];
  }

  private computeDiagnosisRows (): NetworkDiagnosisRow[] {
    const counts = this.activeDashboardCounts;
    const totalContacts = counts.totalContacts || 0;
    const missingReachability = Math.max( 0, totalContacts - counts.validEmailContacts );
    const missingEnrichment = Math.max( 0, totalContacts - counts.enrichedContacts );
    const missingNextMove = Math.max( 0, totalContacts - counts.reconfiguredContacts );

    const rows: Omit<NetworkDiagnosisRow, 'statusTone' | 'severityLabel' | 'reliefLabel'>[] = [
      {
        id: 'relationships-cooling',
        title: 'Relationships are going cold',
        severity: this.severityFromIssue( counts.contactsNeedingFollowUp, Math.max( counts.importantContacts, totalContacts ) ),
        reliefStatus: this.reliefStatusFromIssue( counts.contactsNeedingFollowUp, counts.reconfiguredContacts ),
        symptom: this.isLoggedIn
          ? `${counts.contactsNeedingFollowUp} contacts have gone quiet long enough to risk lost momentum.`
          : 'TODD watches for relationships that are cooling before they disappear from view.',
        evidence: this.isLoggedIn
          ? `${counts.importantContacts} important contacts are in the active relationship set.`
          : 'Live relationship evidence appears after sign-in.',
        treatment: this.isLoggedIn
          ? 'TODD is prioritizing relationships by business value and staging the next best follow-ups.'
          : 'TODD will rank warm relationships and prepare follow-ups once your workspace is connected.',
        relief: this.isLoggedIn
          ? 'Re-engagement begins as the highest-value contacts get a recommended next move.'
          : 'Relief appears when TODD can act on real relationship history.',
        proofLabel: 'Next moves staged',
        proofValue: counts.reconfiguredContacts,
        proofMax: totalContacts || 1,
        proofDetail: this.isLoggedIn
          ? `${counts.reconfiguredContacts} contacts are already staged for action.`
          : 'Proof stays at zero in preview mode.'
      },
      {
        id: 'contact-data-incomplete',
        title: 'Contact information is incomplete',
        severity: this.severityFromIssue( missingEnrichment, totalContacts ),
        reliefStatus: this.reliefStatusFromIssue( missingEnrichment, counts.enrichedContacts ),
        symptom: this.isLoggedIn
          ? `${missingEnrichment} records are missing enough context to weaken targeting and follow-up quality.`
          : 'TODD highlights where contact records are too thin to trust.',
        evidence: this.isLoggedIn
          ? `${counts.enrichedContacts} contacts already have expanded profile context.`
          : 'Enrichment evidence appears after sign-in.',
        treatment: this.isLoggedIn
          ? 'TODD is enriching missing contact information and filling in usable account context.'
          : 'TODD will enrich missing contact fields once live records are available.',
        relief: this.isLoggedIn
          ? 'The network becomes more usable as records move from incomplete to outreach-ready.'
          : 'Relief appears when more records become usable.',
        proofLabel: 'Records enriched',
        proofValue: counts.enrichedContacts,
        proofMax: totalContacts || 1,
        proofDetail: this.isLoggedIn
          ? `${this.percentValue( counts.enrichedContacts, totalContacts || 1 )}% of the network has expanded context.`
          : 'Preview mode keeps data readiness dark.'
      },
      {
        id: 'emails-unreliable',
        title: 'Contact data cannot be fully trusted',
        severity: this.severityFromIssue( missingReachability, totalContacts ),
        reliefStatus: this.reliefStatusFromIssue( missingReachability, counts.validEmailContacts ),
        symptom: this.isLoggedIn
          ? `${missingReachability} contacts still lack a verified email path for reliable outreach.`
          : 'TODD flags where reachability is uncertain before outreach starts.',
        evidence: this.isLoggedIn
          ? `${counts.validEmailContacts} contacts are currently safe to reach by email.`
          : 'Verification proof appears after sign-in.',
        treatment: this.isLoggedIn
          ? 'TODD is verifying email addresses and isolating records that would weaken outreach.'
          : 'TODD will verify email addresses once the network is live.',
        relief: this.isLoggedIn
          ? 'Bounce risk falls as more of the network becomes safely reachable.'
          : 'Relief appears once reachability can be measured.',
        proofLabel: 'Reachable contacts',
        proofValue: counts.validEmailContacts,
        proofMax: totalContacts || 1,
        proofDetail: this.isLoggedIn
          ? `${this.percentValue( counts.validEmailContacts, totalContacts || 1 )}% of contacts are reachable right now.`
          : 'Preview mode keeps reachability at zero.'
      },
      {
        id: 'next-moves-missing',
        title: 'Opportunities are becoming inactive',
        severity: this.severityFromIssue( missingNextMove, totalContacts ),
        reliefStatus: this.reliefStatusFromIssue( missingNextMove, counts.reconfiguredContacts ),
        symptom: this.isLoggedIn
          ? `${missingNextMove} contacts still do not have a recommended next move attached to them.`
          : 'TODD surfaces where opportunity motion is missing before the pipeline stalls.',
        evidence: this.isLoggedIn
          ? `${counts.subscriberContacts} subscribed contacts are already showing stronger intent signals.`
          : 'Momentum evidence turns on once your audience data is connected.',
        treatment: this.isLoggedIn
          ? 'TODD is identifying dormant opportunities, monitoring relationship activity, and recommending who should be contacted next.'
          : 'TODD will monitor opportunity motion and recommend next actions after sign-in.',
        relief: this.isLoggedIn
          ? 'More opportunities stay active as recommended next moves accumulate.'
          : 'Relief appears when TODD can observe and treat real opportunity drift.',
        proofLabel: 'Active next steps',
        proofValue: counts.reconfiguredContacts,
        proofMax: totalContacts || 1,
        proofDetail: this.isLoggedIn
          ? `${counts.subscriberContacts} contacts are already leaning in while ${counts.reconfiguredContacts} have a staged next move.`
          : 'Preview mode shows the same care cycle with inactive proof.'
      }
    ];

    return rows.map( ( row ): NetworkDiagnosisRow => ( {
      ...row,
      statusTone: this.statusTone( row.reliefStatus ),
      severityLabel: this.severityLabel( row.severity ),
      reliefLabel: this.reliefLabel( row.reliefStatus )
    } ) );
  }

  private computeAppStatusSummary (): string {
    if ( !this.isLoggedIn ) {
      return 'TODD is standing by. Connect the relationship graph to turn diagnosis, treatment, and relief monitoring on.';
    }

    const counts = this.activeDashboardCounts;
    return `TODD is treating relationship drift for ${counts.contactsNeedingFollowUp} contacts, enriching ${Math.max( 0, counts.totalContacts - counts.enrichedContacts )} incomplete records, and staging ${counts.reconfiguredContacts} next moves.`;
  }

  trackById ( _index: number, item: { id: string } ): string {
    return item.id;
  }

  setLoggedIn () {
    this.loggedInSubscription?.unsubscribe();
    this.loggedInSubscription = this.authService.isLoggedIn().subscribe( loggedIn => {
      this.isLoggedIn = loggedIn;
      this.recomputeDashboardDerivedState();
    } );
  }

  private watchAuthContext (): void {
    this.authContextSubscription?.unsubscribe();
    this.authContextSubscription = combineLatest( [
      this.authService.getTenantId(),
      this.authService.getUser()
    ] ).subscribe( ( [tenantId, user] ) => {
      const nextContext = this.normalizeAuthContext( tenantId, user );
      const nextKey = nextContext ? `${nextContext.tenantId}|${nextContext.userId}|${nextContext.userEmail}` : '';

      if ( nextKey === this.lastAuthContextKey ) {
        return;
      }

      this.lastAuthContextKey = nextKey;

      if ( !nextContext ) {
        this.limits = null;
        this.limitsError = '';
        this.isLoadingLimits = false;
        this.dashboardCounts = null;
        this.dashboardCountsError = '';
        this.isLoadingDashboardCounts = false;
        this.recomputeDashboardDerivedState();
        this.refreshUsageState();
        this.publishPageContext();
        return;
      }

      void this.loadNetworkLimits( nextContext );
      void this.fetchDashboardCounts( nextContext );
    } );
  }

  private normalizeAuthContext ( tenantId: string | null | undefined, user: any ): NetworkAuthContext | null {
    const normalizedTenantId = String( tenantId || '' ).trim();
    const normalizedUserId = String( user?.uid || '' ).trim();
    const normalizedUserEmail = String( user?.email || '' ).trim().toLowerCase();

    if ( !normalizedTenantId || !normalizedUserId ) {
      return null;
    }

    return {
      tenantId: normalizedTenantId,
      userId: normalizedUserId,
      userEmail: normalizedUserEmail
    };
  }

  private async loadNetworkLimits ( authContext: NetworkAuthContext ): Promise<void> {
    if ( !authContext.tenantId || !authContext.userId ) {
      this.limits = null;
      this.limitsError = '';
      this.refreshUsageState();
      this.publishPageContext();
      return;
    }

    this.isLoadingLimits = true;
    this.limitsError = '';
    this.refreshUsageState();

    try {
      const response = await fetch( `${environment.backendURL}/network/limits?tenantId=${encodeURIComponent( authContext.tenantId )}`, {
        headers: this.buildAuthHeaders( authContext )
      } );
      const result = await response.json().catch( () => ( {} ) );

      if ( !response.ok ) {
        throw new Error( result?.message || 'Unable to load network limits.' );
      }

      this.limits = {
        currentCount: Number( result?.currentCount ) || 0,
        baseLimit: Number( result?.baseLimit ) || 1000,
        extraPacks: Number( result?.extraPacks ) || 0,
        effectiveLimit: Number( result?.effectiveLimit ) || 0,
        remaining: Number( result?.remaining ) || 0,
      };
      this.refreshUsageState();
      this.publishPageContext();
      this.maybePublishContactLimitNudge();
    } catch ( error: any ) {
      const rawMessage = String( error?.message || '' ).trim();
      this.limitsError = rawMessage === 'Authentication required for this data.'
        ? 'We could not verify your session for contact capacity yet. Please refresh and try again.'
        : ( rawMessage || 'Unable to load network limits.' );
      this.limits = null;
      this.refreshUsageState();
      this.publishPageContext();
    } finally {
      this.isLoadingLimits = false;
      this.refreshUsageState();
    }
  }

  private async fetchDashboardCounts ( authContext: NetworkAuthContext ): Promise<void> {
    if ( !authContext.tenantId ) {
      this.dashboardCounts = null;
      this.dashboardCountsError = '';
      this.recomputeDashboardDerivedState();
      return;
    }

    this.isLoadingDashboardCounts = true;
    this.dashboardCountsError = '';

    try {
      const response = await fetch( `${environment.backendURL}/network/dashboard-counts?tenantId=${encodeURIComponent( authContext.tenantId )}`, {
        headers: this.buildAuthHeaders( authContext )
      } );
      const result = await response.json().catch( () => ( {} ) );

      if ( !response.ok ) {
        throw new Error( result?.message || 'Unable to load network dashboard counts.' );
      }

      this.dashboardCounts = {
        totalContacts: Number( result?.totalContacts ) || 0,
        validEmailContacts: Number( result?.validEmailContacts ) || 0,
        enrichedContacts: Number( result?.enrichedContacts ) || 0,
        reconfiguredContacts: Number( result?.reconfiguredContacts ) || 0,
        contactsNeedingFollowUp: Number( result?.contactsNeedingFollowUp ) || 0,
        subscriberContacts: Number( result?.subscriberContacts ) || 0,
        importantContacts: Number( result?.importantContacts ) || 0,
      };
    } catch ( error: any ) {
      this.dashboardCountsError = String( error?.message || '' ).trim() || 'Unable to load network dashboard counts.';
      this.dashboardCounts = null;
    } finally {
      this.isLoadingDashboardCounts = false;
      this.recomputeDashboardDerivedState();
    }
  }

  private buildAuthHeaders ( authContext: NetworkAuthContext ): HeadersInit {
    const headers: Record<string, string> = {
      'x-tenant-id': authContext.tenantId,
      'x-user-id': authContext.userId
    };

    if ( authContext.userEmail ) {
      headers['x-user-email'] = authContext.userEmail;
    }

    return headers;
  }

  private maybePublishContactLimitNudge (): void {
    if ( !this.isAtContactLimit || this.hasPushedLimitAssistantNudge ) return;

    this.assistantBus.pushTranscript( {
      role: 'assistant',
      content: this.contactLimitAssistantMessage
    } );
    this.assistantBus.markAssistantUnread();
    this.assistantBus.setSignalReady();
    this.hasPushedLimitAssistantNudge = true;
  }

  private publishPageContext (): void {
    const counts = this.dashboardCounts || this.emptyDashboardCounts;
    this.assistantBus.setPageContext( {
      feature: 'contacts',
      page: 'contact-home',
      route: this.router.url || '/app',
      mode: 'dashboard',
      title: 'Relationships',
      description: 'Live relationship health, diagnosis, treatment, and proof.',
      allowedActions: [
        'open_pipeline',
        'add_contact',
        'import_contacts'
      ],
      summary: {
        isAuthenticated: this.isLoggedIn,
        interactionMode: this.isLoggedIn ? 'member' : 'guest',
        hasNetworkFeaturesPage: true,
        totalContacts: counts.totalContacts,
        validEmailContacts: counts.validEmailContacts,
        enrichedContacts: counts.enrichedContacts,
        reconfiguredContacts: counts.reconfiguredContacts,
        contactsNeedingFollowUp: counts.contactsNeedingFollowUp,
        subscriberContacts: counts.subscriberContacts,
        importantContacts: counts.importantContacts,
        currentCount: this.limits?.currentCount || 0,
        effectiveLimit: this.limits?.effectiveLimit || 0,
        usagePercent: this.usagePercent,
        remaining: this.limits?.remaining || 0,
        atContactLimit: this.isAtContactLimit,
        blockerMessage: this.isAtContactLimit ? this.contactLimitAssistantMessage : '',
      },
      dataPreview: {
        importRoute: '/contact-import',
        pipelineRoute: '/contact-deal-flow',
        contactListRoute: '/contact-list',
        outreachRoute: 'https://todd.taliferro.tech/outreach/app',
        remaining: this.limits?.remaining || 0,
        atContactLimit: this.isAtContactLimit,
        suggestedAssistantNudge: this.isAtContactLimit ? this.contactLimitAssistantMessage : '',
      }
    } );
  }

  private refreshUsageState (): void {
    const effectiveLimit = Number( this.limits?.effectiveLimit ) || 0;
    const currentCount = Number( this.limits?.currentCount ) || 0;
    const remaining = Number( this.limits?.remaining ) || 0;

    this.usagePercent = effectiveLimit <= 0
      ? 0
      : Math.max( 0, Math.min( 100, Math.round( ( currentCount / effectiveLimit ) * 100 ) ) );

    if ( this.usagePercent >= 100 ) {
      this.usageWarning = 'At 100% of contact capacity.';
      this.usageWarningLevel = 'full';
    } else if ( this.usagePercent >= 90 ) {
      this.usageWarning = 'Over 90% of contact capacity.';
      this.usageWarningLevel = 'danger';
    } else if ( this.usagePercent >= 80 ) {
      this.usageWarning = 'Over 80% of contact capacity.';
      this.usageWarningLevel = 'warning';
    } else {
      this.usageWarning = '';
      this.usageWarningLevel = 'safe';
    }

    this.isAtContactLimit = effectiveLimit > 0 && remaining <= 0;
  }

  statusTone ( status: ReliefStatus ): StatusLedTone {
    if ( !this.isLoggedIn ) {
      return 'idle';
    }

    switch ( status ) {
      case 'relief-delivered':
      case 'improving':
        return 'positive';
      case 'todd-working':
        return 'attention';
      case 'watching':
        return 'info';
      case 'needs-relief':
      case 'needs-user-decision':
        return 'warn';
      default:
        return 'idle';
    }
  }

  severityLabel ( severity: SeverityLevel ): string {
    switch ( severity ) {
      case 'critical': return 'Critical';
      case 'high': return 'High';
      case 'medium': return 'Medium';
      case 'low': return 'Low';
      default: return 'Info';
    }
  }

  reliefLabel ( status: ReliefStatus ): string {
    if ( !this.isLoggedIn ) {
      return 'Preview';
    }

    switch ( status ) {
      case 'needs-relief': return 'Needs Relief';
      case 'todd-working': return 'TODD Is Working';
      case 'improving': return 'Improving';
      case 'relief-delivered': return 'Relief Delivered';
      case 'watching': return 'Watching';
      case 'needs-user-decision': return 'Needs Your Decision';
      default: return 'Insufficient Information';
    }
  }

  private percentValue ( value: number, max: number ): number {
    const safeMax = Math.max( 1, max || 0 );
    const safeValue = Math.max( 0, Math.min( safeMax, value || 0 ) );

    return Math.round( ( safeValue / safeMax ) * 100 );
  }

  private severityFromIssue ( affected: number, total: number ): SeverityLevel {
    const safeAffected = Math.max( 0, affected || 0 );
    const safeTotal = Math.max( 0, total || 0 );

    if ( safeAffected <= 0 ) {
      return 'low';
    }

    if ( safeTotal <= 0 ) {
      return safeAffected >= 10 ? 'high' : 'medium';
    }

    const ratio = safeAffected / safeTotal;

    if ( ratio >= 0.75 ) return 'critical';
    if ( ratio >= 0.45 ) return 'high';
    if ( ratio >= 0.2 ) return 'medium';
    return 'low';
  }

  private reliefStatusFromIssue ( affected: number, treated: number ): ReliefStatus {
    if ( !this.isLoggedIn ) {
      return 'insufficient-information';
    }

    const safeAffected = Math.max( 0, affected || 0 );
    const safeTreated = Math.max( 0, treated || 0 );

    if ( safeAffected <= 0 && safeTreated <= 0 ) {
      return 'watching';
    }

    if ( safeAffected <= 0 ) {
      return 'relief-delivered';
    }

    if ( safeTreated <= 0 ) {
      return 'needs-relief';
    }

    if ( safeTreated >= safeAffected ) {
      return 'improving';
    }

    return 'todd-working';
  }

  private healthToneFromSeverity ( severity: SeverityLevel ): ArcGaugeTone {
    switch ( severity ) {
      case 'critical':
      case 'high':
        return 'warn';
      case 'medium':
        return 'attention';
      default:
        return 'positive';
    }
  }

}
