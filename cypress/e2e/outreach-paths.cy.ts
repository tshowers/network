/**
 * The paths back into Outreach after setup (design_handoff_network_onboarding
 * 10): the never-opened banner, Going quiet, the ready tile, and Email on the
 * contact list. Every one opens Outreach's composer with the contacts
 * preselected and a profile draft. APIs are stubbed; window.open is stubbed.
 */
describe( 'Paths to Outreach', () => {
  const onboarding = ( state: Record<string, unknown> = {} ) => ( {
    steps: [], completedSteps: 5, totalSteps: 5, allDone: true, firstName: 'Ada',
    profileCompletion: { percent: 100, completed: 8, total: 8, missing: [] }, aiProfile: { answered: 4, total: 4 },
    counts: { imported: 12 }, latestImport: { id: 'b-1', status: 'done', total: 12 },
    state: { weeklyDigest: false, outreachOpenedAt: null, neverOpenedBannerDismissedAt: null, ...state },
  } );

  const quiet = {
    items: [
      { contactId: 'c-2', name: 'Priya Raman', firstName: 'Priya', title: 'Founder', company: 'Raman Design', email: 'priya@raman.com',
        kind: 'quiet', days: 41, reason: 'last talked 41 days ago', draftPreview: 'Hi Priya, it has been a while. Would a quick catch-up next week be useful?' },
      { contactId: 'c-3', name: 'David Okafor', firstName: 'David', title: 'VP Sales', company: 'Northpeak', email: 'd@northpeak.com',
        kind: 'opened_no_reply', days: 9, reason: 'opened your last email, no reply', draftPreview: '' },
    ],
    repliesThisWeek: 2,
    readyContactIds: ['c-1', 'c-2', 'c-3'],
  };

  const signIn = ( path: string ) => cy.visitWithFirebaseEmulators( path, {
    email: `network-paths-${Date.now()}@example.com`,
    password: 'CypressTest123!',
  } );

  const stubOpen = () => cy.window().then( ( win ) => cy.stub( win, 'open' ).as( 'open' ) );

  beforeEach( () => {
    cy.intercept( 'GET', '**/account/summary', { statusCode: 200, body: { success: true, data: { writeAccess: { network: true } } } } ).as( 'writeAccess' );
    cy.intercept( 'POST', '**/network/entitlement', { statusCode: 200, body: { success: true, hasNetwork: true, effectiveLimit: 1000, currentCount: 3 } } );
    cy.intercept( 'GET', '**/network/limits*', { statusCode: 200, body: {} } );
    cy.intercept( 'GET', '**/network/dashboard-counts*', { statusCode: 200, body: { totalContacts: 12, validEmailContacts: 9 } } );
    cy.intercept( 'PATCH', '**/network/onboarding', ( req ) => req.reply( { statusCode: 200, body: { success: true, data: onboarding( req.body.outreachOpened ? { outreachOpenedAt: '2026-10-24T00:00:00Z' } : {} ) } } ) ).as( 'patchOnboarding' );
  } );

  it( 'greets the user, lists who is going quiet, and opens Outreach from the banner', () => {
    cy.intercept( 'GET', '**/network/onboarding', { statusCode: 200, body: { data: onboarding() } } );
    cy.intercept( 'GET', '**/network/going-quiet', { statusCode: 200, body: { success: true, data: quiet } } );
    signIn( '/app' );
    stubOpen();

    cy.get( '[data-cy="home-greeting"]' ).invoke( 'text' ).should( 'match', /^Good (morning|afternoon|evening), Ada\.$/ );
    cy.contains( '2 people are going quiet. A short note now keeps them warm.' );
    cy.get( '[data-cy="home-never-opened"]' ).should( 'contain.text', 'Your 3 verified contacts haven’t heard from you yet' );
    cy.get( '[data-cy="home-quiet-card"]' ).should( 'have.length', 2 ).first()
      .should( 'contain.text', 'Founder, Raman Design · last talked 41 days ago' ).and( 'contain.text', 'Hi Priya' );
    cy.get( '[data-cy="home-quiet-card"]' ).eq( 1 ).find( '.rel-quiet__draft' ).should( 'not.exist' );
    cy.screenshot( 'outreach/home-day-3', { capture: 'viewport' } );

    cy.get( '[data-cy="home-review-draft"]' ).click();
    cy.get( '@open' ).should( 'have.been.calledWith',
      'https://outreach.16ahead.com/compose-email?contactIds=c-1,c-2,c-3&source=network&draft=profile', '_blank', 'noopener' );
    cy.contains( 'Opening Outreach with 3 contacts selected…' );
    cy.wait( '@patchOnboarding' ).its( 'request.body' ).should( 'deep.equal', { outreachOpened: true } );
    cy.get( '[data-cy="home-never-opened"]' ).should( 'not.exist' );
  } );

  it( 'emails one person, snoozes another, and turns on the weekly list', () => {
    cy.intercept( 'GET', '**/network/onboarding', { statusCode: 200, body: { data: onboarding( { outreachOpenedAt: '2026-10-20T00:00:00Z' } ) } } );
    cy.intercept( 'GET', '**/network/going-quiet', { statusCode: 200, body: { success: true, data: quiet } } );
    cy.intercept( 'POST', '**/network/going-quiet/c-3/snooze', { statusCode: 200, body: { success: true } } ).as( 'snooze' );
    signIn( '/app' );
    stubOpen();

    cy.get( '[data-cy="home-never-opened"]' ).should( 'not.exist' );
    cy.get( '[data-cy="home-quiet-email"]' ).first().click();
    cy.get( '@open' ).should( 'have.been.calledWith',
      'https://outreach.16ahead.com/compose-email?contactIds=c-2&source=network&draft=profile', '_blank', 'noopener' );
    cy.contains( 'Opening Outreach with Priya Raman selected…' );
    cy.wait( '@patchOnboarding' ).its( 'request.body' ).should( 'deep.equal', { outreachOpened: true } );

    // Clicked before the access check answers is fine: the gate holds the click.
    cy.get( '[data-cy="home-quiet-snooze"]' ).eq( 1 ).click();
    cy.wait( '@snooze' );
    cy.get( '[data-cy="home-quiet-card"]' ).should( 'have.length', 1 );

    cy.get( '[data-cy="home-weekly"]' ).check();
    cy.wait( '@patchOnboarding' ).its( 'request.body' ).should( 'deep.equal', { weeklyDigest: true } );
  } );

  it( 'says Not now to the banner', () => {
    cy.intercept( 'GET', '**/network/onboarding', { statusCode: 200, body: { data: onboarding() } } );
    cy.intercept( 'GET', '**/network/going-quiet', { statusCode: 200, body: { success: true, data: quiet } } );
    signIn( '/app' );

    cy.get( '[data-cy="home-not-now"]' ).click();
    cy.wait( '@patchOnboarding' ).its( 'request.body' ).should( 'deep.equal', { dismissNeverOpenedBanner: true } );
    cy.get( '[data-cy="home-never-opened"]' ).should( 'not.exist' );
  } );

  it( 'selects contacts on the list and emails them in Outreach', () => {
    cy.intercept( 'GET', '**/network/onboarding', { statusCode: 200, body: { data: onboarding() } } );
    cy.intercept( 'GET', '**/network/going-quiet', { statusCode: 200, body: { success: true, data: quiet } } );
    const credentials = { email: `network-paths-list-${Date.now()}@example.com`, password: 'CypressTest123!' };
    cy.emulatorSignUp( credentials ).then( ( account ) => {
      cy.seedContact( account, 'tom', { firstName: 'Tom', lastName: 'Alvarez', emailAddresses: [{ emailAddress: 'tom@alvarez.com' }] } );
      cy.seedContact( account, 'ben', { firstName: 'Ben', lastName: 'Carter', emailAddresses: [{ emailAddress: 'ben@carter.com' }] } );
      // Sample contacts stay in Network: no checkbox, no Email.
      cy.seedContact( account, 'sample', { firstName: 'Sample', lastName: 'Person', emailAddresses: [{ emailAddress: 's@brightlane.example' }] } );
      cy.visitWithFirebaseEmulators( '/contact-list', credentials );
    } );
    stubOpen();

    cy.get( '[data-cy="contact-select"]', { timeout: 10000 } ).should( 'have.length', 2 );
    cy.get( '[data-cy="contact-select"]' ).check( { multiple: true } );
    cy.contains( '[data-cy="contacts-bulk"]', '2 selected' );
    cy.get( '[data-cy="contacts-bulk-email"]' ).should( 'contain.text', 'Email 2 in Outreach' ).click();
    cy.get( '@open' ).its( 'firstCall.args.0' ).should( 'match', /\/compose-email\?contactIds=(ben,tom|tom,ben)&source=network&draft=profile$/ );
    cy.screenshot( 'outreach/contacts-selected', { capture: 'viewport' } );
  } );
} );
