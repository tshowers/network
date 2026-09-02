import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AfterViewInit, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { NetworkAuthService } from '../../services/network-auth.service';
import { NetworkEntitlementService } from '../../services/network-entitlement.service';
import { AffiliateReferrerService } from '../../services/affiliate-referrer.service';
import { NetworkDataService } from '../../services/network-data.service';
import { NetworkPurchaseFlowService } from '../../services/network-purchase-flow.service';
import { NETWORK_PURCHASE_FLOW } from '../../services/purchase-flow.config';
import { Product } from '../../models/product.model';
import { ClickSoundDirective } from '../../shared/directives/click-sound.directive';

const DEFAULT_PRICE = '$23/month';
const DEFAULT_HIGHLIGHTS = [
  'Save and manage more contacts beyond the free limit.',
  'Keep people, firms, and pipeline activity connected.',
  'Use Network as the relationship layer behind your work.'
];
const DEFAULT_NOTES = [
  'Free access includes a small working set of contacts.',
  'The paid plan unlocks more room to save and manage relationships.',
  'Enterprise customers can use the shared TODD pricing page for multi-user deployment.'
];

/**
 * Ported from features/contact/network-pricing/network-pricing.component.ts.
 * Drops the ToddAssistantBusService signal-state indicator (decorative LED
 * tied to the full TODD assistant, which this app deliberately doesn't
 * carry - see the assistant-box scoping decision) and swaps
 * AffiliateTrackingService for the minimal AffiliateReferrerService stub.
 * Everything else - the checkout flow itself - is unchanged.
 */
@Component( {
  selector: 'app-pricing',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ClickSoundDirective],
  templateUrl: './pricing.component.html',
  styleUrl: './pricing.component.css'
} )
export class PricingComponent implements OnInit, OnDestroy, AfterViewInit {
  readonly entitlements$ = inject( NetworkEntitlementService ).getEntitlements();
  private readonly purchaseFlowConfig = NETWORK_PURCHASE_FLOW;
  private authService = inject( NetworkAuthService );
  private router = inject( Router );
  private dataService = inject( NetworkDataService );

  tenantIdSubscription!: Subscription;
  userSubscription!: Subscription;

  private tenantProduct: Product | null = null;

  email = '';
  tenantId = '';
  isStartingCheckout = false;
  checkoutError = '';
  requiresLogin = false;

  get monthlyPrice (): string {
    return this.tenantProduct?.priceLabel || DEFAULT_PRICE;
  }

  get highlights (): string[] {
    const d = this.tenantProduct?.shortDescription;
    return d ? [d] : DEFAULT_HIGHLIGHTS;
  }

  get notes (): string[] {
    const d = this.tenantProduct?.description;
    return d ? [d] : DEFAULT_NOTES;
  }

  constructor (
    private affiliateReferrerService: AffiliateReferrerService,
    private purchaseFlowService: NetworkPurchaseFlowService
  ) { }

  ngOnInit (): void {
    this.userSubscription = this.authService.getUser().subscribe( firebaseUser => {
      this.email = firebaseUser?.email || '';
      this.requiresLogin = !firebaseUser;
    } );

    this.tenantIdSubscription = this.authService.getTenantId().subscribe( async tenantId => {
      this.tenantId = tenantId || '';
      if ( this.tenantId ) {
        await this.loadTenantProduct( 'network' );
      }
    } );
  }

  ngOnDestroy (): void {
    if ( this.userSubscription ) this.userSubscription.unsubscribe();
    if ( this.tenantIdSubscription ) this.tenantIdSubscription.unsubscribe();
  }

  ngAfterViewInit (): void {
    window.scrollTo( 0, 0 );
  }

  goToLogin (): void {
    void this.purchaseFlowService.goToLogin( this.router, this.purchaseFlowConfig );
  }

  private async loadTenantProduct ( productName: string ): Promise<void> {
    try {
      const contact = await this.dataService.getContact( this.tenantId, this.tenantId );
      const products: Product[] = ( contact as any )?.company?.products || [];
      this.tenantProduct = products.find(
        p => p.active !== false && p.discontinued !== true &&
             p.name?.toLowerCase().includes( productName )
      ) || null;
    } catch {
      this.tenantProduct = null;
    }
  }

  async startCheckout (): Promise<void> {
    this.checkoutError = '';
    this.requiresLogin = !this.email;

    if ( this.requiresLogin ) {
      this.checkoutError = 'Please sign in before purchasing Network access.';
      return;
    }

    const tenantId = this.tenantId.trim();
    const email = this.email.trim().toLowerCase();

    if ( !tenantId ) {
      this.checkoutError = 'We could not find you. Please sign in again and try once more.';
      return;
    }

    if ( !email ) {
      this.checkoutError = 'Email is required before checkout.';
      return;
    }

    this.isStartingCheckout = true;

    try {
      const checkoutUrl = await this.purchaseFlowService.startCheckout(
        this.purchaseFlowConfig,
        {
          tenantId,
          email,
          priceId: this.tenantProduct?.stripePriceIdMonthly || '',
          referrerUid: this.affiliateReferrerService.getReferrerUid() || ''
        },
        'Unable to start Network checkout.'
      );

      this.purchaseFlowService.redirectToCheckout( checkoutUrl );
    } catch ( error: any ) {
      this.checkoutError = error?.message || 'Unable to start Network checkout.';
      this.isStartingCheckout = false;
    }
  }
}
