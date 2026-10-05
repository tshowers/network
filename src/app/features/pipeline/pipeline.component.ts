import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { NetworkAuthService } from '../../services/network-auth.service';
import { NetworkDataService } from '../../services/network-data.service';
import { NetworkAssistantSignalService } from '../../services/network-assistant-signal.service';
import { Contact } from '../../models/contact.model';
import { BackToTopComponent } from '../../shared/back-to-top/back-to-top.component';
import { PreloaderComponent } from '../../shared/preloader/preloader.component';
import type { ArcGaugeTone } from '../../shared/arc-gauge/arc-gauge.component';
import { stageTint } from '../../shared/stage-tint';
import { StatusFlowComponent } from '../../shared/status-flow/status-flow.component';
import { ChoiceFieldComponent, ChoiceOption } from '../../shared/choice-field/choice-field.component';

interface PipelineStage {
  name: string;
  contacts: Contact[];
}

interface PipelineHealthMeter {
  label: string;
  value: number;
  tone: ArcGaugeTone;
  detail: string;
}

const EARLY_STAGES = ['Lead Generation', 'Qualification'];
const LATE_STAGES = ['Negotiation', 'Closing', 'Post-Sale', 'Closed Won'];

/**
 * Ground-up rewrite, not a trim, of features/contact/deal-flow-dashboard
 * (1,750 lines) - same call as list.component.ts made for the same reason.
 * The original is barely a "pipeline board with filters": most of its
 * weight is a "Customer Momentum" workspace (a multi-step AI automation
 * test harness wired to GoalService's momentum engine, OutreachApiService
 * email/social stats, and an activity log), a natural-language query box
 * that calls OpenAIService to parse filters out of typed English, and a
 * pipeline-evidence verification layer (AcquisitionService cross-checking
 * each contact's stage against tracked engagement events). None of that
 * has a home in this standalone app - it's TODD's own AI/automation
 * surface, not "view your contacts by stage."
 *
 * The header/health-tile chrome below is real TODD "Command Deck" styling
 * (CockpitCommandDeckComponent + ArcGaugeComponent, the exact pieces
 * contact-home already uses) - reused here so this page visually matches
 * the rest of the app's dashboard language instead of being a plain white
 * Kanban board. The three health tiles are computed from this tenant's
 * actual stage counts (early/late-stage volume, close rate) - not the
 * fabricated email/social "Today's Momentum" numbers TODD's real page
 * shows, since Network has no equivalent data source for those.
 *
 * What this delivers instead: the actual deal-flow-board.component.ts
 * Kanban view (the one genuinely reusable piece of the original) -
 * contacts grouped into the same 8 pipeline stages StatusFlowComponent
 * already uses in contact-edit, so a status set there shows up here
 * unchanged. Region/deal-size filtering, the AI query box, and the
 * momentum workspace are deferred, not ported thin.
 */
@Component( {
  selector: 'app-pipeline',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    BackToTopComponent,
    PreloaderComponent,
    StatusFlowComponent,
    ChoiceFieldComponent,
  ],
  templateUrl: './pipeline.component.html',
  styleUrl: './pipeline.component.css',
} )
export class PipelineComponent implements OnInit, OnDestroy {
  readonly stageNames: string[] = [
    'Lead Generation',
    'Qualification',
    'Engagement',
    'Proposal',
    'Negotiation',
    'Closing',
    'Post-Sale',
    'Closed Won',
  ];

  /** null = auth state not resolved yet (still show the preloader); false = resolved and signed out. */
  isSignedIn: boolean | null = null;
  isLoading = true;
  errorMessage = '';
  stages: PipelineStage[] = [];
  pipelineContactCount = 0;
  healthMeters: PipelineHealthMeter[] = [];
  momentumScore = 0;
  closedWonCount = 0;

  /** Phone: which single lane to show (picked with the stage chooser). */
  mobileStage = '';
  /** The card whose Move list is open, and the one just moved. */
  movePickerFor = '';
  movedFor = '';
  moveErrorFor = '';

  private tenantId = '';
  private allContacts: Contact[] = [];

  constructor (
    private router: Router,
    private titleService: Title,
    private authService: NetworkAuthService,
    private dataService: NetworkDataService,
    private assistantBus: NetworkAssistantSignalService,
  ) { }

  async ngOnInit (): Promise<void> {
    this.titleService.setTitle( `${environment.COMPANY_NAME} - Pipeline` );

    const userId = await firstValueFrom( this.authService.getUserId() );
    this.isSignedIn = !!userId;

    if ( !this.isSignedIn ) {
      this.isLoading = false;
      return;
    }

    this.tenantId = await this.authService.resolveTenantId( userId );

    try {
      this.allContacts = await this.dataService.getAllContacts( this.tenantId );
      this.buildStages( this.allContacts );
      this.buildHealthMeters();
      this.publishAssistantContext();
    } catch {
      this.errorMessage = 'Unable to load your pipeline right now.';
    } finally {
      this.isLoading = false;
    }
  }

  ngOnDestroy (): void {
    this.assistantBus.clearPageContext();
  }

  private publishAssistantContext (): void {
    this.assistantBus.setPageContext( {
      feature: 'pipeline',
      page: 'pipeline',
      mode: 'dashboard',
      title: 'Pipeline',
      summary: {
        pipelineContactCount: this.pipelineContactCount,
        momentumScore: this.momentumScore,
        closedWonCount: this.closedWonCount,
      },
    } );
  }

  private buildStages ( contacts: Contact[] ): void {
    const validContacts = contacts.filter( ( contact ) => !!contact.status?.trim() );
    this.pipelineContactCount = validContacts.length;

    this.stages = this.stageNames.map( ( name ) => ( {
      name,
      contacts: validContacts.filter( ( contact ) => contact.status === name ),
    } ) );
    if ( !this.mobileStage ) {
      this.mobileStage = this.stages.find( ( stage ) => stage.contacts.length > 0 )?.name || this.stageNames[0];
    }
  }

  /** Phone stage chooser: each lane with its count. */
  get stageChoiceOptions (): ChoiceOption[] {
    return this.stages.map( ( stage ) => ( { value: stage.name, label: `${stage.name} (${stage.contacts.length})` } ) );
  }

  toggleMove ( event: Event, contact: Contact ): void {
    event.stopPropagation();
    const id = contact.id || '';
    this.movePickerFor = this.movePickerFor === id ? '' : id;
  }

  /** Moves a contact to another stage right from the board. */
  async moveContact ( contact: Contact, status: string ): Promise<void> {
    const id = contact.id || '';
    const previous = contact.status;
    this.movePickerFor = '';
    this.moveErrorFor = '';
    if ( !id || status === previous ) return;
    contact.status = status;
    // Follow the card: on phones switch to its new lane; on wider screens
    // scroll it into view (lanes past the edge are off-screen otherwise).
    this.mobileStage = status;
    this.refreshBoard();
    setTimeout( () => this.revealCard( id ), 50 );
    try {
      await this.dataService.updateContact( this.tenantId, id, { status } );
      this.movedFor = id;
      setTimeout( () => { if ( this.movedFor === id ) this.movedFor = ''; }, 2000 );
    } catch {
      contact.status = previous;
      this.refreshBoard();
      this.moveErrorFor = id;
    }
  }

  /** Scroll the board sideways (and the page if needed) so a card is in view. */
  private revealCard ( id: string ): void {
    const card = document.querySelector<HTMLElement>( `[data-contact-id="${id}"]` );
    const board = card?.closest<HTMLElement>( '.pl-board' );
    if ( !card || !board ) return;
    const cardRect = card.getBoundingClientRect();
    const boardRect = board.getBoundingClientRect();
    if ( cardRect.right > boardRect.right || cardRect.left < boardRect.left ) {
      board.scrollLeft += cardRect.left - boardRect.left - ( boardRect.width - cardRect.width ) / 2;
    }
    card.scrollIntoView( { block: 'nearest' } );
  }

  private refreshBoard (): void {
    this.buildStages( this.allContacts );
    this.buildHealthMeters();
    this.publishAssistantContext();
  }

  private countInStages ( stageNames: string[] ): number {
    return this.stages
      .filter( ( stage ) => stageNames.includes( stage.name ) )
      .reduce( ( total, stage ) => total + stage.contacts.length, 0 );
  }

  private percentOfPipeline ( count: number ): number {
    if ( this.pipelineContactCount === 0 ) return 0;
    return Number( ( ( count / this.pipelineContactCount ) * 100 ).toFixed( 2 ) );
  }

  private buildHealthMeters (): void {
    const lateStageCount = this.countInStages( LATE_STAGES );
    const earlyStageCount = this.countInStages( EARLY_STAGES );
    const closedWonCount = this.stages.find( ( s ) => s.name === 'Closed Won' )?.contacts.length || 0;
    this.closedWonCount = closedWonCount;

    const lateStagePct = this.percentOfPipeline( lateStageCount );
    const earlyStagePct = this.percentOfPipeline( earlyStageCount );
    const closedWonPct = this.percentOfPipeline( closedWonCount );

    this.momentumScore = lateStagePct;

    this.healthMeters = [
      {
        label: 'Late-stage momentum',
        value: lateStagePct,
        tone: lateStagePct >= 40 ? 'positive' : lateStagePct >= 15 ? 'info' : 'attention',
        detail: `${lateStageCount} contact${lateStageCount === 1 ? '' : 's'} in Negotiation or later`,
      },
      {
        label: 'Closed won',
        value: closedWonPct,
        tone: 'positive',
        detail: `${closedWonCount} contact${closedWonCount === 1 ? '' : 's'} closed won`,
      },
      {
        label: 'Early-stage volume',
        value: earlyStagePct,
        tone: 'info',
        detail: `${earlyStageCount} contact${earlyStageCount === 1 ? '' : 's'} in Lead Generation or Qualification`,
      },
    ];
  }

  displayName ( contact: Contact ): string {
    const name = `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
    return name || contact.company?.name || 'Unnamed contact';
  }

  readonly tint = stageTint;

  /** Ring colour: TODD's info meters are blue; the rest follow green/amber/red. */
  ringTier ( meter: PipelineHealthMeter ): string {
    if ( meter.tone === 'info' ) return 'blue';
    return meter.value >= 70 ? 'high' : meter.value >= 40 ? 'mid' : 'low';
  }

  formatPct ( value: number ): string {
    return value > 0 && value < 1 ? value.toFixed( 2 ) : String( Math.round( value ) );
  }

  initials ( contact: Contact ): string {
    const first = ( contact.firstName || '' ).trim();
    const last = ( contact.lastName || '' ).trim();
    const combined = `${first.charAt( 0 )}${last.charAt( 0 )}`.toUpperCase();
    if ( combined ) return combined;

    const company = ( contact.company?.name || '' ).trim();
    return company ? company.charAt( 0 ).toUpperCase() : '?';
  }

  openContact ( contact: Contact ): void {
    if ( contact.id ) this.router.navigate( ['/contact', contact.id] );
  }
}
