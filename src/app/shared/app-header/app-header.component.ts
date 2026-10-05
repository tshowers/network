import { isPlatformBrowser } from '@angular/common';
import { Component, EventEmitter, Input, Output, PLATFORM_ID, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { ThemeMode, currentTheme, toggleTheme } from '@taliferro/ui/platform/theme';

import { PlatformMenuComponent } from '../platform-menu/platform-menu.component';

/** The four signed-in sections (design_handoff_music_leadvault_network 15b–15g). */
export const NETWORK_SECTIONS = [
  { label: 'Relationships', route: '/app' },
  { label: 'Contacts', route: '/contact-list', also: ['/contact-edit', '/contact-import', '/contact/'] },
  { label: 'Pipeline', route: '/contact-deal-flow' },
  { label: 'Progress', route: '/contact-deal-flow-dashboard' },
];

/**
 * Network's header: logo and name; the section nav when signed in, or
 * Pricing and Sign in when not; the Light/Dark pill; the Menu pill.
 * On a phone the nav moves into the Menu and the title becomes the section.
 */
@Component( {
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, PlatformMenuComponent],
  templateUrl: './app-header.component.html',
} )
export class AppHeaderComponent {
  @Input() isLoggedIn = false;
  @Input() isAdmin = false;
  @Input() userName = '';
  @Input() userEmail = '';
  @Output() readonly signOut = new EventEmitter<void>();

  private readonly router = inject( Router );
  private readonly isBrowser = isPlatformBrowser( inject( PLATFORM_ID ) );

  readonly sections = NETWORK_SECTIONS;
  readonly theme = signal<ThemeMode>( 'light' );
  readonly url = signal( '' );

  constructor () {
    if ( this.isBrowser ) this.theme.set( currentTheme() );
    this.url.set( this.router.url );
    this.router.events.pipe( filter( e => e instanceof NavigationEnd ) )
      .subscribe( e => this.url.set( ( e as NavigationEnd ).urlAfterRedirects ) );
  }

  /** The section the current page belongs to, if any. */
  get section (): string {
    const path = this.url().split( /[?#]/ )[0];
    const hit = this.sections.find( s => path === s.route || ( s.also || [] ).some( a => path.startsWith( a ) ) );
    return hit?.label || '';
  }

  isActive ( s: typeof NETWORK_SECTIONS[number] ): boolean {
    return this.section === s.label;
  }

  toggleTheme (): void {
    this.theme.set( toggleTheme() );
    // Components that draw with JS colours (gauges, charts) listen for this.
    window.dispatchEvent( new CustomEvent( 'platform-theme-change', { detail: { theme: this.theme() } } ) );
  }
}
