/**
 * Signed-out smoke coverage for every route in app.routes.ts. Each test
 * just proves the page actually renders its expected shell/content
 * without crashing - deeper CRUD-style coverage for data-heavy pages
 * (contact-list, pipeline, deal-flow-dashboard, csv-import) lives in
 * routes-signed-in.cy.ts, and the full contact-creation flow is covered
 * in contact-wizard.cy.ts.
 */
describe( 'Network routes - signed out', () => {
  it( 'renders the landing page at /', () => {
    cy.visit( '/' );
    cy.get( '[data-cy="landing-shell"]' ).should( 'be.visible' );
    cy.contains( '.nx-hero__title', 'Never lose the thread.' ).should( 'be.visible' );
  } );

  it( 'renders the iOS showcase at /ios', () => {
    cy.visit( '/ios' );
    cy.get( '[data-cy="app-showcase-shell"]' ).should( 'be.visible' );
    cy.contains( '.fl-hero__headline', 'Relationships in your pocket' ).should( 'be.visible' );
  } );

  it( 'renders the pricing page signed out at /pricing', () => {
    cy.visit( '/pricing' );
    cy.get( '[data-cy="pricing-shell"]' ).should( 'be.visible' );
    cy.contains( '.network-pricing-login-btn', 'Sign in to purchase' ).should( 'be.visible' );
  } );

  it( 'redirects /login to the TODD hosted login page', () => {
    cy.visit( '/login' );
    cy.get( '[data-cy="sign-in-shell"]' ).should( 'exist' );
    cy.location( 'href', { timeout: 10000 } ).should( 'include', 'todd.taliferro.tech/login' );
  } );

  it( 'shows an error on /auth/callback with no token', () => {
    cy.visit( '/auth/callback' );
    cy.get( '[data-cy="auth-callback-shell"]' ).should( 'be.visible' );
    cy.contains( '.alert-danger', /invalid or expired/i ).should( 'be.visible' );
  } );

  it( 'shows an error on /success with no session id', () => {
    cy.visit( '/success' );
    cy.get( '[data-cy="paid-success-shell"]' ).should( 'be.visible' );
    cy.contains( 'h1', 'We could not confirm your subscription' ).should( 'be.visible' );
  } );

  it( 'renders /not-found and the wildcard route the same way', () => {
    cy.visit( '/not-found' );
    cy.get( '[data-cy="not-found-shell"]' ).should( 'be.visible' );
    cy.contains( 'h1', "We couldn't find that." ).should( 'be.visible' );

    cy.visit( '/this-route-does-not-exist' );
    cy.get( '[data-cy="not-found-shell"]' ).should( 'be.visible' );
  } );

  it( 'renders the guest experience at /app', () => {
    cy.visit( '/app' );
    cy.get( '[data-cy="contact-home-shell"]' ).should( 'be.visible' );
    cy.contains( '.diagnosis-board__title', 'Symptom, treatment, relief, and proof' ).should( 'be.visible' );
  } );

  it( 'renders only the browse-mode banner at /contact-list', () => {
    cy.visit( '/contact-list' );
    cy.get( '[data-cy="contact-list-shell"]' ).should( 'be.visible' );
    cy.get( '.browse-mode-banner__title' ).should( 'be.visible' );
    cy.get( '.contact-list-table' ).should( 'not.exist' );
  } );

  it( 'renders only the browse-mode banner at /contact-deal-flow', () => {
    cy.visit( '/contact-deal-flow' );
    cy.get( '[data-cy="pipeline-shell"]' ).should( 'be.visible' );
    cy.get( '.browse-mode-banner__title' ).should( 'be.visible' );
  } );

  it( 'renders the guest progress view at /contact-deal-flow-dashboard', () => {
    cy.visit( '/contact-deal-flow-dashboard' );
    cy.get( '[data-cy="deal-flow-dashboard-shell"]' ).should( 'be.visible' );
    cy.contains( '.browse-mode-banner__title', 'Sign in to see your progress' ).should( 'be.visible' );
  } );

  it( 'renders the upload step signed out at /contact-import', () => {
    cy.visit( '/contact-import' );
    cy.get( '[data-cy="csv-import-shell"]' ).should( 'be.visible' );
    cy.get( '.browse-mode-banner__title' ).should( 'be.visible' );
    cy.contains( '.upload-dropzone__title', 'Drag a CSV here, or choose a file' ).should( 'be.visible' );
  } );
} );
