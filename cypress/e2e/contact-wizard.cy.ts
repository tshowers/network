describe( 'Network contact creation wizard', () => {
  // NetworkContactAccessService.fetchEntitlement hits the real backend for
  // free/paid tier status - stub it so the suite doesn't depend on a live
  // network call, and gets a deterministic free-tier response either way.
  const stubEntitlement = () => {
    cy.intercept( 'POST', '**/network/entitlement', {
      statusCode: 200,
      body: { success: true, hasNetwork: false, effectiveLimit: 0, currentCount: 0 },
    } ).as( 'entitlement' );
  };

  it( 'fills the five sections and creates a contact', () => {
    stubEntitlement();

    cy.visitWithFirebaseEmulators( '/contact-edit', {
      email: `network-wizard-${Date.now()}@example.com`,
      password: 'CypressTest123!',
    } );

    cy.get( '[data-cy="contact-edit-shell"]', { timeout: 15000 } ).should( 'be.visible' );

    // Section 1: Name. cy.click() does real hit-testing, so a covering
    // element (the assistant launcher's hotzone, once) fails here too.
    cy.get( '[name="firstName"]' ).should( 'be.visible' ).type( 'Network' );
    cy.get( '[name="lastName"]' ).type( 'Emulator' );
    cy.get( '[data-cy="contact-wizard-next"]' ).click();

    // Section 2: Company. Next walks the remaining sections.
    cy.get( '[name="companyName"]' ).should( 'be.visible' ).type( 'Acme Testing Co' );
    for ( let section = 0; section < 3; section++ ) {
      cy.get( '[data-cy="contact-wizard-next"]' ).click();
    }

    cy.get( '[data-cy="contact-wizard-submit"]' ).click();

    cy.location( 'pathname', { timeout: 15000 } ).should( 'match', /^\/contact\// );
    cy.get( '[data-cy="contact-view-shell"]', { timeout: 15000 } ).should( 'be.visible' );
    cy.contains( 'Network' ).should( 'exist' );
    cy.contains( 'Emulator' ).should( 'exist' );
  } );

  it( 'blocks Save until a first name is entered', () => {
    stubEntitlement();

    cy.visitWithFirebaseEmulators( '/contact-edit', {
      email: `network-wizard-empty-${Date.now()}@example.com`,
      password: 'CypressTest123!',
    } );

    cy.get( '[data-cy="contact-edit-shell"]', { timeout: 15000 } ).should( 'be.visible' );
    cy.get( '[data-cy="contact-wizard-submit"]' ).should( 'have.attr', 'aria-disabled', 'true' ).click();
    cy.contains( '.ce-error', 'First name is required' ).should( 'be.visible' );
    cy.get( '[name="firstName"]' ).type( 'Booker' );
    cy.get( '[data-cy="contact-wizard-submit"]' ).should( 'have.attr', 'aria-disabled', 'false' );
    cy.get( '.ce-error' ).should( 'not.exist' );
  } );
} );
