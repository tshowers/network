/**
 * Import → live cleanup → Ready (design_handoff_network_onboarding 03–05).
 * /api/network/imports and /api/network/onboarding are stubbed; contacts
 * are written to the Firestore emulator.
 */
describe( 'Import cleanup', () => {
  const row = ( id: string, name: string, status: string, extra: Record<string, unknown> = {} ) => ( {
    id, name, title: '', email: `${id}@brightlane.example`, company: 'Brightlane', status, note: '', flagReason: null, resolution: null, ...extra,
  } );

  const state = ( status: string, processed: number, rows: unknown[], fixLog: unknown[] = [], counts: Record<string, number> = {} ) => ( {
    batch: { id: 'b-1', source: 'csv', status, total: 3, dailyLimit: 25,
      counts: { processed, checked: processed, fixed: 0, enriched: 0, flagged: 0, deferred: 0, ...counts } },
    contacts: rows,
    fixLog,
  } );

  const running = state( 'running', 1, [
    row( 'c-1', 'Sarah Chen', 'verified' ),
    row( 'c-2', 'Jo Kim', 'checking' ),
    row( 'c-3', 'Lena Fischer', 'waiting' ),
  ], [{ id: 'f-1', contactId: 'c-1', kind: 'verified', tone: 'good', text: 'Sarah Chen: email verified', at: '2026-10-24T00:00:00Z' }] );

  const finished = state( 'done', 3, [
    row( 'c-1', 'Sarah Chen', 'enriched', { title: 'Head of Operations' } ),
    row( 'c-2', 'Jo Kim', 'flagged', { email: 'info@kimstudio.example', note: 'Shared inbox, not a person', flagReason: 'role_inbox' } ),
    row( 'c-3', 'Lena Fischer', 'undeliverable', { note: "Mailbox doesn't exist", flagReason: 'undeliverable' } ),
  ], [
    { id: 'f-3', contactId: 'c-3', kind: 'undeliverable', tone: 'neutral', text: "Lena Fischer: mailbox doesn't exist", at: '2026-10-24T00:00:03Z' },
    { id: 'f-2', contactId: 'c-2', kind: 'role_inbox', tone: 'attention', text: 'Jo Kim: shared inbox, flagged for you', at: '2026-10-24T00:00:02Z' },
  ], { enriched: 1, flagged: 2 } );

  const profile = {
    email: 'ada@example.com', firstName: 'Ada', lastName: 'Lovelace', profession: 'Owner', companyName: 'Analytical Co',
    companyDescription: '', jobDescriptionForTODD: 'Sales.', valueProp: '', companyGoal: '', timezone: 'America/Chicago', phone: '',
  };

  const onboarding = ( weeklyDigest = false ) => ( {
    steps: [], completedSteps: 2, totalSteps: 5, allDone: false, firstName: 'Ada',
    profileCompletion: { percent: 75, completed: 6, total: 8, missing: [] }, aiProfile: { answered: 1, total: 4 },
    counts: { imported: 3 }, latestImport: { id: 'b-1', status: 'done', total: 3 },
    state: { weeklyDigest, outreachOpenedAt: null, neverOpenedBannerDismissedAt: null },
  } );

  const writeAccess = ( network: boolean ) => cy.intercept( 'GET', '**/account/summary', {
    statusCode: 200, body: { success: true, data: { writeAccess: { network } } },
  } ).as( 'writeAccess' );

  const signIn = ( path: string ) => cy.visitWithFirebaseEmulators( path, {
    email: `network-cleanup-${Date.now()}@example.com`,
    password: 'CypressTest123!',
  } );

  beforeEach( () => {
    writeAccess( true );
    cy.intercept( 'POST', '**/network/entitlement', { statusCode: 200, body: { success: true, hasNetwork: true, effectiveLimit: 1000, currentCount: 0 } } );
    cy.intercept( 'GET', '**/network/limits*', { statusCode: 200, body: {} } );
    cy.intercept( 'GET', '**/network/dashboard-counts*', { statusCode: 200, body: {} } );
    cy.intercept( 'GET', '**/network/onboarding', { statusCode: 200, body: { data: onboarding() } } );
    cy.intercept( 'GET', '**/api/profile', { statusCode: 200, body: { success: true, profile } } );
  } );

  it( 'opens a batch, imports into it, and goes to the live cleanup', () => {
    cy.intercept( 'POST', '**/network/imports', { statusCode: 201, body: { success: true, batchId: 'b-1' } } ).as( 'createBatch' );
    cy.intercept( 'POST', '**/network/imports/b-1/start', { statusCode: 200, body: { success: true } } ).as( 'startBatch' );
    cy.intercept( 'GET', '**/network/imports/b-1', { statusCode: 200, body: { success: true, data: running } } );

    signIn( '/contact-import?sample=1' );
    cy.contains( '[data-cy="ci-preview"] h2', '12 contacts found' );
    cy.get( '[data-cy="ci-import"]' ).click();
    cy.wait( '@createBatch' ).its( 'request.body' ).should( 'deep.equal', { source: 'csv', total: 12 } );
    cy.wait( '@startBatch' );
    cy.location( 'pathname' ).should( 'eq', '/import/b-1/cleanup' );
    cy.contains( '[data-cy="cleanup-heading"]', 'Checking 2 of 3…' );
  } );

  it( 'shows rows change as 16Ahead works, then hands off to Ready', () => {
    let calls = 0;
    cy.intercept( 'GET', '**/network/imports/b-1', ( req ) => {
      calls += 1;
      req.reply( { statusCode: 200, body: { success: true, data: calls < 2 ? running : finished } } );
    } );
    signIn( '/import/b-1/cleanup' );

    cy.contains( '[data-cy="cleanup-heading"]', 'Checking 2 of 3…' );
    cy.get( '[data-cy="cleanup-row"]' ).eq( 1 ).should( 'contain.text', 'Checking email' );
    cy.get( '[data-cy="cleanup-feed"]' ).should( 'contain.text', 'Sarah Chen: email verified' );
    cy.get( '[data-cy="profile-question-card"]' ).should( 'contain.text', 'While 16Ahead works' );
    cy.screenshot( 'cleanup/running', { capture: 'viewport' } );

    cy.contains( '[data-cy="cleanup-heading"]', 'All 3 checked.', { timeout: 6000 } );
    cy.get( '[data-cy="cleanup-row"]' ).eq( 1 ).should( 'contain.text', 'Needs a look' ).and( 'contain.text', 'Shared inbox' );
    cy.get( '[data-cy="cleanup-counter"]' ).eq( 4 ).should( 'contain.text', '2' );
    cy.screenshot( 'cleanup/finished', { capture: 'viewport' } );
    cy.get( '[data-cy="cleanup-ready"]' ).click();
    cy.location( 'pathname' ).should( 'eq', '/import/b-1/ready' );
  } );

  it( 'says how many wait for tonight when the daily checks run out', () => {
    cy.intercept( 'GET', '**/network/imports/b-1', { statusCode: 200, body: { success: true, data: state( 'done', 3, [
      row( 'c-1', 'Sarah Chen', 'verified' ), row( 'c-2', 'Jo Kim', 'deferred' ), row( 'c-3', 'Lena Fischer', 'deferred' ),
    ], [], { checked: 1, deferred: 2 } ) } } );
    signIn( '/import/b-1/cleanup' );

    cy.contains( '[data-cy="cleanup-heading"]', '1 checked. 2 more tonight.' );
    cy.contains( '16Ahead checks up to 25 emails a day.' );
    cy.get( '[data-cy="cleanup-row"]' ).eq( 1 ).should( 'contain.text', 'Checks tonight' );
  } );

  it( 'resolves flagged contacts and turns on the weekly list on Ready', () => {
    cy.intercept( 'GET', '**/network/imports/b-1', { statusCode: 200, body: { success: true, data: finished } } );
    const kept = { ...finished, contacts: finished.contacts.map( ( r: any ) => r.id === 'c-2' ? { ...r, resolution: 'Kept' } : r ) };
    cy.intercept( 'POST', '**/network/imports/b-1/flags/c-2', { statusCode: 200, body: { success: true, data: kept } } ).as( 'keep' );
    cy.intercept( 'PATCH', '**/network/onboarding', { statusCode: 200, body: { success: true, data: onboarding( true ) } } ).as( 'weekly' );
    signIn( '/import/b-1/ready' );

    cy.contains( '[data-cy="ready-heading"]', '1 person is ready to hear from you.' );
    cy.get( '[data-cy="ready-voice"]' ).should( 'contain.text', '3 answers missing' );
    cy.get( '[data-cy="ready-add-outreach"]' ).should( 'be.visible' );
    cy.get( '[data-cy="ready-flags"] h2' ).should( 'contain.text', 'Needs you · 2' );
    cy.screenshot( 'cleanup/ready', { capture: 'viewport' } );

    cy.wait( '@writeAccess' );
    cy.get( '[data-cy="ready-flag"]' ).eq( 0 ).find( '[data-cy="ready-flag-keep"]' ).should( 'contain.text', 'Keep anyway' ).click();
    cy.wait( '@keep' ).its( 'request.body' ).should( 'deep.equal', { action: 'keep' } );
    cy.get( '[data-cy="ready-flag"]' ).eq( 0 ).should( 'contain.text', 'Kept' );
    cy.get( '[data-cy="ready-flags"] h2' ).should( 'contain.text', 'Needs you · 1' );
    cy.get( '[data-cy="ready-flag"]' ).eq( 1 ).find( '[data-cy="ready-flag-keep"]' ).should( 'contain.text', 'Find new email' );

    cy.get( '[data-cy="ready-weekly"]' ).check();
    cy.wait( '@weekly' ).its( 'request.body' ).should( 'deep.equal', { weeklyDigest: true } );
    cy.get( '[data-cy="ready-weekly"]' ).should( 'be.checked' );
  } );

  it( 'asks an unpaid user to subscribe instead of resolving a flag', () => {
    writeAccess( false );
    cy.intercept( 'GET', '**/network/imports/b-1', { statusCode: 200, body: { success: true, data: finished } } );
    cy.intercept( 'POST', '**/network/imports/b-1/flags/*', cy.spy().as( 'resolve' ) );
    signIn( '/import/b-1/ready' );
    cy.wait( '@writeAccess' );

    cy.get( '[data-cy="ready-flag-remove"]' ).first().click();
    cy.get( '[data-cy="write-access-prompt"]' ).should( 'be.visible' );
    cy.get( '@resolve' ).should( 'not.have.been.called' );
  } );
} );
