import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, combineLatest } from 'rxjs';
import { environment } from '../../../environments/environment';
import { NetworkAuthService } from '../../services/network-auth.service';
import { NetworkContactStateService } from '../../services/network-contact-state.service';
import { NetworkDataService } from '../../services/network-data.service';
import { NetworkAssistantSignalService } from '../../services/network-assistant-signal.service';
import { buildContactPageContext } from '../../services/contact-page-context';
import { Contact } from '../../models/contact.model';

import { ReadComponent } from '../read/read.component';
import { BackToTopComponent } from '../../shared/back-to-top/back-to-top.component';
import { PreloaderComponent } from '../../shared/preloader/preloader.component';
import { WriteActionDirective } from '../../shared/write-access/write-action.directive';
import { BrowseNoticeComponent } from '../../shared/write-access/browse-notice.component';

/**
 * Ported from features/contact/view/view.component.ts (1,260 lines),
 * trimmed dramatically. Over half the original - everything from
 * `get momentumThread()` through `letToddDraftAgainFromContactView()`
 * (~560 lines) - is Outreach's Signal Engine reply-drafting UI (analyze a
 * pasted reply, pick a playbook, edit/send an AI-drafted response)
 * embedded directly into the contact page. That's cross-module automation
 * living on Network's page, exactly the kind of thing already dropped
 * from ReadComponent (LinkedIn AI import, auto-archive) and contact-home
 * (assistant bus, page actions) - not core to "view a contact."
 *
 * Also deferred: public-profile mode (/p/:id, /u/:handle - a real,
 * separate feature, not skipped for lack of value, just not core viewing)
 * and the decorative ToddTip banner (TipService is 422 lines of rotating
 * copy for one sentence of UI).
 *
 * Kept: load the contact (live, via getContactRealtime - matches the
 * original's getDocument/getDocumentRealtime), edit/delete/add-new
 * navigation, and a raw-JSON debug tab (cheap,
 * genuinely useful).
 */
@Component( {
  selector: 'app-view',
  standalone: true,
  imports: [BrowseNoticeComponent, WriteActionDirective, 
    CommonModule,
    FormsModule,
    ReadComponent,
    BackToTopComponent,
    PreloaderComponent, RouterLink],
  templateUrl: './view.component.html',
  styleUrl: './view.component.css',
} )
export class ViewComponent implements OnInit, OnDestroy {
  activeTab: 'read' | 'json' = 'read';

  contact: Contact | null = null;
  contactId: string | null = null;
  errorMessage: string | null = null;
  isLoading = true;

  userId?: string;
  tenantId = '';

  private tenantId$?: Subscription;
  private contactSubscription?: Subscription;

  constructor (
    private route: ActivatedRoute,
    private router: Router,
    private titleService: Title,
    private authService: NetworkAuthService,
    private dataService: NetworkDataService,
    private contactState: NetworkContactStateService,
    private assistantBus: NetworkAssistantSignalService,
  ) { }

  ngOnInit (): void {
    this.titleService.setTitle( `${environment.COMPANY_NAME} - Contact` );
    this.contactId = this.route.snapshot.paramMap.get( 'id' );

    if ( !this.contactId ) {
      this.errorMessage = 'No contact ID provided.';
      this.isLoading = false;
      return;
    }

    this.tenantId$ = combineLatest( [this.authService.getUserId(), this.authService.getTenantId()] )
      .subscribe( ( [userId, tenantId] ) => {
        this.userId = userId || undefined;
        if ( tenantId && tenantId !== this.tenantId ) {
          this.tenantId = tenantId;
          this.loadContact();
        }
      } );
  }

  ngOnDestroy (): void {
    this.tenantId$?.unsubscribe();
    this.contactSubscription?.unsubscribe();
    this.assistantBus.clearPageContext();
  }

  private loadContact (): void {
    if ( !this.contactId || !this.tenantId ) return;

    this.contactSubscription?.unsubscribe();
    this.contactSubscription = this.dataService.getContactRealtime( this.tenantId, this.contactId ).subscribe( {
      next: ( contact ) => {
        this.isLoading = false;
        if ( contact ) {
          this.contact = contact;
          this.publishPageContext( contact );
        } else {
          this.router.navigate( ['/not-found'] );
        }
      },
      error: () => {
        this.isLoading = false;
        this.errorMessage = 'Error fetching contact data.';
      },
    } );
  }

  /** Tells TODD which contact is open, so questions here are answered from this record. */
  private publishPageContext ( contact: Contact ): void {
    this.assistantBus.setPageContext( buildContactPageContext( contact, this.contactId || '', {
      page: 'contact-view',
      route: this.router.url,
      mode: 'view',
      description: 'A single contact record. Questions on this page are about this contact unless another person is named.',
    } ) );
  }

  navigateToEditContact (): void {
    if ( !this.contact ) return;
    this.contactState.setContact( this.contact );
    this.router.navigate( ['/contact-edit'], {
      queryParams: this.contact.id ? { id: this.contact.id } : undefined,
    } );
  }

  navigateToNewContact (): void {
    this.contactState.resetContact();
    this.router.navigate( ['/contact-edit'] );
  }

  async onDelete (): Promise<void> {
    if ( !this.contact?.id ) return;

    const confirmation = confirm( 'Are you sure you want to delete this contact?' );
    if ( !confirmation ) return;

    try {
      await this.dataService.deleteContact( this.tenantId, this.contact.id );
      this.router.navigate( ['/contact-list'] );
    } catch ( error ) {
      this.errorMessage = 'Error deleting contact.';
    }
  }
}
