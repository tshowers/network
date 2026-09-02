import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { StatusLedComponent } from '../../shared/status-led/status-led.component';
import { LandingEngagementService } from '../../services/landing-engagement.service';

/**
 * Ported from features/contact/network-landing/network-landing.component.ts.
 * Copy is unchanged; LandingPageEngagementContextService is swapped for the
 * no-op LandingEngagementService stub (see that file for why).
 */
@Component( {
  selector: 'app-network-landing',
  standalone: true,
  imports: [CommonModule, RouterModule, StatusLedComponent],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css'
} )
export class LandingComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly painPoints = [
    {
      heading: 'A CRM holding your contacts isn’t the same as one working them',
      copy: 'A CRM will store every name, email, and note perfectly. What it won’t do is tell you who has gone cold, who is ready for a nudge, or what to say. That part is still on you.'
    },
    {
      heading: 'Context disappears between conversations',
      copy: 'You spoke to someone six months ago about something important. You cannot find it. You re-introduce yourself. The relationship resets.'
    },
    {
      heading: 'No signal on who to reach next',
      copy: 'You have hundreds of contacts and no system for deciding which relationship deserves attention today. High-value connections go cold because nothing surfaced them.'
    }
  ];

  readonly outcomes = [
    {
      kicker: 'Signal ready',
      heading: 'Every contact tells TODD how to prioritize the next reach out.',
      copy: 'Company, role, deal stage, last interaction, and silence duration — Network holds it all so TODD can score each relationship and surface who needs attention before the thread goes cold.'
    },
    {
      kicker: 'Company graph',
      heading: 'TODD sees the organization, not just the person.',
      copy: 'Network links contacts to their companies so TODD can surface who else at the account needs attention, which deal is stalling at the organization level, and when multiple signals are appearing at once.'
    },
    {
      kicker: 'Deal flow',
      heading: 'Opportunity is tracked — and TODD surfaces what is moving.',
      copy: 'Deal stages are built into Network so TODD can identify which relationships are approaching close, which deals have gone quiet, and where follow-up pressure belongs today — not after you manually review a pipeline report.'
    },
    {
      kicker: 'Import ready',
      heading: 'Bring your existing contacts in and let TODD start reading them.',
      copy: 'CSV import maps your existing data into Network automatically. Once your contacts are in, TODD begins watching the relationship graph and surfacing who should be in motion.'
    }
  ];

  readonly stats = [
    { value: '1', label: 'relationship graph that TODD watches and works on your behalf' },
    { value: '360°', label: 'relationship context read by TODD to surface the strongest next move' },
    { value: '0', label: 'relationships that go cold unnoticed when TODD is watching the network' }
  ];

  readonly steps = [
    {
      number: '01',
      title: 'Import or add your contacts so TODD can start reading them',
      copy: 'Paste in a CSV or create contacts directly. Network maps company connections automatically — and TODD begins watching for signals the moment the data is in.'
    },
    {
      number: '02',
      title: 'Log interactions and deal stages as they happen',
      copy: 'Add notes, record calls, and update deal stages. Every update makes TODD\'s signal picture more complete — so the next recommendation reflects what actually happened, not just who is in the system.'
    },
    {
      number: '03',
      title: 'Network is the foundation TODD reads across every module',
      copy: 'Outreach resolves campaign audiences from Network. Moves links follow-up tasks to contacts. Daily Momentum uses relationship data to rank the strongest next move. The context you build here reaches everywhere TODD works.'
    }
  ];

  constructor (
    private readonly landingContext: LandingEngagementService
  ) { }

  ngOnInit (): void {
    this.landingContext.start( {
      featureKey: 'network',
      title: 'Network Landing',
      description: 'Public product landing page for visitors evaluating Network as TODD’s relationship graph and contact foundation.',
      primaryRoute: '/app',
      pricingRoute: '/pricing'
    } );
  }

  ngAfterViewInit (): void {
    window.scrollTo( 0, 0 );
    this.publishScrollDepth();
  }

  ngOnDestroy (): void {
    this.landingContext.stop();
  }

  onPrimaryCtaClick (): void {
    this.landingContext.markPrimaryCtaClick();
  }

  onPricingCtaClick (): void {
    this.landingContext.markPricingCtaClick();
  }

  @HostListener( 'window:scroll' )
  onWindowScroll (): void {
    this.publishScrollDepth();
  }

  @HostListener( 'document:mouseout', ['$event'] )
  onDocumentMouseOut ( event: MouseEvent ): void {
    if ( event.clientY <= 0 ) {
      this.landingContext.markExitIntent();
    }
  }

  private publishScrollDepth (): void {
    if ( typeof window === 'undefined' || typeof document === 'undefined' ) {
      return;
    }

    const doc = document.documentElement;
    const scrollTop = window.scrollY || doc.scrollTop || 0;
    const maxScroll = Math.max( doc.scrollHeight - window.innerHeight, 0 );
    const scrollDepth = maxScroll > 0 ? Math.min( 1, scrollTop / maxScroll ) : 0;
    this.landingContext.updateScrollDepth( scrollDepth );
  }
}
