import { Component, ElementRef, HostListener, Input, OnChanges, OnDestroy, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';

import { NetworkNotificationService } from '../../services/network-notification.service';
import { NetworkOnboarding, NetworkOnboardingService, OnboardingStep } from '../../services/network-onboarding.service';

/** How long a loaded checklist counts as fresh when the user moves between pages. */
const REFRESH_AFTER_MS = 20_000;
/** While an import's cleanup runs and the user is elsewhere, check this often. */
const CLEANUP_WATCH_MS = 20_000;

/**
 * The header's "Setup · N of 5" pill and its "Get Network working" popover
 * (design_handoff_network_onboarding 09). Hidden when signed out, on the
 * paid-success page, and once all five steps are done.
 *
 * While an import's cleanup runs, it keeps checking and says when TODD
 * finishes if the user has left the cleanup page.
 */
@Component( {
  selector: 'app-setup-checklist',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './setup-checklist.component.html',
  styleUrl: './setup-checklist.component.css',
} )
export class SetupChecklistComponent implements OnChanges, OnDestroy {
  @Input() isLoggedIn = false;

  readonly service = inject( NetworkOnboardingService );
  private readonly router = inject( Router );
  private readonly host = inject( ElementRef<HTMLElement> );
  private readonly notifications = inject( NetworkNotificationService );

  readonly isOpen = signal( false );
  readonly onPaidPage = signal( false );
  private loadedAt = 0;
  private watchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor () {
    this.onPaidPage.set( this.isPaidUrl( this.router.url ) );
    this.router.events.pipe( filter( ( e ) => e instanceof NavigationEnd ) ).subscribe( ( e ) => {
      this.onPaidPage.set( this.isPaidUrl( ( e as NavigationEnd ).urlAfterRedirects ) );
      this.isOpen.set( false );
      if ( this.isLoggedIn && Date.now() - this.loadedAt > REFRESH_AFTER_MS ) void this.load();
    } );
  }

  ngOnChanges (): void {
    if ( this.isLoggedIn ) void this.load();
    else this.service.clear();
  }

  ngOnDestroy (): void {
    if ( this.watchTimer ) clearTimeout( this.watchTimer );
  }

  get visible (): boolean {
    const onboarding = this.service.onboarding();
    return this.isLoggedIn && !this.onPaidPage() && !!onboarding && !onboarding.allDone;
  }

  toggle (): void {
    const opening = !this.isOpen();
    this.isOpen.set( opening );
    if ( opening ) void this.load();
  }

  isCurrent ( step: OnboardingStep ): boolean {
    return this.service.currentStepId() === step.id;
  }

  showAction ( step: OnboardingStep ): boolean {
    return !step.done && step.available && !step.automatic;
  }

  reachOut (): void {
    this.isOpen.set( false );
    this.service.openOutreach();
  }

  @HostListener( 'document:click', ['$event'] )
  onDocumentClick ( event: MouseEvent ): void {
    if ( this.isOpen() && !this.host.nativeElement.contains( event.target as Node ) ) this.isOpen.set( false );
  }

  @HostListener( 'document:keydown.escape' )
  onEscape (): void {
    this.isOpen.set( false );
  }

  private async load (): Promise<void> {
    this.loadedAt = Date.now();
    const before = this.service.onboarding();
    const after = await this.service.refresh();
    if ( this.cleanupRunning( before ) && after && !this.cleanupRunning( after ) && after.latestImport &&
      !this.router.url.startsWith( `/import/${after.latestImport.id}` ) ) {
      this.notifications.show( '16Ahead finished checking your contacts', 'Open the setup checklist to see who’s ready.', 'success' );
    }
    if ( this.watchTimer ) clearTimeout( this.watchTimer );
    this.watchTimer = this.isLoggedIn && this.cleanupRunning( after ) ? setTimeout( () => void this.load(), CLEANUP_WATCH_MS ) : null;
  }

  private cleanupRunning ( onboarding: NetworkOnboarding | null ): boolean {
    return ['importing', 'queued', 'running'].includes( onboarding?.latestImport?.status || '' );
  }

  private isPaidUrl ( url: string ): boolean {
    return url.split( /[?#]/ )[0] === '/success';
  }
}
