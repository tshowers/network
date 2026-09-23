/**
 * Signed-in coverage for the routes that behave meaningfully differently
 * once a user is logged in (or otherwise weren't covered by
 * routes-public.cy.ts). Uses the same Firebase emulator sign-in as
 * contact-wizard.cy.ts, plus cy.seedContact to write data straight to the
 * Firestore emulator so pages that read tenants/{uid}/contacts have
 * something to render without re-driving the wizard every time.
 */
describe( 'Network routes - signed in', () => {
  const stubEntitlement = () => {
    cy.intercept( 'POST', '**/network/entitlement', {
      statusCode: 200,
      body: { success: true, hasNetwork: false, effectiveLimit: 0, currentCount: 0 },
    } ).as( 'entitlement' );
  };

  it( 'redirects / to /app once signed in', () => {
    stubEntitlement();
    cy.intercept( 'GET', '**/network/limits*', { statusCode: 200, body: {} } );
    cy.intercept( 'GET', '**/network/dashboard-counts*', { statusCode: 200, body: {} } );

    cy.visitWithFirebaseEmulators( '/', {
      email: `network-root-redirect-${Date.now()}@example.com`,
      password: 'CypressTest123!',
    } );

    cy.location( 'pathname', { timeout: 15000 } ).should( 'eq', '/app' );
    cy.get( '[data-cy="contact-home-shell"]' ).should( 'be.visible' );
  } );

  it( 'renders the signed-in cockpit at /app', () => {
    stubEntitlement();
    cy.intercept( 'GET', '**/network/limits*', { statusCode: 200, body: {} } );
    cy.intercept( 'GET', '**/network/dashboard-counts*', { statusCode: 200, body: {} } );

    cy.visitWithFirebaseEmulators( '/app', {
      email: `network-app-${Date.now()}@example.com`,
      password: 'CypressTest123!',
    } );

    cy.get( '[data-cy="contact-home-shell"]' ).should( 'be.visible' );
    cy.contains( '.diagnosis-board__title', 'Symptom, treatment, relief, and proof' ).should( 'be.visible' );
  } );

  it( 'lists a seeded contact at /contact-list', () => {
    stubEntitlement();
    const credentials = { email: `network-list-${Date.now()}@example.com`, password: 'CypressTest123!' };

    cy.emulatorSignUp( credentials ).then( ( account ) => {
      cy.seedContact( account, 'seed-list-1', { firstName: 'Priya', lastName: 'Nair', status: 'Lead Generation' } );
      cy.visitWithFirebaseEmulators( '/contact-list', credentials );
    } );

    cy.get( '[data-cy="contact-list-shell"]' ).should( 'be.visible' );
    cy.contains( '.contact-list-name', 'Priya Nair' ).should( 'be.visible' );
  } );

  it( 'shows a seeded contact on the /contact-deal-flow board', () => {
    stubEntitlement();
    const credentials = { email: `network-pipeline-${Date.now()}@example.com`, password: 'CypressTest123!' };

    cy.emulatorSignUp( credentials ).then( ( account ) => {
      cy.seedContact( account, 'seed-pipeline-1', { firstName: 'Marcus', lastName: 'Webb', status: 'Lead Generation' } );
      cy.visitWithFirebaseEmulators( '/contact-deal-flow', credentials );
    } );

    cy.get( '[data-cy="pipeline-shell"]' ).should( 'be.visible' );
    cy.contains( '.pipeline-column__title', 'Lead Generation' ).should( 'be.visible' );
    cy.contains( '.pipeline-card__name', 'Marcus Webb' ).should( 'be.visible' );
  } );

  it( 'counts a seeded contact at /contact-deal-flow-dashboard', () => {
    stubEntitlement();
    cy.intercept( 'GET', '**/momentum/engine-state*', { statusCode: 200, body: {} } );
    cy.intercept( 'GET', '**/momentum/activity*', { statusCode: 200, body: {} } );
    cy.intercept( 'GET', '**/outreach/momentum/today-summary*', { statusCode: 200, body: {} } );
    cy.intercept( 'GET', '**/anonymous-behavior/summary*', { statusCode: 200, body: {} } );

    const credentials = { email: `network-dashboard-${Date.now()}@example.com`, password: 'CypressTest123!' };

    cy.emulatorSignUp( credentials ).then( ( account ) => {
      cy.seedContact( account, 'seed-dashboard-1', { firstName: 'Sarah', lastName: 'Chen', status: 'Lead Generation' } );
      cy.visitWithFirebaseEmulators( '/contact-deal-flow-dashboard', credentials );
    } );

    cy.get( '[data-cy="deal-flow-dashboard-shell"]' ).should( 'be.visible' );
    cy.contains( 'h1', 'Networking Progress' ).should( 'be.visible' );
    cy.contains( '1 of 1 contacts have a mapped status' ).should( 'be.visible' );
  } );

  it( 'imports the sample CSV end to end at /contact-import', () => {
    stubEntitlement();

    cy.visitWithFirebaseEmulators( '/contact-import', {
      email: `network-import-${Date.now()}@example.com`,
      password: 'CypressTest123!',
    } );

    cy.get( '[data-cy="csv-import-shell"]' ).should( 'be.visible' );
    cy.contains( 'button', 'Or try it with sample data' ).click();

    // Step 2: Field Match auto-maps the sample file's headers - just confirm.
    cy.contains( '.field-mapping-toolbar__actions button', 'Next' ).click();

    // Step 3: Review the mapped rows.
    cy.contains( '.import-step-actions button', 'Continue' ).click();

    // Step 4: Confirm + import. Target the button's unique class rather than
    // its exact label text (getImportButtonLabel()'s "Import" is whitespace-
    // padded by the template interpolation, which made an exact-text regex
    // match unreliable).
    cy.get( '.import-step-actions .btn-todd--primary' ).should( 'contain.text', 'Import' ).click();

    cy.contains( '.result-summary h5', 'Import complete', { timeout: 15000 } ).should( 'be.visible' );
  } );

  it( 'confirms a checkout session at /success', () => {
    // PaidSuccessComponent doesn't check auth state at all - branches
    // purely on the session_id query param - so no emulator sign-in needed.
    cy.intercept( 'POST', '**/network/checkout/confirm', {
      statusCode: 200,
      body: { success: true },
    } ).as( 'confirmCheckout' );

    cy.visit( '/success?session_id=test-session-123' );

    cy.wait( '@confirmCheckout' );
    cy.get( '[data-cy="paid-success-shell"]' ).should( 'be.visible' );
    cy.contains( 'h1', 'Network access is now active' ).should( 'be.visible' );
  } );
} );
