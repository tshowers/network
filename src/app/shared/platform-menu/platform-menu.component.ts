import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import packageJson from '../../../../package.json';
import { RouterModule } from '@angular/router';

import { getPlatformMenuItems, PlatformMenuItem } from '@taliferro/ui/platform/account-menu.model';

interface ProductLink {
  label: string;
  url: string;
  icon: string;
  description: string;
}

interface AppRouteLink { label: string; route: string; signOut?: boolean; }

/**
 * Top-right hamburger that slides a panel down over the page. Products on
 * the left (the other standalone apps), Account on the right (the TODD
 * routes that never got ported per-app - profile, billing, admin, etc.) -
 * see taliferrotech's TODD-routes-migration doc and the Maya app's version,
 * which this mirrors.
 */
@Component( {
  selector: 'app-platform-menu',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './platform-menu.component.html',
  styleUrl: './platform-menu.component.css',
} )
export class PlatformMenuComponent {
  @Input() isAdmin = false;
  @Input() isLoggedIn = false;
  @Output() readonly signOut = new EventEmitter<void>();

  isOpen = false;
  readonly appVersion = String(packageJson.version || '').trim();

  get appRoutes (): AppRouteLink[] {
    return [
      { label: 'Home', route: '/' },
      { label: 'Relationships', route: '/app' },
      { label: 'Contacts', route: '/contact-list' },
      { label: 'Add', route: '/contact-edit' },
      { label: 'Import', route: '/contact-import' },
      { label: 'Pipeline', route: '/contact-deal-flow' },
      { label: 'Networking Progress', route: '/contact-deal-flow-dashboard' },
      { label: 'iOS App', route: '/ios' },
      { label: 'Pricing', route: '/pricing' },
      this.isLoggedIn
        ? { label: 'Sign Out', route: '/', signOut: true }
        : { label: 'Sign In', route: '/login' },
    ];
  }

  readonly productLinks: ProductLink[] = [
    { label: 'Ask TODD', url: 'https://ask.taliferro.tech', icon: 'assets/find/entities/todd/logo-bw-icon.png', description: 'Turn uncertainty into the next move.' },
    { label: 'Outreach', url: 'https://outreach.taliferro.tech', icon: 'assets/find/entities/outreach/logo-bw-icon.png', description: 'Keep the work moving.' },
    { label: 'Docs', url: 'https://docs.taliferro.tech', icon: 'assets/find/entities/docs/logo-bw-icon.png', description: 'Give your best thinking somewhere to live.' },
    { label: 'Moves', url: 'https://moves.taliferro.tech', icon: 'assets/find/entities/moves/logo-bw-icon.png', description: 'Make progress visible and actionable.' },
    { label: 'Pulse', url: 'https://pulse.taliferro.tech', icon: 'assets/find/entities/pulse/logo-bw-icon.png', description: 'Hear what people are really saying.' },
    { label: 'Social', url: 'https://social.taliferro.tech', icon: 'assets/find/entities/social/logo-bw-icon.png', description: 'Stay visible without living online.' },
    { label: 'Lead Vault', url: 'https://lead-vault.taliferro.tech', icon: 'assets/find/entities/lead-vault/logo-bw-icon.png', description: 'Find the people behind the opportunity.' },
    { label: 'Maya', url: 'https://maya.taliferro.tech', icon: 'assets/find/entities/maya/logo-bw.png', description: 'Think like your marketing director.' },
    { label: 'SayIt', url: 'https://sayit.taliferro.tech', icon: 'assets/find/entities/sayit/logo-bw-icon.png', description: 'Make your message worth sharing.' },
    { label: 'Find', url: 'https://find.taliferro.tech', icon: 'assets/find/entities/find/logo-bw-icon.png', description: 'Get to the answer faster.' },
    { label: 'Email Signature', url: 'https://signature.taliferro.tech', icon: 'assets/find/entities/email-signature-builder/logo-bw-icon.png', description: 'Make every email carry your brand.' },
    { label: 'Music', url: 'https://music.taliferro.com', icon: 'assets/find/entities/music/logo-bw-icon.png', description: 'Let the soundtrack keep moving.' },
  ];

  get accountItems (): PlatformMenuItem[] {
    return getPlatformMenuItems().filter( ( item ) => !item.adminOnly || this.isAdmin );
  }

  toggle (): void {
    this.isOpen = !this.isOpen;
  }

  close (): void {
    this.isOpen = false;
  }

  handleRouteClick ( event: MouseEvent, link: AppRouteLink ): void {
    if ( !link.signOut ) return;
    event.preventDefault();
    this.close();
    this.signOut.emit();
  }
}
