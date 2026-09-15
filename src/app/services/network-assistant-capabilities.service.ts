import { Injectable } from '@angular/core';

export type LocalCapability = {
  id: string;
  label: string;
  hint?: string;
  patterns: string[];
  guard?: () => boolean;
};

export type DirectNavResult =
  | { handled: false; }
  | { handled: true; kind: 'message'; message: string; }
  | { handled: true; kind: 'navigate'; path: string; };

type WorkflowGuide = {
  id: string;
  patterns: RegExp[];
  message: string;
};

type RouteIntentGuide = {
  id: string;
  route: string;
  phrases: string[];
  message: string;
};

export type CapabilityContext = {
  hasSelectedContact: boolean;
  selectedContactName?: string;
  placeholderChoices: string[];
};

/**
 * Network's own slice of TODD's AssistantCapabilitiesService - this is the
 * file the assistant-box scoping decision is really about. TODD's original
 * is suite-wide: ~70 routes across every system, workflow guides that cross-
 * sell Outreach/Docs/Pulse/Social, and route-intent phrase banks for each
 * system. This keeps only Network's own routes, its own workflow guide
 * (add-contacts), and the three route-intent guides that were already about
 * Network (network-cockpit, contact-list-operations,
 * contact-import-operations) - verbatim from the source file, since they
 * were already scoped to this product. Everything that pointed at
 * outreach/*, moves/*, docs/*, pulse/*, marketing-director*, sayit, or
 * lead-vault is dropped, not trimmed-in-place, so this file can't drift
 * back into knowing about the rest of TODD.
 */
@Injectable( { providedIn: 'root' } )
export class NetworkAssistantCapabilitiesService {
  private readonly directRouteAliases: Record<string, string> = {
    'contacts': 'app',
    'my contacts': 'app',
    'contact list': 'contact-list',
    'add contact': 'contact-edit',
    'import contacts': 'contact-import',
    'network': 'app',
    'my network': 'app',
    'network overview': 'app',
    'relationships': 'app',
    'my relationships': 'app',
    'pricing': 'pricing',
    'home': '',
  };

  private readonly directCommandRoutes: { path: string; requiresId?: boolean; idParam?: string; }[] = [
    { path: '' },
    { path: 'app' },
    { path: 'login' },
    { path: 'pricing' },
    { path: 'contact-list' },
    { path: 'contact-edit' },
    { path: 'contact-import' },
    { path: 'contact-deal-flow' },
    { path: 'contact/:id', requiresId: true, idParam: 'id' },
  ];

  private readonly workflowGuides: WorkflowGuide[] = [
    {
      id: 'add-contacts',
      patterns: [
        /\bhow do i add (a )?contact\b/i,
        /\bhow to add (a )?contact\b/i,
        /\bhow do i import contacts\b/i,
        /\bhow to import contacts\b/i,
      ],
      message: [
        '<p><strong>For contacts, there are two main paths.</strong></p>',
        '<p><strong>A.</strong> Add one person manually at <strong>/contact-edit</strong>.</p>',
        '<p><strong>B.</strong> Import a CSV or larger list at <strong>/contact-import</strong>.</p>',
        '<p>If you want to review everything after that, open <strong>/contact-list</strong> or the Network cockpit at <strong>/app</strong>.</p>'
      ].join( '' )
    },
  ];

  private readonly routeIntentGuides: RouteIntentGuide[] = [
    {
      id: 'network-cockpit',
      route: '/app',
      phrases: [
        'open relationships',
        'go to relationships',
        'show relationships',
        'open my relationship dashboard',
        'show my relationship dashboard',
        'take me to my network',
        'open my network',
        'show my network',
        'show the network dashboard',
        'show the contact dashboard',
        'open the contact dashboard',
        'show me the big picture',
        'give me a relationship overview',
        'give me a network overview',
        'summarize my relationships',
        'summarize my contact network',
        'how healthy is my network',
        'how healthy are my relationships',
        'what is my relationship health',
        'show relationship health',
        'show network health',
        'show contact health',
        'what is my momentum score',
        'how is my relationship momentum',
        'is my network healthy',
        'is my contact data healthy',
        'what is wrong with my network',
        'where is my network weak',
        'what relationship problems do i have',
        'diagnose my relationships',
        'diagnose my network',
        'show my relationship problems',
        'show business health',
        'who needs attention',
        'how many contacts need attention',
        'how many relationships need attention',
        'are any relationships going cold',
        'show relationships going cold',
        'show cooling relationships',
        'are contacts going quiet',
        'how many contacts have gone quiet',
        'am i losing relationship momentum',
        'where am i losing momentum',
        'do i have overdue follow ups',
        'how much follow up risk do i have',
        'show my follow up risk',
        'are important contacts being ignored',
        'how many important contacts need attention',
        'how complete is my contact data',
        'is my contact data complete',
        'show data readiness',
        'what is my data readiness',
        'how many contacts need enrichment',
        'how many records need enrichment',
        'show enrichment progress',
        'how many contacts are enriched',
        'what percentage of contacts are enriched',
        'are my contact records incomplete',
        'show incomplete contact data',
        'how much contact information is missing',
        'is my network ready for outreach',
        'how outreach ready is my network',
        'how many contacts are reachable',
        'show reachability',
        'what is my reachability score',
        'how many valid emails do i have',
        'how many contacts have valid emails',
        'what percentage of contacts have valid emails',
        'are my email addresses verified',
        'how many emails are verified',
        'how many contacts cannot be reached',
        'show unreachable contacts',
        'is my contact information trustworthy',
        'can i trust my contact data',
        'what is my bounce risk',
        'is my network safe for email outreach',
        'how ready are my contacts for email',
        'how many contacts have a next move',
        'show next move readiness',
        'how many next moves are ready',
        'how many contacts are staged',
        'show contacts staged for action',
        'are opportunities becoming inactive',
        'show inactive opportunities',
        'where is opportunity motion missing',
        'how many contacts do not have a next step',
        'show next step progress',
        'is todd preparing follow ups',
        'what should happen next',
        'is todd finding the next move',
        'how many relationships are ready for action',
        'what is todd doing',
        'what is todd doing about my relationships',
        'show todd activity',
        'show the treatment log',
        'open the treatment log',
        'what problems is todd treating',
        'what is todd working on',
        'show active treatments',
        'what has todd fixed',
        'show relief progress',
        'is relationship health improving',
        'what relief has todd delivered',
        'show proof of improvement',
        'show symptom treatment and relief',
        'show the care cycle',
        'what is todd monitoring',
        'how many contacts do i have',
        'what is my total contact count',
        'show total contacts',
        'how large is my network',
        'how many important contacts do i have',
        'how many subscribers do i have',
        'show my network numbers',
        'show contact statistics',
        'show relationship metrics',
        'show network metrics',
        'what is my contact limit',
        'how much contact capacity do i have',
        'how much capacity is left',
        'how many contacts can i add',
        'how many contacts do i have remaining',
        'am i near my contact limit',
        'have i reached my contact limit',
        'am i over capacity',
        'show capacity usage',
        'what percentage of capacity am i using',
        'why can i not add more contacts',
        'why can i not import more contacts',
        'do i need more contact capacity'
      ],
      message: [
        '<p><strong>This sounds like a Network cockpit question.</strong></p>',
        '<p>Open <strong>/app</strong> for relationship health, contact quality, reachability, enrichment, and next-move readiness.</p>'
      ].join( '' )
    },
    {
      id: 'contact-list-operations',
      route: '/contact-list',
      phrases: [
        'find john smith',
        'show me john smith',
        'look up john smith',
        'do i know john smith',
        'is john smith in my contacts',
        'search for sarah at microsoft',
        'find everyone named michael',
        'show contacts at microsoft',
        'find people at accenture',
        'who do i know at deloitte',
        'show everyone from amazon',
        'show people who work for google',
        'show seattle contacts i have not emailed',
        'find customers with valid email addresses',
        'show executives at technology companies',
        'find contacts worth more than ten thousand dollars',
        'show contacts in seattle',
        'find people in washington',
        'show california contacts',
        'who do i know in atlanta',
        'show government contacts',
        'find minority owned businesses',
        'show vendors',
        'find prospects',
        'find companies that do cybersecurity',
        'show contacts with cloud capabilities',
        'find software development companies',
        'show architects',
        'find marketing directors',
        'show people in healthcare',
        'find technology executives',
        'show active contacts',
        'show inactive contacts',
        'show hot contacts',
        'open my hot contacts',
        'show contacts due for follow up',
        'show vip contacts',
        'find people who have not been emailed',
        'show contacts ready for outreach',
        'find contacts who opened an email',
        'show contacts on the hilco project',
        'find project stakeholders',
        'show contacts with invalid emails',
        'find contacts with no phone number',
        'show incomplete contacts',
        'show contacts that need enrichment',
        'verify these email addresses',
        'show unverified emails',
        'check email quality',
        'show contacts that need reconfiguration',
        'clean up contact data',
        'sort contacts by company',
        'sort by last name',
        'show newest contacts first',
        'show the table',
        'switch to table view',
        'show raw json',
        'change visible columns',
        'show the phone column',
        'select all contacts',
        'select everyone in this list',
        'clear my selections',
        'bulk update contacts',
        'update all visible contacts',
        'delete the selected contacts',
        'export these contacts',
        'download the contact list',
        'export the current results',
        'clear contact filters',
        'reset the list',
        'remove all filters'
      ],
      message: [
        '<p><strong>This sounds like contact-list work.</strong></p>',
        '<p>Open <strong>/contact-list</strong> to browse, filter, sort, select, export, or inspect individual records.</p>',
        '<p>Once you are there, the TODD popup has page context and can help with the list you are looking at.</p>'
      ].join( '' )
    },
    {
      id: 'contact-import-operations',
      route: '/contact-import',
      phrases: [
        'import contacts',
        'open contact import',
        'take me to contact import',
        'show the contact importer',
        'upload contacts',
        'add contacts from a file',
        'bring contacts into todd',
        'import people into my network',
        'load contacts from a spreadsheet',
        'start a contact import',
        'open network import',
        'add a contact list',
        'upload a csv',
        'upload my contact file',
        'choose a contact csv',
        'import this csv',
        'load this spreadsheet',
        'drag in my contact file',
        'select a csv file',
        'upload my mailing list',
        'upload my customer list',
        'upload my prospect list',
        'bring in contacts from excel',
        'load contacts from a file',
        'what format should my contact file use',
        'what columns are required',
        'what headers does the csv need',
        'how should i format my csv',
        'what fields can i import',
        'what contact fields are supported',
        'is email required',
        'show import instructions',
        'how do i prepare my contact file',
        'download the contact template',
        'show me the csv template',
        'give me an import template',
        'download a sample csv',
        'load the sample csv',
        'show me how import works',
        'use sample contacts',
        'map my csv columns',
        'match the headers',
        'match contact fields',
        'fix the column mapping',
        'preview the contacts',
        'review the import',
        'show me the mapped data',
        'check the contacts before importing',
        'show what will be imported',
        'start the import',
        'import these contacts',
        'complete the contact import',
        'submit the contact import',
        'what is the import status',
        'is the import still running',
        'how far along is the import',
        'show import progress',
        'how many contacts were imported',
        'show the import results',
        'how many contacts failed',
        'show import failures',
        'show the import log',
        'why did the import fail',
        'show failed contacts',
        'which records failed',
        'show import errors',
        'help me fix the import',
        'cancel the import',
        'reset the contact import',
        'start another import',
        'upload another csv',
        'why can i not import these contacts',
        'have i reached my contact limit',
        'how much contact capacity is left',
        'do i need to upgrade to import',
        'buy more contacts',
        'upgrade my contact limit',
        'show the imported contacts',
        'view the contacts i imported'
      ],
      message: [
        '<p><strong>This sounds like contact-import work.</strong></p>',
        '<p>Open <strong>/contact-import</strong> to upload a CSV, map fields, preview records, run the import, review results, or resolve contact-capacity issues.</p>',
        '<p>Once you are there, the TODD popup has import-page context and can help with the current step.</p>'
      ].join( '' )
    },
  ];

  private normalizeCommand ( text: string ): string {
    return ( text || '' )
      .toLowerCase()
      .replace( /[\/\-]/g, ' ' )
      .replace( /[^a-z0-9\s]/g, ' ' )
      .replace( /\s+/g, ' ' )
      .trim();
  }

  private stripLeadingVerb ( text: string ): string {
    const verbs = ['show', 'open', 'go', 'goto', 'navigate', 'add', 'upload', 'take', 'bring'];
    const fillers = new Set( ['me', 'to', 'the', 'a', 'an', 'page'] );
    const parts = ( text || '' ).trim().toLowerCase().split( /\s+/ );
    if ( !parts.length ) return '';

    let idx = 0;
    if ( verbs.includes( parts[0] ) ) {
      idx = 1;
      while ( idx < parts.length && fillers.has( parts[idx] ) ) idx++;
    }
    return parts.slice( idx ).join( ' ' );
  }

  public tryDirectNavCommand ( prompt: string ): DirectNavResult {
    const raw = ( prompt || '' ).trim();
    if ( !raw ) return { handled: false };

    const withoutVerb = this.stripLeadingVerb( raw );
    if ( !withoutVerb ) return { handled: false };

    const normalizedInput = this.normalizeCommand( withoutVerb );
    const rawLower = raw.toLowerCase();
    const aliasedPath = this.directRouteAliases[normalizedInput];

    if ( aliasedPath !== undefined ) {
      return { handled: true, kind: 'navigate', path: '/' + aliasedPath };
    }

    for ( const route of this.directCommandRoutes ) {
      const normalizedRoute = this.normalizeCommand( route.path );

      if ( route.requiresId ) {
        if ( normalizedInput === normalizedRoute ) {
          const baseLabel = normalizedRoute;
          return {
            handled: true,
            kind: 'message',
            message: `To open a ${baseLabel}, type "${baseLabel} YOUR_ID" (for example: "${baseLabel} 12345").`
          };
        }

        if ( normalizedInput.startsWith( normalizedRoute + ' ' ) ) {
          const idPart = normalizedInput.slice( normalizedRoute.length + 1 ).trim();
          if ( !idPart ) continue;
          const navPath = route.path.replace( /:([^\/]+)/, idPart );
          return { handled: true, kind: 'navigate', path: '/' + navPath };
        }

        continue;
      }

      if ( normalizedInput === normalizedRoute || rawLower === route.path.toLowerCase() ) {
        return { handled: true, kind: 'navigate', path: '/' + route.path };
      }
    }

    return { handled: false };
  }

  public tryWorkflowGuide ( prompt: string ): DirectNavResult {
    const raw = String( prompt || '' ).trim();
    if ( !raw ) return { handled: false };

    const guide = this.workflowGuides.find( item => item.patterns.some( pattern => pattern.test( raw ) ) );
    if ( !guide ) return { handled: false };

    return { handled: true, kind: 'message', message: guide.message };
  }

  public tryRouteIntentGuide ( prompt: string ): DirectNavResult {
    const normalizedPrompt = this.normalizeCommand( prompt );
    if ( !normalizedPrompt ) return { handled: false };

    const guide = this.routeIntentGuides.find( item =>
      item.phrases.some( phrase => {
        const normalizedPhrase = this.normalizeCommand( phrase );
        return normalizedPrompt === normalizedPhrase || normalizedPrompt.includes( normalizedPhrase );
      } )
    );

    if ( !guide ) return { handled: false };

    return { handled: true, kind: 'message', message: guide.message };
  }

  private getNavCommandCapabilities (): LocalCapability[] {
    return this.directCommandRoutes
      .filter( c => !c.requiresId && c.path )
      .map( c => {
        const label = this.normalizeCommand( c.path );
        return {
          id: `nav-${c.path}`,
          label,
          hint: `Go to ${label}`,
          patterns: [label, c.path.toLowerCase()],
          guard: () => true
        };
      } );
  }

  public getLocalCapabilities ( ctx: CapabilityContext ): LocalCapability[] {
    const { hasSelectedContact, selectedContactName } = ctx;

    const dynamic: LocalCapability[] = [];
    if ( hasSelectedContact && selectedContactName ) {
      dynamic.push(
        {
          id: 'summarize-selected-contact',
          label: `Summarize ${selectedContactName}`,
          hint: 'Recent activity, tags, next move',
          patterns: ['summary', 'summarize contact', 'overview', 'recap', 'what’s up'],
          guard: () => true
        },
        {
          id: 'qa-selected-contact',
          label: `What is ${selectedContactName}'s email?`,
          hint: 'Ask about email, phone, title, company…',
          patterns: ['email', 'phone', 'title', 'company', 'tags', 'category'],
          guard: () => true
        },
        {
          id: 'last-contact-selected',
          label: `When did I last email ${selectedContactName}?`,
          hint: 'Last contact date, last follow-up',
          patterns: ['last email', 'last contacted', 'last follow up'],
          guard: () => true
        },
      );
    }

    const base: LocalCapability[] = [
      {
        id: 'filter-contacts',
        label: 'Filter contacts by tag or status',
        hint: 'Segment by tag, source, owner',
        patterns: ['filter', 'segment', 'show contacts', 'list', 'find contacts'],
        guard: () => true
      },
      {
        id: 'lookup-contact',
        label: 'Find a contact by name',
        hint: 'Search by name, email, company',
        patterns: ['find contact', 'lookup contact', 'search contact', 'go to contact'],
        guard: () => true
      },
      {
        id: 'add-new-contact',
        label: 'Add a new contact',
        hint: 'Quick add with name and company',
        patterns: ['add contact', 'new contact', 'create contact'],
        guard: () => true
      },
      {
        id: 'update-contact-field',
        label: 'Update a contact field',
        hint: 'Email, phone, title, status…',
        patterns: ['update', 'change', 'set field', 'edit contact'],
        guard: () => hasSelectedContact
      },
      {
        id: 'help',
        label: 'How this works',
        hint: 'Open Assistant Box help',
        patterns: ['help', 'how it works', 'what can you do'],
        guard: () => true
      }
    ];

    return [...dynamic, ...base, ...this.getNavCommandCapabilities()].filter( c => ( c.guard ? c.guard() : true ) );
  }

  public scoreLocalSuggestions ( query: string, ctx: CapabilityContext ): string[] {
    const caps = this.getLocalCapabilities( ctx );
    const q = ( query || '' ).trim().toLowerCase();
    if ( !q ) return [];

    const terms = q.split( /\s+/ );
    const termScore = ( text: string, weight = 1 ) => terms.reduce( ( s, t ) => ( text.includes( t ) ? s + weight : s ), 0 );

    const ranked = caps
      .map( c => {
        const label = c.label.toLowerCase();
        const hint = ( c.hint || '' ).toLowerCase();
        const patterns = c.patterns.join( ' ' ).toLowerCase();
        const score = termScore( label, 3 ) + termScore( patterns, 2 ) + termScore( hint, 1 );
        return { c, score };
      } )
      .filter( x => x.score > 0 )
      .sort( ( a, b ) => b.score - a.score )
      .map( x => x.c.label );

    if ( !ranked.length ) {
      return ( ctx.placeholderChoices || [] ).filter( p => p.toLowerCase().includes( q ) ).slice( 0, 8 );
    }

    return Array.from( new Set( ranked ) ).slice( 0, 8 );
  }
}
