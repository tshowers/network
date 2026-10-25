import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { PROFILE_AI_QUESTIONS, ToddProfile } from '@taliferro/ui/platform/profile-choices.model';

import { FlagAction, ImportRow, ImportState, NetworkImportService } from '../../services/network-import.service';
import { NetworkEntitlementService } from '../../services/network-entitlement.service';
import { NetworkNotificationService } from '../../services/network-notification.service';
import { NetworkOnboardingService } from '../../services/network-onboarding.service';
import { OutreachLinkService } from '../../services/outreach-link.service';
import { ProfileApiService } from '../../services/profile-api.service';
import { WriteActionDirective } from '../../shared/write-access/write-action.directive';

/** Rows that can go to Outreach now. Sample contacts count, so a trial run reads true. */
const READY_STATUSES = new Set( ['verified', 'enriched', 'fixed', 'sample'] );

/**
 * After cleanup (design_handoff_network_onboarding 05): who's ready, the
 * next step into Outreach (or the weekly list without it), and the
 * contacts TODD flagged for the user.
 */
@Component( {
  selector: 'app-import-ready',
  standalone: true,
  imports: [CommonModule, RouterLink, WriteActionDirective],
  templateUrl: './import-ready.component.html',
  styleUrl: './import-ready.component.css',
} )
export class ImportReadyComponent implements OnInit, OnDestroy {
  private readonly route = inject( ActivatedRoute );
  private readonly router = inject( Router );
  private readonly imports = inject( NetworkImportService );
  private readonly entitlements = inject( NetworkEntitlementService );
  private readonly notifications = inject( NetworkNotificationService );
  private readonly profileApi = inject( ProfileApiService );
  private readonly title = inject( Title );
  readonly onboarding = inject( NetworkOnboardingService );
  private readonly outreach = inject( OutreachLinkService );

  batchId = '';
  state: ImportState | null = null;
  profile: ToddProfile | null = null;
  hasOutreach = false;
  errorMessage = '';
  /** Contact ids with a request in flight. */
  busy = new Set<string>();
  private subscription?: Subscription;

  async ngOnInit (): Promise<void> {
    this.title.setTitle( 'Ready to reach out — Network' );
    this.batchId = this.route.snapshot.paramMap.get( 'batchId' ) || '';
    this.subscription = this.entitlements.getEntitlements().subscribe( ( e ) => ( this.hasOutreach = e.outreach ) );
    void this.onboarding.refresh();
    this.profileApi.load().then( ( profile ) => ( this.profile = profile ) ).catch( () => ( this.profile = null ) );
    try {
      this.state = await this.imports.get( this.batchId );
    } catch ( error: any ) {
      this.errorMessage = error?.status === 404 ? 'We couldn’t find that import.' : 'We couldn’t load this import.';
    }
  }

  ngOnDestroy (): void {
    this.subscription?.unsubscribe();
  }

  get readyCount (): number {
    return ( this.state?.contacts || [] ).filter( ( row ) => READY_STATUSES.has( row.status ) ).length;
  }

  get flagged (): ImportRow[] {
    return ( this.state?.contacts || [] ).filter( ( row ) => !!row.flagReason );
  }

  get openFlags (): number {
    return this.flagged.filter( ( row ) => !row.resolution ).length;
  }

  get fixedCount (): number {
    return this.state?.batch.counts?.fixed || 0;
  }

  get filledCount (): number {
    return this.state?.batch.counts?.enriched || 0;
  }

  get deferredCount (): number {
    return this.state?.batch.counts?.deferred || 0;
  }

  /** AI profile questions still unanswered - Outreach writes from these. */
  get missingAnswers (): number {
    const profile = this.profile;
    if ( !profile ) return 0;
    return PROFILE_AI_QUESTIONS.filter( ( q ) => !( profile[q.field] || '' ).trim() ).length;
  }

  get valuePropQuote (): string {
    const text = ( this.profile?.valueProp || '' ).trim();
    return text.length > 110 ? `${text.slice( 0, 110 )}…` : text;
  }

  get weeklyDigest (): boolean {
    return !!this.onboarding.onboarding()?.state.weeklyDigest;
  }

  keepLabel ( row: ImportRow ): string {
    return row.flagReason === 'undeliverable' ? 'Find new email' : 'Keep anyway';
  }

  async resolve ( row: ImportRow, action: FlagAction ): Promise<void> {
    if ( this.busy.has( row.id ) ) return;
    this.busy.add( row.id );
    try {
      this.state = await this.imports.resolveFlag( this.batchId, row.id, action );
      void this.onboarding.refresh();
      if ( action === 'find_email' ) await this.router.navigate( ['/contact', row.id] );
    } catch ( error: any ) {
      this.notifications.show( 'Couldn’t save that', error?.error?.message || error?.message || 'Please try again.', 'error' );
    } finally {
      this.busy.delete( row.id );
    }
  }

  async setWeekly ( on: boolean ): Promise<void> {
    await this.onboarding.update( { weeklyDigest: on } );
  }

  /** Ready rows Outreach can actually send to - sample contacts stay in Network. */
  private get outreachIds (): string[] {
    return ( this.state?.contacts || [] ).filter( ( row ) => READY_STATUSES.has( row.status ) && row.status !== 'sample' ).map( ( row ) => row.id );
  }

  /** "Open in Outreach" and "Look around first": the composer with them selected (Outreach shows its browse notice without a subscription). */
  openOutreach (): void {
    const ids = this.outreachIds;
    this.outreach.open( ids, ids.length === 1 ? '1 contact' : `${ids.length} contacts` );
  }

  addOutreach (): void {
    this.onboarding.openOutreachPricing();
  }
}
