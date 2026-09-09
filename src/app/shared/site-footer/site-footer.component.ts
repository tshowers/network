import { Component, OnInit } from '@angular/core';

@Component( {
  selector: 'app-site-footer',
  standalone: true,
  templateUrl: './site-footer.component.html',
  styleUrl: './site-footer.component.css'
} )
export class SiteFooterComponent implements OnInit {
  readonly year = new Date().getFullYear();
  version = '2026.9.3-build.1';

  async ngOnInit (): Promise<void> {
    try {
      const response = await fetch( 'assets/version.json', { cache: 'no-store' } );
      if ( response.ok ) {
        const payload = await response.json() as { version?: string };
        if ( payload.version ) this.version = payload.version;
      }
    } catch {
      // Keep the packaged fallback visible if the version asset is unavailable.
    }
  }
}
