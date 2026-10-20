import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, OnInit, QueryList, ViewChildren } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { LandingEngagementService } from '../../services/landing-engagement.service';
import { NetworkAuthService } from '../../services/network-auth.service';
import { SeoService } from '../../shared/seo.service';
import { SiteFooterComponent } from '../../shared/site-footer/site-footer.component';
import { AlsoFromUsComponent } from '../../shared/also-from-us/also-from-us.component';

@Component( {
  selector: 'app-network-landing',
  standalone: true,
  imports: [ AlsoFromUsComponent, SiteFooterComponent, RouterModule],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css'
} )
export class LandingComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly isLoggedIn$: ReturnType<NetworkAuthService['isLoggedIn']>;

  @ViewChildren( 'demoVideo' ) private demoVideos?: QueryList<ElementRef<HTMLVideoElement>>;
  private themeObserver?: MutationObserver;
  private colorSchemeQuery?: MediaQueryList;
  private readonly onColorSchemeChange = (): void => this.playVisibleDemo();

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
    this.title.setTitle( 'Network — Get clients. Keep clients. | Taliferro Tech' );
    this.meta.updateTag( { name: 'description', content: 'Your next client is probably someone you already know. Network keeps contacts, companies, conversations, and opportunities connected so TODD can surface who needs attention and what to do next.' } );
    this.meta.updateTag( { property: 'og:title', content: 'Network — Get clients. Keep clients.' } );
    this.meta.updateTag( { property: 'og:description', content: 'Your next client is probably someone you already know. See who needs your attention and what to do next.' } );
    this.meta.updateTag( { property: 'og:url', content: 'https://network.taliferro.tech/' } );
    this.meta.updateTag( { name: 'twitter:title', content: 'Network — Get clients. Keep clients.' } );
    this.meta.updateTag( { name: 'twitter:description', content: 'Your next client is probably someone you already know. See who needs your attention and what to do next.' } );
    this.seo.setCanonical( 'https://network.taliferro.tech/' );

    this.landingContext.start( {
      featureKey: 'network',
      title: 'Network Landing',
      description: 'Public product landing page for visitors evaluating Network as the relationship context TODD uses to recommend next steps.',
      primaryRoute: '/get-started',
      pricingRoute: '/pricing'
    } );
  }

  ngAfterViewInit (): void {
    window.scrollTo( 0, 0 );
    this.publishScrollDepth();
    this.startDemoVideo();
  }

  ngOnDestroy (): void {
    this.landingContext.stop();
    this.themeObserver?.disconnect();
    this.colorSchemeQuery?.removeEventListener( 'change', this.onColorSchemeChange );
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

  // Both theme variants are in the DOM with preload="none"; CSS hides one, so
  // only the visible one is fetched and played. Re-check when the theme flips.
  private startDemoVideo (): void {
    this.playVisibleDemo();
    this.themeObserver = new MutationObserver( () => this.playVisibleDemo() );
    this.themeObserver.observe( document.documentElement, { attributes: true, attributeFilter: ['data-theme'] } );
    this.colorSchemeQuery = window.matchMedia( '(prefers-color-scheme: dark)' );
    this.colorSchemeQuery.addEventListener( 'change', this.onColorSchemeChange );
  }

  private playVisibleDemo (): void {
    const reduceMotion = window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;
    this.demoVideos?.forEach( ( { nativeElement: video } ) => {
      if ( getComputedStyle( video ).display === 'none' ) {
        video.pause();
        return;
      }
      if ( reduceMotion ) {
        return; // Leave the poster frame up.
      }
      // muted must be set as a property for autoplay policies; the attribute alone isn't always honored.
      video.muted = true;
      video.play().catch( () => { /* Autoplay blocked (e.g. Low Power Mode); the poster stays. */ } );
    } );
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
