import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NetworkPurchaseFlowService } from '../../services/network-purchase-flow.service';
import { NETWORK_PURCHASE_FLOW } from '../../services/purchase-flow.config';
import { ClickSoundDirective } from '../../shared/directives/click-sound.directive';

/** Ported from features/contact/network-paid-success/network-paid-success.component.ts. */
@Component( {
  selector: 'app-paid-success',
  standalone: true,
  imports: [CommonModule, RouterLink, ClickSoundDirective],
  templateUrl: './paid-success.component.html',
  styleUrl: './paid-success.component.css'
} )
export class PaidSuccessComponent implements OnInit {
  private readonly purchaseFlowConfig = NETWORK_PURCHASE_FLOW;
  private route = inject( ActivatedRoute );
  private router = inject( Router );

  isConfirming = true;
  isSuccess = false;
  errorMessage = '';

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
    } catch ( err: any ) {
      this.errorMessage = err?.message || 'Something went wrong confirming your purchase.';
    } finally {
      this.isConfirming = false;
    }
  }

  goToNetwork (): void {
    void this.router.navigate( [this.purchaseFlowConfig.postConfirmRoute] );
  }
}
