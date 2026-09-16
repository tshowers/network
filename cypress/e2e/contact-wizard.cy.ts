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

  it( 'walks through every step of the wizard and creates a contact', () => {
    stubEntitlement();

    cy.visitWithFirebaseEmulators( '/contact-edit', {
      email: `network-wizard-${Date.now()}@example.com`,
      password: 'CypressTest123!',
    } );

    cy.get( '[data-cy="contact-edit-shell"]', { timeout: 15000 } ).should( 'be.visible' );

    // Step 1: First Name (required) - the step that reported nothing
    // happening when Next was clicked. cy.click() does real hit-testing
    // (unlike a raw DOM .click()), so a covering element regression like
    // the assistant launcher's hotzone div fails this the same way it
    // failed for a real user, instead of silently passing.
    cy.get( '[name="firstName"]' ).should( 'be.visible' ).type( 'Network' );
    cy.get( '[data-cy="contact-wizard-next"]' ).click();

    // Step 2: Middle Name (optional) - confirms the step actually advanced.
    cy.get( '[name="middleName"]' ).should( 'be.visible' );
    cy.get( '[data-cy="contact-wizard-next"]' ).click();

    // Step 3: Last Name (required)
    cy.get( '[name="lastName"]' ).should( 'be.visible' ).type( 'Emulator' );
    cy.get( '[data-cy="contact-wizard-next"]' ).click();

    // Step 4: Company
    cy.get( '[name="companyName"]' ).should( 'be.visible' ).type( 'Acme Testing Co' );
    cy.get( '[data-cy="contact-wizard-next"]' ).click();

    // Steps 5-12: Category, Status, Profession, Email, Phone, Address,
    // Nickname, Birthday - none of these gate advancement, so this just
    // proves every remaining Next button is actually reachable and
    // clickable, all the way to the last step.
    for ( let step = 0; step < 8; step++ ) {
      cy.get( '[data-cy="contact-wizard-next"]' ).click();
    }

    // Step 13: Gender - final step, submit.
    cy.get( '[data-cy="contact-wizard-submit"]' ).click();

    cy.location( 'pathname', { timeout: 15000 } ).should( 'match', /^\/contact\// );
    cy.get( '[data-cy="contact-view-shell"]', { timeout: 15000 } ).should( 'be.visible' );
    cy.contains( 'Network' ).should( 'exist' );
    cy.contains( 'Emulator' ).should( 'exist' );
  } );

  it( 'keeps Next disabled on the First Name step until a name is entered', () => {
    stubEntitlement();

    cy.visitWithFirebaseEmulators( '/contact-edit', {
      email: `network-wizard-empty-${Date.now()}@example.com`,
      password: 'CypressTest123!',
    } );

    cy.get( '[data-cy="contact-edit-shell"]', { timeout: 15000 } ).should( 'be.visible' );
    cy.get( '[data-cy="contact-wizard-next"]' ).should( 'be.disabled' );
    cy.get( '[name="firstName"]' ).type( 'Booker' );
    cy.get( '[data-cy="contact-wizard-next"]' ).should( 'not.be.disabled' ).click();
    cy.get( '[name="middleName"]' ).should( 'be.visible' );
  } );
} );
