import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Title } from '@angular/platform-browser';

import { environment } from '../../../environments/environment';
import { Contact } from '../../models/contact.model';
import { NetworkAuthService } from '../../services/network-auth.service';
import { NetworkDataService } from '../../services/network-data.service';
import { BackToTopComponent } from '../../shared/back-to-top/back-to-top.component';
import { PreloaderComponent } from '../../shared/preloader/preloader.component';
import { CockpitBrowseModeBannerComponent } from '../../shared/cockpit-browse-mode-banner/cockpit-browse-mode-banner.component';
import { CockpitCommandDeckComponent } from '../../shared/cockpit-command-deck/cockpit-command-deck.component';

type DashboardTab = 'flow' | 'status' | 'lanes';

interface FlowStage {
  label: string;
  description: string;
  statusNames: string[];
  count: number;
  accent: string;
  icon: string;
  countLabel: string;
  detail: string;
}

interface PipelineStatusStep {
  key: string;
  windowLabel: string;
  title: string;
  owner: string;
  objective: string;
  summary: string;
  statusLabel: string;
  count: number;
  detail: string;
  logs: Array<{ timeLabel: string; event: string; status: string; message: string; detail: string; source: string }>;
  generatedItems: Array<{ label: string; detail: string; status: string; tone: string }>;
}

@Component( {
  selector: 'app-deal-flow-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, BackToTopComponent, PreloaderComponent, CockpitBrowseModeBannerComponent, CockpitCommandDeckComponent],
  templateUrl: './deal-flow-dashboard.component.html',
  styleUrl: './deal-flow-dashboard.component.css',
} )
export class DealFlowDashboardComponent implements OnInit {
  readonly stages: FlowStage[] = [
    { label: 'Visitor', description: 'Visited the Network site today', statusNames: ['Visitor'], count: 0, accent: 'purple', icon: 'desktop', countLabel: 'visitors', detail: 'Returning 0%' },
    { label: 'Contacted', description: 'The first move has been made', statusNames: ['Contacted', 'Lead Generation'], count: 0, accent: 'teal', icon: 'paper-plane', countLabel: 'contacts', detail: '0 threads' },
    { label: 'Engaged', description: 'They replied or showed real interest', statusNames: ['Engaged', 'Engagement'], count: 0, accent: 'cyan', icon: 'comments', countLabel: 'contacts', detail: '0 threads' },
    { label: 'Qualified', description: 'A focused follow-up is warranted', statusNames: ['Qualified', 'Qualification'], count: 0, accent: 'green', icon: 'circle-check', countLabel: 'contacts', detail: '0 threads' },
    { label: 'Opportunity', description: 'A conversation can become business', statusNames: ['Proposal', 'Negotiation', 'Opportunity'], count: 0, accent: 'gold', icon: 'user-check', countLabel: 'contacts', detail: '0 threads' },
    { label: 'Customer', description: 'The relationship is producing value', statusNames: ['Closing', 'Closed Won', 'Customer', 'Post-Sale'], count: 0, accent: 'emerald', icon: 'handshake', countLabel: 'customers', detail: '0 subscribers' },
  ];

  contacts: Contact[] = [];
  isLoading = true;
  isSignedIn = false;
  errorMessage = '';
  selectedTab: DashboardTab = 'flow';
  stageTotal = 0;
  unassignedCount = 0;
  mappedStatusCount = 0;
  opportunityCount = 0;
  customerCount = 0;
  contactsByStage: Record<string, Contact[]> = {};
  laneContactsByStage: Record<string, Array<{ contact: Contact; name: string }>> = {};
  priorityStages: Array<{ label: string; description: string; count: number; accent: string; icon: string }> = [];
  private tenantId = '';
  todayMomentumLoaded = false;
  todayMomentum = { sent: 0, opens: 0, clicks: 0, visits: 0, socialPosts: 0, likes: 0, comments: 0, trend: 'flat' };
  visitorCount = 0;
  returningVisitorPercent = 0;
  pipelineStatusSteps: PipelineStatusStep[] = [];
  expandedStatusStepKey = '';
  customerMomentumLoading = false;
  customerMomentumError = '';
  customerMomentumCheckpointIndex = 0;
  customerMomentumRunStatus = '';
  private customerMomentumEngineState: any = null;
  private customerMomentumActivityRows: any[] = [];

  constructor (
    private http: HttpClient,
    private authService: NetworkAuthService,
    private dataService: NetworkDataService,
    private titleService: Title,
    private router: Router,
  ) { }

  async ngOnInit (): Promise<void> {
    this.titleService.setTitle( `${environment.COMPANY_NAME} - Networking Progress` );
    const userId = await firstValueFrom( this.authService.getUserId() );
    this.isSignedIn = !!userId;
    if ( !userId ) { this.isLoading = false; return; }

    this.tenantId = await this.authService.resolveTenantId( userId );
    try {
      this.contacts = await this.dataService.getAllContacts( this.tenantId );
      this.updateStageCounts();
      this.buildPipelineStatusSteps();
      void this.loadSourceMetrics( userId );
      void this.loadCustomerMomentumStatus( userId );
    } catch {
      this.errorMessage = 'Unable to load your relationship progress right now.';
    } finally {
      this.isLoading = false;
    }
  }

  selectTab ( tab: DashboardTab ): void { this.selectedTab = tab; }

  toggleStatusStep ( stepKey: string ): void {
    this.expandedStatusStepKey = this.expandedStatusStepKey === stepKey ? '' : stepKey;
  }

  isStatusStepExpanded ( stepKey: string ): boolean {
    return this.expandedStatusStepKey === stepKey;
  }

  async runPipelineStatusStep (): Promise<void> {
    if ( this.customerMomentumLoading || !this.tenantId ) return;
    const order = [ 'sales-handoff', 'interest-intake', 'lane-assignment', 'follow-up-loop', 'close-loop' ];
    const step = order[this.customerMomentumCheckpointIndex];
    if ( !step ) { this.customerMomentumRunStatus = 'All customer pipeline steps are complete.'; return; }
    this.customerMomentumLoading = true;
    this.customerMomentumRunStatus = `Running ${this.pipelineStatusSteps[this.customerMomentumCheckpointIndex]?.title || 'pipeline step'}…`;
    try {
      await firstValueFrom( this.http.get<any>( `${environment.backendURL}/momentum/check`, { params: { tenantId: this.tenantId, customerPipelineStep: step } } ) );
      this.customerMomentumCheckpointIndex = Math.min( this.customerMomentumCheckpointIndex + 1, order.length );
      await this.loadCustomerMomentumStatus( this.authService.getCurrentUserIdSync() );
    } catch {
      this.customerMomentumRunStatus = 'This pipeline step could not be completed right now.';
    } finally { this.customerMomentumLoading = false; }
  }

  async restartPipelineStatus (): Promise<void> {
    if ( this.customerMomentumLoading || !this.tenantId ) return;
    this.customerMomentumLoading = true;
    try {
      await firstValueFrom( this.http.post<any>( `${environment.backendURL}/momentum/customer-pipeline/reset`, { tenantId: this.tenantId } ) );
      this.customerMomentumCheckpointIndex = 0;
      this.customerMomentumRunStatus = 'Customer pipeline test run reset. Start again with Step 1.';
      await this.loadCustomerMomentumStatus( this.authService.getCurrentUserIdSync() );
    } catch { this.customerMomentumRunStatus = 'The customer pipeline run could not be reset right now.'; }
    finally { this.customerMomentumLoading = false; }
  }

  countForStatuses ( statuses: string[] ): number {
    const normalized = statuses.map( status => status.toLowerCase() );
    return this.contacts.filter( contact => normalized.includes( String( contact.status || '' ).trim().toLowerCase() ) ).length;
  }

  private updateComputedDisplayData (): void {
    const known = this.stages.flatMap( stage => stage.statusNames.map( status => status.toLowerCase() ) );
    this.stageTotal = this.stages.reduce( ( total, stage ) => total + stage.count, 0 );
    this.mappedStatusCount = this.contacts.filter( contact => !!String( contact.status || '' ).trim() ).length;
    this.unassignedCount = this.contacts.filter( contact => !known.includes( String( contact.status || '' ).trim().toLowerCase() ) ).length;
    this.opportunityCount = this.countForStatuses( ['Opportunity', 'Negotiation', 'Proposal'] );
    this.customerCount = this.countForStatuses( ['Closed Won', 'Customer'] );
    this.contactsByStage = {};
    this.laneContactsByStage = {};
    this.stages.forEach( stage => {
      this.contactsByStage[stage.label] = this.contacts.filter( contact => stage.statusNames.map( value => value.toLowerCase() ).includes( String( contact.status || '' ).trim().toLowerCase() ) );
      this.laneContactsByStage[stage.label] = this.contactsByStage[stage.label].map( contact => ( { contact, name: this.displayName( contact ) } ) );
    } );
    this.priorityStages = [
      { label: 'High Intent', description: 'Strong buying signals detected', count: this.countForStatuses( ['Opportunity', 'Negotiation', 'Proposal'] ), accent: 'red', icon: 'fire' },
      { label: 'Warm Follow-up', description: 'Ready for your next touch', count: this.countForStatuses( ['Qualified', 'Qualification'] ), accent: 'orange', icon: 'rotate' },
      { label: 'First Touch', description: 'Good matches, start outreach', count: this.countForStatuses( ['Contacted', 'Lead Generation'] ), accent: 'blue', icon: 'paper-plane' },
      { label: 'Needs You', description: 'Needs your input or approval', count: this.countForStatuses( ['Engaged', 'Engagement'] ), accent: 'purple', icon: 'user' },
      { label: 'Cold Reserve', description: 'Parked for now, not a priority', count: this.unassignedCount, accent: 'gray', icon: 'box-archive' },
    ];
  }

  displayName ( contact: Contact ): string {
    return `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.company?.name || 'Unnamed contact';
  }

  openContact ( contact: Contact ): void {
    if ( contact.id ) this.router.navigate( ['/contact', contact.id] );
  }

  private updateStageCounts (): void {
    this.stages.forEach( stage => stage.count = this.countForStatuses( stage.statusNames ) );
    this.updateComputedDisplayData();
  }

  private buildPipelineStatusSteps (): void {
    const total = this.contacts.length;
    const mapped = this.mappedStatusCount;
    const opportunity = this.opportunityCount;
    const catalog = [
      { key: 'sales-handoff', windowLabel: '6:00 AM - 6:30 AM', title: 'Maya Status', owner: 'Maya', objective: "Report Maya's real 6am selection and hourly drafting-duty progress - drafted so far vs. planned, not a separate simulated queue. Leads the day since her real work starts here." },
      { key: 'interest-intake', windowLabel: '6:30 AM - 7:00 AM', title: 'Interest Intake', owner: 'TODD', objective: "Report real reserve buckets - warm inbound, recent engagement, overdue follow-up, cold-lead fallback, and Lead Vault - and how many are already eligible for Maya's next selection." },
      { key: 'lane-assignment', windowLabel: '7:00 AM - 7:30 AM', title: 'Lane Assignment', owner: 'TODD', objective: "Report the real state of Maya's live threads - plan/drafts/outbox/sent, and where each plan thread sits (needs you, engaged, watching, waiting, stalled)." },
      { key: 'follow-up-loop', windowLabel: '7:30 AM - 8:30 AM', title: 'First Wave Execution', owner: 'TODD', objective: "Report the real queued and pending-approval counts from Maya's actual thread pool." },
      { key: 'close-loop', windowLabel: '5:00 PM', title: 'Close Loop', owner: 'TODD + Sales', objective: "Close the day by reporting Maya's real drafting progress and queue state, and run the after-5 recovery push if the daily goal is still unmet." }
    ];
    this.pipelineStatusSteps = catalog.map( step => ({
      ...step, summary: 'This step is staged but has not executed yet.', statusLabel: 'Waiting', count: 0, detail: '', logs: [], generatedItems: []
    }));
    if ( this.customerMomentumEngineState || this.customerMomentumActivityRows.length ) this.applyMomentumStatusData();
  }

  private async loadCustomerMomentumStatus ( userId: string ): Promise<void> {
    if ( !this.tenantId || !userId ) return;
    this.customerMomentumLoading = true;
    try {
      const [state, activity] = await Promise.all([
        firstValueFrom( this.http.get<any>( `${environment.backendURL}/momentum/engine-state`, { params: { tenantId: this.tenantId } } ) ),
        firstValueFrom( this.http.get<any>( `${environment.backendURL}/momentum/activity`, { params: { tenantId: this.tenantId, limit: '100' } } ) )
      ]);
      this.customerMomentumEngineState = state?.data?.engineState || null;
      this.customerMomentumActivityRows = Array.isArray( activity?.data?.items ) ? activity.data.items : [];
      this.applyMomentumStatusData();
    } catch { this.customerMomentumError = 'TODD could not load the customer momentum workspace yet.'; }
    finally { this.customerMomentumLoading = false; }
  }

  private applyMomentumStatusData (): void {
    const outcomes = this.customerMomentumEngineState?.channelOutcomes || {};
    const maya = outcomes.mayaStatus || {};
    const target = outcomes.targetList || {};
    const lanes = outcomes.pipelineStatus || {};
    const wave = outcomes.firstWaveExecution || {};
    const close = outcomes.closeLoop || {};
    const value = ( object: any, key: string ): number => Number( object?.[key] || 0 );
    const bucketItems = ( object: any, keys: Array<[string, string]> ): Array<{ label: string; detail: string; status: string; tone: string }> => keys.map( ([label,key]) => ({ label, detail: `${value(object,key)} contacts`, status: value(object,key) ? 'reported' : 'none found', tone: value(object,key) ? 'positive' : 'neutral' }) );
    const configs = [
      { key:'sales-handoff', count:value(maya,'totalPlanned'), detail:`Drafted: ${value(maya,'draftedSoFar')}/${value(maya,'totalPlanned')} · Auto-send eligible: ${value(maya,'autoSendEligibleCount')} · Draft-only: ${value(maya,'draftOnlyEligibleCount')}`, items: bucketItems(maya,[['Auto-send eligible','autoSendEligibleCount'],['Draft-only (approval first)','draftOnlyEligibleCount']]) },
      { key:'interest-intake', count:value(target,'totalCount'), detail:`Warm inbound: ${value(target.warmInbound,'count')} · Recent click/open: ${value(target.recentClickOrOpen,'count')} · Due follow-up: ${value(target.dueFollowUp,'count')} · Cold fallback: ${value(target.bestFitColdLeads,'count')} · Lead Vault: ${value(target.leadVaultProspects,'count')}`, items: bucketItems(target,[['Warm inbound','warmInbound'],['Recent click/open','recentClickOrOpen'],['Due follow-up','dueFollowUp'],['Best-fit cold leads','bestFitColdLeads'],['Lead Vault prospects','leadVaultProspects']]) },
      { key:'lane-assignment', count:value(lanes.userLaneCounts,'plan'), detail:`Plan: ${value(lanes.userLaneCounts,'plan')} · Drafts: ${value(lanes.userLaneCounts,'drafts')} · Outbox: ${value(lanes.userLaneCounts,'outbox')} · Sent: ${value(lanes.userLaneCounts,'sent')}`, items: bucketItems(lanes.userLaneCounts,[['Plan','plan'],['Drafts','drafts'],['Outbox','outbox'],['Sent','sent']]) },
      { key:'follow-up-loop', count:value(wave,'draftsPendingCount'), detail:`Queued: ${value(wave,'outboxCount')} · Approval pending: ${value(wave,'draftsPendingCount')} · Sent: ${value(wave,'sentCount')} · Not yet drafted: ${value(wave,'notYetDraftedCount')}`, items: bucketItems(wave,[['Queued (outbox)','outboxCount'],['Approval pending (drafts)','draftsPendingCount'],['Sent','sentCount'],['Not yet drafted by Maya','notYetDraftedCount']]) },
      { key:'close-loop', count:value(close,'draftsPendingCount'), detail:`Maya drafted: ${value(close,'mayaDraftedCount')}/${value(close,'mayaTotalPlanned')} · Queued: ${value(close,'outboxCount')} · Approval pending: ${value(close,'draftsPendingCount')} · Sent: ${value(close,'sentCount')}`, items: bucketItems(close,[['Maya drafted vs. planned','mayaDraftedCount'],['Queued','outboxCount'],['Approval still pending','draftsPendingCount'],['Sent','sentCount']]) }
    ];
    this.pipelineStatusSteps = this.pipelineStatusSteps.map( step => {
      const config = configs.find( item => item.key === step.key );
      const logs = this.customerMomentumActivityRows.filter( row => String(row?.metadata?.customerPipelineStepKey || row?.customerPipelineStepKey || '') === step.key ).slice(0,12).map( row => ({ timeLabel: row.occurredAt ? new Date(row.occurredAt).toLocaleTimeString([], { hour:'numeric', minute:'2-digit' }) : '—', event: String(row.type || 'Observed Event'), status: String(row.status || 'completed'), message: String(row.message || row.title || 'Observed pipeline event.'), detail: String(row.detail || row.summary || ''), source: String(row.sourceEntrypoint || row.sourceComponent || 'system') }) );
      return config ? { ...step, count:config.count, detail:config.detail, generatedItems:config.items, logs, summary:logs.length ? `${logs.length} log row${logs.length === 1 ? '' : 's'} recorded for this step in the current test run.` : 'Recovered the latest available state for this step.', statusLabel: logs.length || config.count ? 'Complete' : 'Waiting' } : step;
    });
  }

  private async loadSourceMetrics ( userId: string ): Promise<void> {
    const headers = new HttpHeaders().set( 'x-tenant-id', this.tenantId ).set( 'x-user-id', userId );
    const momentumRequest = firstValueFrom( this.http.get<any>( `${environment.backendURL}/outreach/momentum/today-summary`, { headers } ) );
    const visitorRequest = firstValueFrom( this.http.get<any>( `${environment.backendURL}/anonymous-behavior/summary`, { params: new HttpParams().set( 'tenantId', this.tenantId ).set( 'periodDays', '1' ) } ) );
    const [momentumResult, visitorResult] = await Promise.allSettled( [momentumRequest, visitorRequest] );
    try {
      if ( momentumResult.status !== 'fulfilled' ) return;
      const momentum = momentumResult.value;
      const data = momentum?.data;
      if ( data ) {
        this.todayMomentum = { sent: Number( data.emailsSent || 0 ), opens: Number( data.emailsOpened || 0 ), clicks: Number( data.emailsClicked || 0 ), visits: Number( data.visits || 0 ), socialPosts: Number( data.socialPostsPublished || 0 ), likes: Number( data.socialLikes || 0 ), comments: Number( data.socialComments || 0 ), trend: data.trend?.direction || 'flat' };
        this.todayMomentumLoaded = true;
      }
    } catch { /* Network may not have Outreach activity enabled. */ }

    try {
      if ( visitorResult.status !== 'fulfilled' ) return;
      const visitors = visitorResult.value;
      const overview = visitors?.data?.overview;
      this.visitorCount = Number( overview?.uniqueVisitorCount || 0 );
      const returning = Number( overview?.returningVisitorCount || 0 );
      this.returningVisitorPercent = this.visitorCount ? Math.round( returning / this.visitorCount * 100 ) : 0;
      this.stages[0].count = this.visitorCount;
      this.stages[0].detail = `Returning ${this.returningVisitorPercent}%`;
      this.updateComputedDisplayData();
    } catch { /* Visitor analytics are optional. */ }
  }
}
