/**
 * In-app profile page (/profile) - replaces the menu's old link out to
 * TODD's /update-profile. The profile API (GET/PATCH /api/profile,
 * DELETE /api/account) is stubbed; sign-in uses the Firebase emulators.
 */
describe( 'Profile page', () => {
  const profile = {
    email: 'april@example.com',
    firstName: 'April',
    lastName: 'Showers',
    profession: 'Owner',
    companyName: 'Showers Co',
    companyDescription: '',
    jobDescriptionForTODD: 'Help me follow up faster.',
    valueProp: '',
    companyGoal: '',
    timezone: 'America/Los_Angeles',
    phone: '',
  };

  const signIn = ( path: string ) => cy.visitWithFirebaseEmulators( path, {
    email: `network-profile-${Date.now()}@example.com`,
    password: 'CypressTest123!',
  } );

  beforeEach( () => {
    cy.intercept( 'POST', '**/network/entitlement', { statusCode: 200, body: { success: true, hasNetwork: false, effectiveLimit: 0, currentCount: 0 } } );
    cy.intercept( 'GET', '**/network/limits*', { statusCode: 200, body: {} } );
    cy.intercept( 'GET', '**/network/dashboard-counts*', { statusCode: 200, body: {} } );
    cy.intercept( 'GET', '**/api/profile', { statusCode: 200, body: { success: true, profile } } ).as( 'loadProfile' );
  } );

  it( 'loads the profile and saves edits made with one-tap choices', () => {
    cy.intercept( 'PATCH', '**/api/profile', ( req ) => {
      req.reply( { statusCode: 200, body: { success: true, profile: { ...profile, ...req.body.profile } } } );
    } ).as( 'saveProfile' );

    signIn( '/profile' );
    cy.wait( '@loadProfile' ).its( 'request.headers.authorization' ).should( 'match', /^Bearer / );

    // Read mode first: labeled values, no inputs or chips.
    cy.get( '[data-cy="profile-read"]' ).should( 'contain.text', 'April Showers' ).and( 'contain.text', 'Owner' );
    cy.get( '[data-cy="profile-form"]' ).should( 'not.exist' );
    cy.get( '[data-cy="profile-role"]' ).should( 'not.exist' );

    cy.get( '[data-cy="profile-edit"]' ).click();
    cy.get( '[data-cy="profile-first-name"]' ).should( 'have.value', 'April' );
    cy.contains( '[data-cy="profile-role"]', 'Owner' ).should( 'have.class', 'is-selected' );
    cy.get( '[data-cy="profile-save"]' ).should( 'be.disabled' );

    cy.contains( '[data-cy="profile-role"]', 'Sales' ).click();
    cy.contains( '[data-cy="profile-choice-valueProp"]', 'Personal service' ).click();
    cy.get( '[data-cy="profile-text-valueProp"]' ).should( 'have.value', 'Every client gets responsive, personal service from people who know their business.' );
    cy.contains( '[data-cy="profile-choice-companyDescription"]', 'Software' ).click();
    cy.get( '[data-cy="profile-text-companyDescription"]' ).should( 'have.value', 'Showers Co builds software that helps businesses work faster and get more done.' );

    cy.get( '[data-cy="profile-save"]' ).should( 'not.be.disabled' ).click();
    cy.wait( '@saveProfile' ).then( ( { request } ) => {
      expect( request.body.profile ).to.include( {
        profession: 'Sales',
        valueProp: 'Every client gets responsive, personal service from people who know their business.',
        firstName: 'April',
      } );
      expect( request.body.profile ).not.to.have.property( 'email' );
    } );
    // Saving returns to read mode showing the new values.
    cy.get( '[data-cy="profile-form"]' ).should( 'not.exist' );
    cy.get( '[data-cy="profile-read"]' ).should( 'contain.text', 'Sales' );
    cy.contains( '[data-cy="profile-edit"]', 'Saved' );
  } );

  it( 'lets a custom role be typed under Other, and Cancel discards edits', () => {
    signIn( '/profile' );
    cy.wait( '@loadProfile' );
    cy.get( '[data-cy="profile-edit"]' ).click();
    cy.get( '[data-cy="profile-role-other"]' ).click();
    cy.get( 'input[name="profession"]' ).should( 'have.value', '' ).type( 'Broker' );
    cy.get( '[data-cy="profile-save"]' ).should( 'not.be.disabled' );

    cy.get( '[data-cy="profile-cancel"]' ).click();
    cy.get( '[data-cy="profile-read"]' ).should( 'contain.text', 'Owner' ).and( 'not.contain.text', 'Broker' );
  } );

  it( 'deletes the account only after confirming, then signs out', () => {
    cy.intercept( 'DELETE', '**/api/account', { statusCode: 200, body: { success: true, deletedWorkspace: true } } ).as( 'deleteAccount' );

    signIn( '/profile' );
    cy.wait( '@loadProfile' );
    cy.get( '[data-cy="profile-delete"]' ).click();
    cy.get( '[data-cy="profile-delete-confirm"]' ).should( 'be.visible' );
    cy.contains( 'button', 'Cancel' ).click();
    cy.get( '[data-cy="profile-delete-confirm"]' ).should( 'not.exist' );

    cy.get( '[data-cy="profile-delete"]' ).click();
    cy.get( '[data-cy="profile-delete-yes"]' ).click();
    cy.wait( '@deleteAccount' );
    cy.location( 'pathname' ).should( 'eq', '/' );
  } );

  it( 'links Profile in the menu to the in-app page, not TODD', () => {
    signIn( '/app' );
    cy.get( '.platform-menu-trigger, [aria-label*="menu" i]' ).first().click( { force: true } );
    cy.get( '[data-cy="platform-menu-profile"]' ).should( 'have.attr', 'href', '/profile' );
    cy.get( 'a[href*="todd.taliferro.tech/update-profile"]' ).should( 'not.exist' );
  } );

  it( 'asks signed-out visitors to sign in', () => {
    cy.visit( '/profile' );
    cy.get( '[data-cy="profile-signed-out"]' ).should( 'be.visible' );
    cy.get( '[data-cy="profile-sign-in"]' ).click();
    cy.location( 'href', { timeout: 10000 } ).should( 'include', 'todd.taliferro.tech/login' );
  } );
} );
