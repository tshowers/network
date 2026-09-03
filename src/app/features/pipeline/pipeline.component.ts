import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { NetworkAuthService } from '../../services/network-auth.service';
import { NetworkDataService } from '../../services/network-data.service';
import { Contact } from '../../models/contact.model';
import { BackToTopComponent } from '../../shared/back-to-top/back-to-top.component';
import { PreloaderComponent } from '../../shared/preloader/preloader.component';
import { CockpitBrowseModeBannerComponent } from '../../shared/cockpit-browse-mode-banner/cockpit-browse-mode-banner.component';

interface PipelineStage {
  name: string;
  contacts: Contact[];
}

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
  imports: [CommonModule, RouterModule, BackToTopComponent, PreloaderComponent, CockpitBrowseModeBannerComponent],
  templateUrl: './pipeline.component.html',
  styleUrl: './pipeline.component.css',
} )
export class PipelineComponent implements OnInit {
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

  private tenantId = '';

  constructor (
    private router: Router,
    private titleService: Title,
    private authService: NetworkAuthService,
    private dataService: NetworkDataService,
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
      const contacts = await this.dataService.getAllContacts( this.tenantId );
      this.buildStages( contacts );
    } catch {
      this.errorMessage = 'Unable to load your pipeline right now.';
    } finally {
      this.isLoading = false;
    }
  }

  private buildStages ( contacts: Contact[] ): void {
    const validContacts = contacts.filter( ( contact ) => !!contact.status?.trim() );
    this.pipelineContactCount = validContacts.length;

    this.stages = this.stageNames.map( ( name ) => ( {
      name,
      contacts: validContacts.filter( ( contact ) => contact.status === name ),
    } ) );
  }

  displayName ( contact: Contact ): string {
    const name = `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
    return name || contact.company?.name || 'Unnamed contact';
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
