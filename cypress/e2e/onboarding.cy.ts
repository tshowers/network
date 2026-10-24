/**
 * First-session onboarding (design_handoff_network_onboarding): the
 * first-run Home, the header's Setup pill and checklist, and the profile
 * question card. GET/PATCH /api/network/onboarding and /api/profile are
 * stubbed; sign-in uses the Firebase emulators.
 */
describe( 'Onboarding', () => {
  const step = ( id: string, title: string, extra: Record<string, unknown> = {} ) => ( {
    id, title, kicker: 'You', detail: '', done: false, available: true, automatic: false, ...extra,
  } );

  const onboarding = ( overrides: Record<string, unknown> = {} ) => ( {
    steps: [
      step( 'contacts', 'Bring in your contacts', { detail: 'HubSpot, Outlook, Google or a CSV' } ),
      step( 'cleanup', 'TODD checks and fills them in', { kicker: 'Automatic', automatic: true, available: false, detail: 'Starts as soon as contacts land' } ),
      step( 'profile', 'Tell TODD about your business', { kicker: 'You · 1 minute', detail: 'TODD knows 5 of 8. Used to write your emails' } ),
      step( 'review', 'Look at what TODD flagged', { available: false } ),
      step( 'reachOut', 'Start reaching out', { available: false, detail: 'Email them with Outreach' } ),
    ],
    completedSteps: 0,
    totalSteps: 5,
    allDone: false,
    firstName: 'Ada',
    profileCompletion: { percent: 63, completed: 5, total: 8, missing: [] },
    aiProfile: { answered: 1, total: 4 },
    counts: { imported: 0, emails: 0, checked: 0, fixed: 0, enriched: 0, flagged: 0, reachedOut: 0 },
    state: { weeklyDigest: false, outreachOpenedAt: null, neverOpenedBannerDismissedAt: null },
    ...overrides,
  } );

  const profile = {
    email: 'ada@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    profession: 'Owner',
    companyName: 'Analytical Co',
    companyDescription: '',
    jobDescriptionForTODD: 'Help me follow up faster.',
    valueProp: '',
    companyGoal: '',
    timezone: 'America/Chicago',
    phone: '',
  };

  const signIn = ( path: string ) => cy.visitWithFirebaseEmulators( path, {
    email: `network-onboarding-${Date.now()}@example.com`,
    password: 'CypressTest123!',
  } );

  beforeEach( () => {
    cy.intercept( 'POST', '**/network/entitlement', { statusCode: 200, body: { success: true, hasNetwork: false, effectiveLimit: 0, currentCount: 0 } } );
    cy.intercept( 'GET', '**/network/limits*', { statusCode: 200, body: {} } );
    cy.intercept( 'GET', '**/network/dashboard-counts*', { statusCode: 200, body: {} } );
  } );

  it( 'walks a brand-new user through Home with the import panel', () => {
    cy.intercept( 'GET', '**/network/onboarding', { statusCode: 200, body: { data: onboarding() } } ).as( 'onboarding' );
    signIn( '/app' );

    cy.contains( '[data-cy="home-setup"] h1', 'Welcome, Ada. Let’s get your contacts in.' ).should( 'be.visible' );
    cy.get( '[data-cy="home-setup-step"]' ).should( 'have.length', 4 );
    // Step 1 is current; the import panel is its action, not a card button.
    cy.get( '[data-cy="home-setup-step"]' ).first().should( 'have.class', 'is-current' ).find( '.rel-step__action' ).should( 'not.exist' );
    cy.get( '[data-cy="home-import"]' ).should( 'contain.text', 'CSV file' ).and( 'contain.text', 'Add one by hand' );
    cy.get( '.rel-health' ).should( 'not.exist' );
    cy.screenshot( 'onboarding/home-first-run', { capture: 'viewport' } );

    cy.get( '[data-cy="home-sample"]' ).click();
    cy.location( 'pathname' ).should( 'eq', '/contact-import' );
    cy.contains( '[data-cy="ci-preview"] h2', '12 contacts found' ).should( 'be.visible' );
    cy.screenshot( 'onboarding/import-preview', { capture: 'viewport' } );
  } );

  it( 'opens the setup checklist from the header pill', () => {
    const imported = onboarding( {
      completedSteps: 2,
      counts: { imported: 12, emails: 12, checked: 12, fixed: 2, enriched: 5, flagged: 3, reachedOut: 0 },
      steps: [
        step( 'contacts', 'Bring in your contacts', { done: true, detail: '12 contacts imported' } ),
        step( 'cleanup', 'TODD checks and fills them in', { kicker: 'Automatic', automatic: true, done: true, detail: 'Done. 2 fixed, 5 filled in' } ),
        step( 'profile', 'Tell TODD about your business', { detail: 'TODD knows 5 of 8. Used to write your emails' } ),
        step( 'review', 'Look at the 3 TODD flagged' ),
        step( 'reachOut', 'Start reaching out', { detail: 'Email them with Outreach' } ),
      ],
    } );
    cy.intercept( 'GET', '**/network/onboarding', { statusCode: 200, body: { data: imported } } );
    signIn( '/app' );

    cy.contains( '[data-cy="home-setup"] h1', 'Your list is clean. Time to reach out.' ).should( 'be.visible' );
    cy.get( '[data-cy="home-import"]' ).should( 'not.exist' );
    cy.contains( '[data-cy="setup-pill"]', 'Setup · 2 of 5' ).click();
    cy.get( '[data-cy="setup-checklist"]' ).should( 'contain.text', 'Get Network working' );
    cy.get( '[data-cy="setup-step"]' ).eq( 2 ).find( '.sc-mark' ).should( 'have.class', 'is-current' );
    cy.get( '[data-cy="setup-step"]' ).eq( 1 ).find( '.sc-action' ).should( 'not.exist' );
    cy.get( '[data-cy="setup-step"]' ).eq( 3 ).should( 'contain.text', 'Review' );
    cy.screenshot( 'onboarding/setup-checklist', { capture: 'viewport' } );

    cy.contains( '[data-cy="setup-step"] .sc-action', 'Answer' ).click();
    cy.location( 'pathname' ).should( 'eq', '/profile' );
    cy.get( '[data-cy="setup-checklist"]' ).should( 'not.exist' );
  } );

  it( 'hides the Setup pill once every step is done', () => {
    cy.intercept( 'GET', '**/network/onboarding', { statusCode: 200, body: { data: onboarding( { allDone: true, completedSteps: 5, counts: { imported: 3 } } ) } } );
    signIn( '/app' );

    cy.get( '[data-cy="contact-home-shell"]' ).should( 'be.visible' );
    cy.get( '.rel-health' ).should( 'be.visible' );
    cy.get( '[data-cy="setup-pill"]' ).should( 'not.exist' );
    cy.get( '[data-cy="home-setup"]' ).should( 'not.exist' );
  } );

  it( 'answers profile questions one at a time from the profile page', () => {
    cy.intercept( 'GET', '**/network/onboarding', { statusCode: 200, body: { data: onboarding() } } );
    cy.intercept( 'GET', '**/api/profile', { statusCode: 200, body: { success: true, profile } } ).as( 'loadProfile' );
    cy.intercept( 'PATCH', '**/api/profile', ( req ) => {
      req.reply( { statusCode: 200, body: { success: true, profile: { ...profile, ...req.body.profile } } } );
    } ).as( 'saveProfile' );
    signIn( '/profile' );
    cy.wait( '@loadProfile' );

    cy.get( '[data-cy="profile-question-card"]' ).should( 'contain.text', 'TODD knows 5 of 8' )
      .and( 'contain.text', 'What does your company do?' );
    cy.screenshot( 'onboarding/profile', { capture: 'viewport' } );

    // "Answer" on an empty field loads that question.
    cy.get( '[data-cy="profile-answer-companyGoal"]' ).click();
    cy.contains( '[data-cy="profile-question-card"] h3', "What is your company's mission?" );
    cy.get( '[data-cy="pq-save"]' ).should( 'be.disabled' );
    cy.contains( '[data-cy="pq-choice"]', 'Make it simple' ).click();
    cy.get( '[data-cy="pq-save"]' ).should( 'contain.text', 'Save and next' ).click();
    cy.wait( '@saveProfile' ).its( 'request.body.profile.companyGoal' ).should( 'eq', 'To make complicated things simple for the people we serve.' );
    cy.get( '[data-cy="profile-read"]' ).should( 'exist' );
    cy.contains( 'dd', 'To make complicated things simple' ).should( 'be.visible' );
    cy.get( '[data-cy="profile-question-card"]' ).should( 'contain.text', 'TODD knows 6 of 8' );

    // "Later" skips without saving.
    cy.contains( '[data-cy="profile-question-card"] h3', 'What does your company do?' );
    cy.get( '[data-cy="pq-later"]' ).click();
    cy.contains( '[data-cy="profile-question-card"] h3', "What's your value proposition?" );
  } );

  it( 'shows the Contacts empty state for a user with no contacts', () => {
    cy.intercept( 'GET', '**/network/onboarding', { statusCode: 200, body: { data: onboarding() } } );
    signIn( '/contact-list' );

    cy.get( '[data-cy="contacts-empty"]' ).should( 'contain.text', 'Your contacts will live here' )
      .and( 'contain.text', 'Import contacts' ).and( 'contain.text', 'Add one by hand' );
  } );
} );
