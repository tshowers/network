import { AsyncPipe, NgIf } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';

import { environment } from '../environments/environment';
import { NetworkAuthService } from './services/network-auth.service';
import { ToastComponent } from './shared/toast/toast.component';
import { SiteFooterComponent } from './shared/site-footer/site-footer.component';
import { CommandPaletteComponent } from './shared/page/command-palette/command-palette.component';
import { PlatformMenuComponent } from './shared/platform-menu/platform-menu.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastComponent, SiteFooterComponent, CommandPaletteComponent, PlatformMenuComponent, AsyncPipe, NgIf],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  private readonly authService = inject( NetworkAuthService );
  private readonly router = inject( Router );
  private readonly updates = inject( SwUpdate );
  private isReloadingForUpdate = false;
  private pendingUpdateVersion = '';
  readonly updateNoticeStorageKey = 'network-updated-version';
  updateNotice = '';
  readonly isAdmin$ = this.authService.getUser().pipe( map( user => user?.uid === environment.taliferroTenantId ) );
  readonly isLoggedIn$ = this.authService.isLoggedIn();
  readonly isEmbedded = typeof window !== 'undefined'
    && new URLSearchParams( window.location.search ).get( 'embedded' ) === 'true';

  title = 'network';

  async signOut (): Promise<void> {
    await this.authService.signOut();
    await this.router.navigateByUrl( '/' );
  }

  ngOnInit (): void {
    this.showUpdateNoticeAfterReload();
    if ( !environment.production ) return;

    this.updates.versionUpdates.subscribe( event => {
      if ( event.type === 'VERSION_READY' ) {
        this.handleReadyUpdate( this.versionFromEvent( event ) || 'the latest version' );
      }
    } );

    this.router.events.pipe( filter( event => event instanceof NavigationEnd ) ).subscribe( () => {
      if ( this.pendingUpdateVersion && !this.isEditingContact() ) {
        const version = this.pendingUpdateVersion;
        this.pendingUpdateVersion = '';
        void this.activateAndReload( version );
      }
    } );

    void this.checkDeployedVersion();
  }

  dismissUpdateNotice (): void {
    this.updateNotice = '';
  }

  private showUpdateNoticeAfterReload (): void {
    try {
      const updatedVersion = localStorage.getItem( this.updateNoticeStorageKey );
      if ( !updatedVersion ) return;
      localStorage.removeItem( this.updateNoticeStorageKey );
      this.updateNotice = `Network has been updated to ${updatedVersion}.`;
    } catch { }
  }

  private async checkDeployedVersion (): Promise<void> {
    try {
      const response = await fetch( `/assets/version.json?t=${Date.now()}`, { cache: 'no-store' } );
      if ( !response.ok ) return;
      const payload = await response.json() as { version?: string };
      const deployedVersion = String( payload.version || '' ).trim();
      const currentVersion = String( environment.VERSION || '' ).trim();
      if ( deployedVersion && currentVersion && deployedVersion !== currentVersion ) {
        await this.activateAndReload( deployedVersion );
      }
    } catch ( error ) {
      console.warn( '[NetworkVersionCheck] unable to check deployed version', error );
    }
  }

  private handleReadyUpdate ( version: string ): void {
    if ( this.isEditingContact() ) {
      this.pendingUpdateVersion = version;
      return;
    }
    void this.activateAndReload( version );
  }

  private isEditingContact (): boolean {
    return this.router.url.split( '?' )[0] === '/contact-edit';
  }

  private async activateAndReload ( version: string ): Promise<void> {
    if ( this.isReloadingForUpdate ) return;
    this.isReloadingForUpdate = true;
    try {
      localStorage.setItem( this.updateNoticeStorageKey, version );
    } catch { }

    if ( this.updates.isEnabled ) {
      try {
        await this.updates.checkForUpdate();
        await this.updates.activateUpdate();
      } catch ( error ) {
        console.warn( '[NetworkVersionCheck] service worker activation failed; reloading anyway', error );
      }
    }

    window.location.reload();
  }

  private versionFromEvent ( event: VersionReadyEvent ): string {
    const appData = event.latestVersion.appData as { version?: string } | undefined;
    return String( appData?.version || '' ).trim();
  }
}
