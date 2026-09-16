import { AfterViewInit, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { LandingEngagementService } from '../../services/landing-engagement.service';
import { NetworkAuthService } from '../../services/network-auth.service';

@Component( {
  selector: 'app-network-landing',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css'
} )
export class LandingComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly isLoggedIn$: ReturnType<NetworkAuthService['isLoggedIn']>;

  constructor (
    private readonly landingContext: LandingEngagementService,
    private readonly authService: NetworkAuthService
  ) {
    this.isLoggedIn$ = this.authService.isLoggedIn();
  }

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

  async onSignOutClick (): Promise<void> {
    await this.authService.signOut();
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
