import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IMPORT_SOURCES, ImportSource, openImportSource } from '../../models/import-sources';
import { NetworkContactStateService } from '../../services/network-contact-state.service';
import { NetworkOnboardingService } from '../../services/network-onboarding.service';
import { NetworkPurchaseFlowService } from '../../services/network-purchase-flow.service';
import { NETWORK_PURCHASE_FLOW } from '../../services/purchase-flow.config';
import { ClickSoundDirective } from '../../shared/directives/click-sound.directive';

/**
 * Lands here from Stripe checkout: confirms the session, then asks the
 * one question that matters next - where are your contacts?
 * (design_handoff_network_onboarding 01).
 */
@Component( {
  selector: 'app-paid-success',
  standalone: true,
  imports: [CommonModule, ClickSoundDirective],
  templateUrl: './paid-success.component.html',
  styleUrl: './paid-success.component.css'
} )
export class PaidSuccessComponent implements OnInit {
  private readonly purchaseFlowConfig = NETWORK_PURCHASE_FLOW;
  private route = inject( ActivatedRoute );
  private router = inject( Router );
  private contactState = inject( NetworkContactStateService );
  private onboarding = inject( NetworkOnboardingService );

  readonly sources = IMPORT_SOURCES;
  isConfirming = true;
  isSuccess = false;
  errorMessage = '';
  firstName = '';

  constructor ( private purchaseFlowService: NetworkPurchaseFlowService ) { }

  async ngOnInit (): Promise<void> {
    const sessionId = ( this.route.snapshot.queryParamMap.get( 'session_id' ) || '' ).trim();

    if ( !sessionId ) {
      this.isConfirming = false;
      this.errorMessage = 'Missing session information. Please try again.';
      return;
    }

    try {
      await this.purchaseFlowService.confirmCheckout( this.purchaseFlowConfig, sessionId );
      this.isSuccess = true;
      this.firstName = ( await this.onboarding.refresh() )?.firstName || '';
    } catch ( err: any ) {
      this.errorMessage = err?.message || 'Something went wrong confirming your purchase.';
    } finally {
      this.isConfirming = false;
    }
  }

  pick ( source: ImportSource ): void {
    openImportSource( source, this.router, this.contactState );
  }

  goToNetwork (): void {
    void this.router.navigate( [this.purchaseFlowConfig.postConfirmRoute] );
  }
}
