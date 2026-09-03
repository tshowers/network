import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { LinkPreviewService } from '../../services/link-preview.service';
import { Contact } from '../../models/contact.model';
import { StatusFlowComponent } from '../../shared/status-flow/status-flow.component';
import { EmailStageProgressComponent } from '../../shared/email-stage-progress/email-stage-progress.component';
import { FormatCategoryPipe } from '../../pipes/format-category.pipe';
import { TruncatePipe } from '../../pipes/truncate.pipe';
import { PreloaderComponent } from '../../shared/preloader/preloader.component';
import { BackToTopComponent } from '../../shared/back-to-top/back-to-top.component';

/**
 * Ported from features/contact/read/read.component.ts, trimmed to the
 * core "view a contact" experience. The original (787 lines + ~1,300
 * lines across its shared sub-components) is closer to a kitchen sink:
 * LinkedIn paste/screenshot import with AI field-mapping, auto-archive
 * automation tied to email engagement, sent-email history with a
 * communication-frequency chart, company enrichment triggers, an
 * interactive Google Map. All of that is deliberately deferred, not
 * silently dropped - each piece is a real, substantial feature in its own
 * right (the LinkedIn import alone needs OpenAIService + LinkedInService),
 * not something that belongs bundled into getting contact viewing working.
 *
 * What's kept: identity, status, notes, company details (address as text,
 * no Google Maps dependency), profile type pills, email/phone list,
 * images. No longer extends TopDogComponent - that base class's readiness
 * gating (userId/tenantId/firebaseUser) is handled by whichever page hosts
 * this component (contact-home already does its own auth-context
 * watching), so re-deriving it here would be redundant, not additive.
 */
@Component( {
  selector: 'app-read',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    StatusFlowComponent,
    EmailStageProgressComponent,
    FormatCategoryPipe,
    TruncatePipe,
    PreloaderComponent,
    BackToTopComponent,
  ],
  templateUrl: './read.component.html',
  styleUrl: './read.component.css',
} )
export class ReadComponent implements OnInit, OnChanges {
  @Input() contact?: Contact | null;
  @Input() showAdditionalInfo: boolean = true;
  @Input() isPublicProfile: boolean = false;
  @Input() userId?: string;
  @Input() isLoading = false;

  previewData: any = null;
  visibleCompanyAddresses: any[] = [];
  private fetchLinkPreviewSubscription?: Subscription;

  constructor ( private linkPreviewService: LinkPreviewService ) { }

  ngOnInit (): void {
    this.refreshVisibleCompanyAddresses();
    this.generateLinkPreview();
  }

  ngOnChanges ( changes: SimpleChanges ): void {
    if ( changes['contact'] ) {
      this.refreshVisibleCompanyAddresses();
      this.generateLinkPreview();
    }
  }

  ngOnDestroy (): void {
    this.fetchLinkPreviewSubscription?.unsubscribe();
  }

  private refreshVisibleCompanyAddresses (): void {
    const companyAddresses = Array.isArray( this.contact?.company?.addresses )
      ? this.contact?.company?.addresses
      : [];

    this.visibleCompanyAddresses = ( companyAddresses || [] ).filter( address => this.hasMeaningfulAddress( address ) );
  }

  private hasMeaningfulAddress ( address: any ): boolean {
    if ( !address ) return false;

    const textFields = [
      address.streetAddress,
      address.city,
      address.state,
      address.zip,
      address.county,
      address.country
    ];

    return textFields.some( value => String( value || '' ).trim().length > 0 );
  }

  get contactInitials (): string {
    const first = ( this.contact?.firstName || '' ).trim();
    const last = ( this.contact?.lastName || '' ).trim();
    const initials = `${first.charAt( 0 )}${last.charAt( 0 )}`.toUpperCase();
    if ( initials ) {
      return initials;
    }

    const company = ( this.contact?.company?.name || '' ).trim();
    return company ? company.charAt( 0 ).toUpperCase() : '?';
  }

  get visibleImages () {
    const images = Array.isArray( this.contact?.images ) ? this.contact.images : [];
    return images.filter( img => this.isDisplayableImage( img ) );
  }

  private isDisplayableImage ( img: any ): boolean {
    if ( !img || img._loadError ) return false;

    const src = String( img.src || '' ).trim();
    if ( !src ) return false;

    const normalizedSrc = src.replace( /^\//, '' ).toLowerCase();
    return normalizedSrc !== 'assets/nophoto.svg';
  }

  public onImageError ( img: any ): void {
    if ( img ) {
      img._loadError = true;
    }
  }

  getFormattedDate ( dateValue: any ): string {
    try {
      if ( !dateValue ) return '';

      if (
        typeof dateValue === 'object' &&
        typeof dateValue.toDate === 'function'
      ) {
        return dateValue.toDate().toLocaleString();
      }

      const parsed = new Date( dateValue );
      if ( !isNaN( parsed.getTime() ) ) {
        return parsed.toLocaleString();
      }

      return dateValue;
    } catch ( e ) {
      return '';
    }
  }

  onView ( src: string ): void {
    window.open( src, '_blank' );
  }

  /** Same precedence as read.component.ts's generateLinkPreview: socialMedia's "website" entry wins over company.url. */
  public generateLinkPreview (): void {
    let urlToPreview: string | null = null;

    if ( this.contact?.company?.url ) {
      urlToPreview = this.contact.company.url;
    }

    if ( this.contact?.socialMedia ) {
      const websiteEntry = this.contact.socialMedia.find(
        ( social ) => social.platform === 'website'
      );
      if ( websiteEntry?.url ) {
        urlToPreview = websiteEntry.url;
      }
    }

    if ( urlToPreview ) {
      this.fetchLinkPreviewSubscription = this.linkPreviewService
        .fetchLinkPreview( urlToPreview )
        .subscribe( {
          next: ( data ) => { this.previewData = data; },
          error: () => { /* no preview image is a fine fallback */ },
        } );
    }
  }
}
