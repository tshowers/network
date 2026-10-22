/**
 * The Network assistant and Missions (2026-10-22, the same shared piece as
 * Outreach's: taliferro-ui/missions/assistant-missions). The assistant opens
 * large and centered; real work becomes a Mission shown right in the
 * conversation, where the person also finishes any step that needs them.
 * Quick questions are answered by the right tool; help questions fall
 * through to the chat. Fixtures come from todd-backend
 * scripts/missions-fixtures.js (the real engine).
 */
describe( 'Network assistant: Missions', () => {
  const ASK = /\/orchestration\/missions(\?.*)?$/;
  const missionUrl = ( id: string ) => new RegExp( `/orchestration/missions/${id}(\\?.*)?$` );

  const credentials = () => ( { email: `network-assistant-${Date.now()}@example.com`, password: 'CypressTest123!' } );

  const openAssistant = ( creds = credentials() ) => {
    cy.intercept( 'POST', '**/network/entitlement', { statusCode: 200, body: { success: true, hasNetwork: false, effectiveLimit: 0, currentCount: 0 } } );
    cy.intercept( 'GET', '**/network/limits*', { statusCode: 200, body: {} } );
    cy.intercept( 'GET', '**/network/dashboard-counts*', { statusCode: 200, body: {} } );
    cy.visitWithFirebaseEmulators( '/app', creds );
    cy.get( '[data-cy="contact-home-shell"]', { timeout: 15000 } ).should( 'be.visible' );
    cy.get( '.talk-to-todd-glass' ).click( { force: true } );
    cy.get( '.todd-assistant-window-open' ).should( 'be.visible' );
    // The window has its own close button; the launcher steps aside while it's open.
    cy.get( '.talk-to-todd-glass' ).should( 'have.class', 'talk-to-todd-glass-hidden' );
  };

  const ask = ( text: string ) => {
    cy.get( '.todd-assistant-window-open .ios-input' ).type( text );
    cy.get( '.todd-assistant-window-open .assistant-bar .btn-todd' ).first().click();
  };

  /** The fixture's person (uid-owner) becomes `uid`, the signed-in emulator user, when given. */
  const missionAt = ( fixture: string, id: string, uid?: string ) => {
    cy.fixture( `missions/${fixture}.json` ).then( ( raw ) => {
      const m = uid ? JSON.parse( JSON.stringify( raw ).split( 'uid-owner' ).join( uid ) ) : raw;
      cy.intercept( { method: 'POST', url: ASK }, { statusCode: 202, body: { success: true, mode: 'mission', mission: { ...m, id, status: 'queued', steps: [] } } } ).as( 'ask' );
      cy.intercept( { method: 'GET', url: missionUrl( id ) }, { success: true, mission: { ...m, id } } ).as( 'mission' );
    } );
  };

  it( 'opens centered, at 80% of the screen, above everything', () => {
    openAssistant();
    cy.window().then( ( win ) => {
      // Layout size, not the on-screen box: the open animation scales it from 96%.
      cy.get( '.todd-assistant-window-open' ).should( ( $el ) => {
        const el = $el[0] as HTMLElement;
        expect( el.offsetWidth ).to.be.closeTo( win.innerWidth * 0.8, 2 );
        expect( el.offsetHeight ).to.be.closeTo( win.innerHeight * 0.8, 2 );
        expect( el.offsetLeft ).to.be.closeTo( win.innerWidth * 0.1, 2 );
        const box = el.getBoundingClientRect();
        expect( win.document.elementFromPoint( box.left + 20, box.top + box.height / 2 ) ).to.satisfy( ( hit: Element ) => el.contains( hit ) );
      } );
    } );
    cy.get( '.todd-assistant-scrim' ).click( { force: true } );
    cy.get( '.todd-assistant-window-open' ).should( 'not.exist' );
  } );

  it( 'emailing investors becomes the segment Mission in the conversation, with the page as context', () => {
    missionAt( 'segment-proposed', 'pitch-segment' );
    openAssistant();
    ask( 'I would like to send an email to investors about our TODD product' );
    cy.wait( '@ask' ).its( 'request.body' ).should( ( body ) => {
      expect( body ).to.include( { origin: 'ask' } );
      expect( body.request ).to.contain( 'investors' );
      expect( body.context ).to.include( { app: 'network', path: '/app' } );
    } );
    cy.get( '[data-cy="assistant-mission"]' ).should( 'exist' ).within( () => {
      cy.get( '[data-cy="mission-title"]' ).should( 'be.visible' ).and( 'contain.text', 'Email an industry segment' );
      cy.get( '[data-cy="start"]' ).should( 'be.visible' );
      cy.get( '[data-cy="plan-strip-list"]' ).should( 'exist' );
      cy.contains( 'a', 'Open in Moves' ).should( 'have.attr', 'href', 'https://moves.taliferro.tech/missions/pitch-segment' );
    } );
    // No old-style text directions underneath.
    cy.get( '.todd-assistant-window-open .assistant-response' ).should( 'not.exist' );
  } );

  it( 'a step that needs you (the send) is finished right here', () => {
    const creds = credentials();
    cy.emulatorSignUp( creds ).then( ( account ) => missionAt( 'roland-send-handed', 'reach-named-person', account.uid ) );
    cy.intercept( { method: 'POST', url: /\/orchestration\/missions\/reach-named-person\/steps\/send(\?.*)?$/ }, { statusCode: 202, body: { success: true } } ).as( 'done' );
    openAssistant( creds );
    ask( 'Email Roland Martin' );
    cy.get( '[data-cy="assistant-mission"] [data-cy="mission-banner"]' ).should( 'contain.text', 'Waiting on you: send it' );
    cy.get( '[data-cy="assistant-mission"] [data-cy="banner-cta"]' ).click();
    cy.get( '[data-cy="step-drawer"]' ).should( 'be.visible' )
      .and( 'contain.text', 'Send the approved email from Outreach and mark this done' );
    cy.get( '[data-cy="drawer-done"]' ).click();
    cy.wait( '@done' ).its( 'request.body.type' ).should( 'eq', 'complete' );
  } );

  it( 'a quick question is answered by the right tool, no Mission', () => {
    cy.intercept( { method: 'POST', url: ASK }, { statusCode: 200, body: { success: true, mode: 'direct', tool: 'network.dormant', product: 'network', summary: '4 contacts have gone quiet for 90 days' } } ).as( 'ask' );
    openAssistant();
    ask( 'Who have I lost touch with?' );
    cy.wait( '@ask' );
    cy.get( '.todd-assistant-window-open .assistant-response' ).should( 'contain.text', '4 contacts have gone quiet for 90 days' );
    cy.get( '[data-cy="assistant-mission"]' ).should( 'not.exist' );
  } );

  it( 'a help question falls through to the assistant as before', () => {
    cy.intercept( { method: 'POST', url: ASK }, { statusCode: 200, body: { success: true, mode: 'direct', assessment: { mode: 'direct' }, answer: null } } ).as( 'ask' );
    openAssistant();
    ask( 'How do I import contacts?' );
    cy.wait( '@ask' );
    cy.get( '[data-cy="assistant-mission"]' ).should( 'not.exist' );
  } );
} );
