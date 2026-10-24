/**
 * Trimmed from services/purchase-flow.config.ts - only the Network entry,
 * and loginReturnUrl points at this app's own pages rather than TODD's
 * '/network' sub-route, since this app IS Network, not a page inside a
 * larger app. postConfirmRoute is Home: the paid-success page asks for
 * contacts first, and "I'll do this later" goes there.
 */
export interface ProductPurchaseFlowConfig {
  productKey: 'network';
  loginReturnUrl: string;
  checkoutEndpoint: string;
  confirmEndpoint: string;
  successRoute: string;
  postConfirmRoute: string;
  checkoutUrlField?: string;
  checkoutCredentials?: RequestCredentials;
  confirmCredentials?: RequestCredentials;
  legacyAccessStorageKey?: string;
}

export const NETWORK_PURCHASE_FLOW: ProductPurchaseFlowConfig = {
  productKey: 'network',
  loginReturnUrl: '/pricing',
  checkoutEndpoint: '/network/checkout',
  confirmEndpoint: '/network/checkout/confirm',
  successRoute: '/success',
  postConfirmRoute: '/app',
};
