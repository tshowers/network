import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ToddProfile } from '@taliferro/ui/platform/profile-choices.model';

import { CleanupStatus, FixLogEntry, ImportRow, ImportState, NetworkImportService } from '../../services/network-import.service';
import { NetworkOnboardingService } from '../../services/network-onboarding.service';
import { ProfileApiService } from '../../services/profile-api.service';
import { ProfileQuestionCardComponent } from '../../shared/profile-question-card/profile-question-card.component';

const POLL_MS = 1500;

/** How each row's status reads, and its pill tint. */
export const STATUS_LABELS: Record<CleanupStatus, { label: string; tint: string | null }> = {
  waiting: { label: 'Waiting', tint: null },
  checking: { label: 'Checking email', tint: 'grey' },
  filling: { label: 'Filling in details', tint: 'grey' },
  verified: { label: 'Verified', tint: 'green' },
  enriched: { label: 'Enriched', tint: 'green' },
  fixed: { label: 'Fixed', tint: 'blue' },
  flagged: { label: 'Needs a look', tint: 'amber' },
  undeliverable: { label: 'Undeliverable', tint: 'grey' },
  deferred: { label: 'Checks tonight', tint: null },
  sample: { label: 'Sample', tint: 'grey' },
  no_email: { label: 'No email', tint: 'grey' },
};

/**
 * TODD cleaning an import while the user watches
 * (design_handoff_network_onboarding 04): progress, counters, every row's
 * status, what TODD changed, and the profile questions alongside. Polls the
 * batch until it's done; the user can leave and the setup checklist keeps
 * count.
 */
@Component( {
  selector: 'app-import-cleanup',
  standalone: true,
  imports: [CommonModule, RouterLink, ProfileQuestionCardComponent],
  templateUrl: './import-cleanup.component.html',
  styleUrl: './import-cleanup.component.css',
} )
export class ImportCleanupComponent implements OnInit, OnDestroy {
  private readonly route = inject( ActivatedRoute );
  private readonly imports = inject( NetworkImportService );
  private readonly onboarding = inject( NetworkOnboardingService );
  private readonly profileApi = inject( ProfileApiService );
  private readonly title = inject( Title );

  readonly labels = STATUS_LABELS;
  batchId = '';
  state: ImportState | null = null;
  profile: ToddProfile | null = null;
  errorMessage = '';
  private timer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  ngOnInit (): void {
    this.title.setTitle( '16Ahead is working — Network' );
    this.batchId = this.route.snapshot.paramMap.get( 'batchId' ) || '';
    void this.poll();
    this.profileApi.load().then( ( profile ) => ( this.profile = profile ) ).catch( () => ( this.profile = null ) );
  }

  ngOnDestroy (): void {
    this.destroyed = true;
    if ( this.timer ) clearTimeout( this.timer );
  }

  private async poll (): Promise<void> {
    try {
      this.state = await this.imports.get( this.batchId );
      this.errorMessage = '';
    } catch ( error: any ) {
      if ( error?.status === 404 ) {
        this.errorMessage = 'We couldn’t find that import.';
        return;
      }
    }
    if ( this.destroyed ) return;
    if ( this.isDone ) {
      void this.onboarding.refresh();
      return;
    }
    this.timer = setTimeout( () => void this.poll(), POLL_MS );
  }

  get isDone (): boolean {
    return this.imports.isFinished( this.state?.batch );
  }

  get failed (): boolean {
    return this.state?.batch.status === 'failed';
  }

  get total (): number {
    return this.state?.batch.total || this.state?.contacts.length || 0;
  }

  get counts () {
    return this.state?.batch.counts || { processed: 0, checked: 0, fixed: 0, enriched: 0, flagged: 0, deferred: 0 };
  }

  get percent (): number {
    return this.total ? Math.round( this.counts.processed / this.total * 100 ) : 0;
  }

  get heading (): string {
    if ( !this.isDone ) return `Checking ${Math.min( this.counts.processed + 1, Math.max( this.total, 1 ) )} of ${this.total}…`;
    if ( this.failed ) return '16Ahead couldn’t finish checking.';
    const now = this.total - this.counts.deferred;
    return this.counts.deferred ? `${now} checked. ${this.counts.deferred} more tonight.` : `All ${this.total} checked.`;
  }

  get subline (): string {
    if ( this.failed ) return 'Your contacts are in. 16Ahead will retry tonight, and the setup checklist shows where it’s up to.';
    if ( this.counts.deferred ) {
      return `16Ahead checks up to ${this.state?.batch.dailyLimit || 25} emails a day. The rest are checked tonight, and the setup checklist keeps count.`;
    }
    return 'You can leave this page. 16Ahead keeps going and the setup checklist shows where it’s up to.';
  }

  get counters (): Array<{ label: string; value: number }> {
    return [
      { label: 'Imported', value: this.total },
      { label: 'Emails checked', value: this.counts.checked },
      { label: 'Fixed', value: this.counts.fixed },
      { label: 'Filled in', value: this.counts.enriched },
      { label: 'Need you', value: this.counts.flagged },
    ];
  }

  onProfileSaved ( profile: ToddProfile ): void {
    this.profile = profile;
    void this.onboarding.refresh();
  }

  trackRow ( _index: number, row: ImportRow ): string {
    return row.id;
  }

  trackLog ( _index: number, entry: FixLogEntry ): string {
    return entry.id;
  }
}
