import { AfterViewInit, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { LandingEngagementService } from '../../services/landing-engagement.service';
import { NetworkAuthService } from '../../services/network-auth.service';
import { SeoService } from '../../shared/seo.service';

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
    private readonly authService: NetworkAuthService,
    private readonly title: Title,
    private readonly meta: Meta,
    private readonly seo: SeoService
  ) {
    this.isLoggedIn$ = this.authService.isLoggedIn();
  }

  ngOnInit (): void {
    // index.html ships the homepage's title/meta/canonical as static
    // defaults, but Help and About overwrite them via Title/Meta/SeoService
    // when visited — restore the defaults here so a client-side navigation
    // back to Home (no full page reload) doesn't leave those pages'
    // metadata stuck in place. This route is excluded from prerendering
    // (see app.routes.server.ts — it depends on Firebase Auth state, which
    // isn't safe to evaluate at build time), so this only ever runs client-side.
    this.title.setTitle( 'Network — Know who matters and what to do next | Taliferro Tech' );
    this.meta.updateTag( { name: 'description', content: 'Network keeps contacts, companies, conversations, and opportunities connected so TODD can surface who needs attention and what to do next.' } );
    this.meta.updateTag( { property: 'og:title', content: 'Network — Know who matters and what to do next' } );
    this.meta.updateTag( { property: 'og:description', content: 'Keep relationship context together so TODD can identify who needs attention, which opportunities are moving, and what should happen next.' } );
    this.meta.updateTag( { property: 'og:url', content: 'https://network.taliferro.tech/' } );
    this.meta.updateTag( { name: 'twitter:title', content: 'Network — Know who matters and what to do next' } );
    this.meta.updateTag( { name: 'twitter:description', content: 'Keep relationship context together so TODD can identify who needs attention and what should happen next.' } );
    this.seo.setCanonical( 'https://network.taliferro.tech/' );

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
