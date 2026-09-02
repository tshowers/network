import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, combineLatest } from 'rxjs';
import { environment } from '../../../environments/environment';
import { NetworkAuthService } from '../../services/network-auth.service';
import { NetworkContactStateService } from '../../services/network-contact-state.service';
import { NetworkDataService } from '../../services/network-data.service';
import { NetworkInsightService } from '../../services/network-insight.service';
import { Contact } from '../../models/contact.model';

import { ReadComponent } from '../read/read.component';
import { BackToTopComponent } from '../../shared/back-to-top/back-to-top.component';
import { PreloaderComponent } from '../../shared/preloader/preloader.component';

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
 * original's getDocument/getDocumentRealtime), the contact insight AI
 * call, edit/delete/add-new navigation, and a raw-JSON debug tab (cheap,
 * genuinely useful).
 */
@Component( {
  selector: 'app-view',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReadComponent,
    BackToTopComponent,
    PreloaderComponent,
  ],
  templateUrl: './view.component.html',
  styleUrl: './view.component.css',
} )
export class ViewComponent implements OnInit, OnDestroy {
  contact: Contact | null = null;
  contactId: string | null = null;
  errorMessage: string | null = null;
  isLoading = true;
  contactInsightText: string | null = null;

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
    private insightService: NetworkInsightService,
    private contactState: NetworkContactStateService,
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
  }

  private loadContact (): void {
    if ( !this.contactId || !this.tenantId ) return;

    this.contactSubscription?.unsubscribe();
    this.contactSubscription = this.dataService.getContactRealtime( this.tenantId, this.contactId ).subscribe( {
      next: ( contact ) => {
        this.isLoading = false;
        if ( contact ) {
          this.contact = contact;
          this.loadContactInsight();
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

  private loadContactInsight (): void {
    if ( !this.contact?.company?.name ) return;

    this.insightService.contactInsight( this.contact ).subscribe( {
      next: ( result ) => {
        const insight = result?.response;
        if ( insight?.relationshipBuilder && insight.relationshipBuilder !== 'No insight available' ) {
          this.contactInsightText = `
            <div class="insight-block">
              <p><strong>💡 Relationship Tip:</strong><br>${insight.relationshipBuilder}</p>
              <p><strong>📌 Recommended Action:</strong><br>${insight.recommendedAction}</p>
              <p><strong>✅ Suggested Task:</strong><br>${insight.suggestedTask}</p>
            </div>
          `.trim();
        } else {
          this.contactInsightText = '<p>No insight available.</p>';
        }
      },
      error: () => {
        this.contactInsightText = 'Insight unavailable.';
      },
    } );
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
