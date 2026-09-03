import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { LandingEngagementService } from '../../services/landing-engagement.service';

/**
 * Ported from features/contact/network-landing/network-landing.component.ts.
 * Copy is unchanged; LandingPageEngagementContextService is swapped for the
 * no-op LandingEngagementService stub (see that file for why).
 */
@Component( {
  selector: 'app-network-landing',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css'
} )
export class LandingComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly painPoints = [
    {
      heading: 'A contact list is not a plan',
      copy: 'A CRM can store every name, email, and note. It may not tell you who has gone quiet, who is ready for a follow-up, or what to say. That decision is still left to you.'
    },
    {
      heading: 'Context disappears between conversations',
      copy: 'You spoke to someone six months ago about something important. You cannot find it. You re-introduce yourself. The relationship resets.'
    },
    {
      heading: 'No clear next step',
      copy: 'You have hundreds of contacts and no clear way to decide which relationship deserves attention today. Valuable connections go cold because nothing brings them back into view.'
    }
  ];

  readonly outcomes = [
    {
      kicker: 'Signal ready',
      heading: 'Every contact tells TODD how to prioritize the next reach out.',
      copy: 'Company, role, deal stage, last interaction, and how long it has been since you connected — Network keeps it all together so TODD can surface who needs attention before the relationship goes cold.'
    },
    {
      kicker: 'Company context',
      heading: 'TODD sees the organization, not just the person.',
      copy: 'Network connects contacts to their companies so TODD can surface who else there may need attention, which opportunity is stalling, and when several signs point to the same problem.'
    },
    {
      kicker: 'Deal flow',
      heading: 'Opportunity is tracked — and TODD surfaces what is moving.',
      copy: 'Deal stages give TODD more context to identify which relationships are approaching a decision, which opportunities have gone quiet, and where follow-up matters today — without waiting for a manual pipeline review.'
    },
    {
      kicker: 'Import ready',
      heading: 'Bring your existing contacts in and let TODD start reading them.',
      copy: 'CSV import brings your existing data into Network automatically. Once your contacts are in, TODD begins watching for meaningful changes and surfacing who should be in motion.'
    }
  ];

  readonly stats = this.buildStats();

  readonly steps = [
    {
      number: '01',
      title: 'Import or add your contacts so TODD can start reading them',
      copy: 'Paste in a CSV or create contacts directly. Network connects people to their companies automatically, and TODD begins watching for meaningful changes as soon as the data is in.'
    },
    {
      number: '02',
      title: 'Log interactions and deal stages as they happen',
      copy: 'Add notes, record calls, and update deal stages. Each update gives TODD a clearer picture of what actually happened, so the next recommendation is based on the relationship—not just a name in the system.'
    },
    {
      number: '03',
      title: 'Give TODD the context to help everywhere you work',
      copy: 'Outreach starts with your Network contacts. Moves links follow-up tasks to people. Daily Momentum uses relationship details to rank the strongest next step. The context you build here helps TODD wherever it works.'
    }
  ];

  readonly faqs = [
    {
      question: 'How is Network different from HubSpot or Salesforce?',
      answer: 'HubSpot and Salesforce are systems for managing sales and customer records. Network is the relationship layer TODD reads to understand who matters, what changed, and what should happen next. It keeps the context around a relationship connected so follow-up is timely and relevant.'
    },
    {
      question: 'Is Network another CRM to maintain?',
      answer: 'No. Network is built to keep relationship context useful, not to give you another system to update for its own sake. The contacts, companies, interactions, and deal context give TODD the signal it needs to help prioritize your next move.'
    },
    {
      question: 'What does TODD do with my Network data?',
      answer: 'TODD reads the relationship context in Network to surface who needs attention, why the relationship matters, and what action could keep the opportunity moving.'
    },
    {
      question: 'Who is Network for?',
      answer: 'Network is for people whose work depends on relationships—founders, operators, consultants, and teams who need to remember context and know which conversation deserves attention next.'
    }
  ];

  constructor (
    private readonly landingContext: LandingEngagementService
  ) { }

  ngOnInit (): void {
    this.landingContext.start( {
      featureKey: 'network',
      title: 'Network Landing',
      description: 'Public product landing page for visitors evaluating Network as the relationship context TODD uses to recommend next steps.',
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

  private buildStats (): Array<{ value: string; label: string; copy: string }> {
    const dayInMilliseconds = 24 * 60 * 60 * 1000;
    const today = new Date();
    const todayUtc = Date.UTC( today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() );
    const launchDateUtc = Date.UTC( 2026, 8, 2 );
    const daysSinceLaunch = Math.max( 0, Math.floor( ( todayUtc - launchDateUtc ) / dayInMilliseconds ) );

    return [
      {
        value: ( 12519 + daysSinceLaunch * 137 ).toLocaleString( 'en-US' ),
        label: 'RELATIONSHIP SIGNALS',
        copy: 'detected across Network'
      },
      {
        value: ( 3725 + daysSinceLaunch * 41 ).toLocaleString( 'en-US' ),
        label: 'NEXT ACTIONS',
        copy: 'identified to keep opportunities moving'
      },
      {
        value: ( 431 + daysSinceLaunch * 5 ).toLocaleString( 'en-US' ),
        label: 'REVENUE OPPORTUNITIES',
        copy: 'advanced or protected'
      }
    ];
  }
}
