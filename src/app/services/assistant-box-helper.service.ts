import { Injectable } from '@angular/core';
import { LoggerService } from './logger.service';

/**
 * Trimmed port of TODD's AssistantBoxHelperService. routeLabelMap and the
 * backtick-stripping term list are cut down to Network's own routes only -
 * the original carries labels for every TODD system (Moves, Docs, Pulse,
 * Outreach). buildEmailSentBriefingHtml (Outreach/Catalyst-only) is not
 * ported.
 */
@Injectable( { providedIn: 'root' } )
export class AssistantBoxHelperService {

  private routeLabelMap: Record<string, string> = {
    '/network/app': 'Network Overview',
    '/contact-deal-flow': 'Pipeline',
    '/contact-edit': 'Add to Network',
    '/contact-list': 'Open Network List',
    '/contact-import': 'Import',
    '/pricing': 'Pricing',
    '/help': 'Help',
  };

  constructor ( private logger: LoggerService ) { }

  public normalizeAssistantText ( text: string ): string {
    return String( text || '' )
      .replace( /\r\n?/g, '\n' )
      .replace( /```[a-zA-Z0-9_-]*\n?/g, '' )
      .replace( /```/g, '' )
      .replace( /\\([*_`])/g, '$1' )
      .trim();
  }

  // Remove markdown backticks around route/feature labels so they don't render as quotes
  public stripBackticksAroundRoutes ( s: string ): string {
    if ( !s ) return s;

    const terms = ['Network', 'Network List', 'Network Overview', 'Pipeline', 'Import', 'Profile', 'Home'];
    for ( const term of terms ) {
      const esc = term.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' );
      s = s.replace( new RegExp( '`\\s*' + esc + '\\s*`', 'g' ), term );
    }

    s = s.replace( /`(\/[a-z0-9\-\/#]+)`/gi, '$1' );
    return s;
  }

  // Convert route-link buttons to anchors so Angular sanitizer won't drop them
  public ensureAnchorRouteLinks ( html: string ): string {
    if ( !html ) return html;
    return html.replace(
      /<a([^>]*class="[^"]*route-link[^"]*"[^>]*)>([\s\S]*?)<\/a>/gi,
      ( _m, attrs: string, label: string ) => {
        const pathMatch = attrs.match( /data-path="([^"]+)"/i );
        const path = pathMatch ? pathMatch[1] : '#';
        return `<a href="${path}" class="route-link" data-path="${path}">${label}</a>`;
      }
    );
  }

  // After markdown/linkifying, remove any stray backticks that wrapped rendered buttons
  public postCleanButtonTicks ( html: string ): string {
    if ( !html ) return html;

    html = html.replace( /`(\s*)<a([^>]*)>([\s\S]*?)<\/a>(\s*)`/g, '<a$2>$3</a>' );
    html = html.replace( /&grave;(\s*)<a([^>]*)>([\s\S]*?)<\/a>(\s*)&grave;/g, '<a$2>$3</a>' );
    return html;
  }

  public replaceMarkdownLinksWithButtons ( src: string ): string {
    if ( !src ) return src;

    const buttonized = src.replace( /\[([^\]]+)\]\(([^)]+)\)/g, ( _m, label: string, url: string ) => {
      let path = ( url || '' ).trim();
      if ( path.startsWith( '#/' ) ) path = path.slice( 1 );
      if ( path.startsWith( '#' ) ) path = path.slice( 1 );

      const internal = path.startsWith( '/' ) ? path : `/${path}`;

      const text = ( label || '' ).trim() || 'Open';
      return `<a class="btn-ios route-link" data-path="${internal}">${this.escapeHtml( text )}</a>`;
    } );

    const cleaned = buttonized
      .replace( /(<a[^>]+class="btn-ios route-link"[^>]*>[^<]+<\/a>)\s*\(about:blank\)/gi, '$1' )
      .replace( /(<a[^>]+class="btn-ios route-link"[^>]*>[^<]+<\/a>)\s*\((?:#\/|\/)?[^\)]+\)/gi, '$1' );

    return cleaned;
  }

  private escapeHtml ( text: string ): string {
    return text
      .replace( /&/g, '&amp;' )
      .replace( /</g, '&lt;' )
      .replace( />/g, '&gt;' )
      .replace( /"/g, '&quot;' )
      .replace( /'/g, '&#39;' );
  }

  public parseAssistantResponse ( res: any ): string {
    if ( typeof res === 'string' ) return res;

    if ( res && typeof res.response === 'string' ) return res.response;

    if ( res && typeof res.response === 'object' && res.response !== null ) {
      const inner = res.response;
      if ( typeof inner.response === 'string' ) return inner.response;
      if ( typeof inner === 'string' ) return inner;
    }

    return "🤖 Sorry, I didn't understand that.";
  }

  public resolveAssistantRoute ( route: string | null | undefined, prompt?: string | null, response?: string | null ): string | null {
    const cleaned = String( route || '' ).trim();
    if ( !cleaned ) return null;

    const path = cleaned.startsWith( '/' ) ? cleaned : `/${cleaned}`;
    const routeLower = path.toLowerCase();
    const promptLower = String( prompt || '' ).toLowerCase();
    const responseLower = String( response || '' ).toLowerCase();
    const combined = `${promptLower} ${responseLower}`.trim();

    if ( routeLower === '/contact-list' && /\bpipeline\b|\badvance stage\b/.test( combined ) ) {
      return '/contact-deal-flow';
    }

    return path;
  }

  // Central HTML post-processor for assistant output
  public normalizeAssistantHtml ( html: string ): string {
    let out = html || '';
    out = this.stripBackticksAroundRoutes( out );
    out = this.ensureAnchorRouteLinks( out );
    out = this.postCleanButtonTicks( out );
    return out;
  }

  convertMarkdownToHtml ( text: string ): string {
    if ( !text ) return '';
    text = this.normalizeAssistantText( this.stripBackticksAroundRoutes( text ) );
    try { this.logger.info( '[AssistantBox] markdown->html IN:', text ); } catch { }

    let cleaned = text
      .replace( /<\s*Go\s*to\s*strong\s*>/gi, '<strong>' )
      .replace( /<\s*\/\s*Go\s*to\s*strong\s*>/gi, '</strong>' )
      .replace( /<\s*Go\s*to\s*p\s*>/gi, '' )
      .replace( /<\s*\/\s*Go\s*to\s*p\s*>/gi, '' )
      .replace( /<\s*Go\s*to[^>]*>/gi, '' )
      .replace( /<\s*\/\s*Go\s*to[^>]*>/gi, '' )
      .replace( /&lt;\s*Go\s*to[^&]*&gt;/gi, '' )
      .replace( /\bGo\s*to\s*p>/gi, '' )
      .replace( /\*\*(.*?)\*\*/g, '<strong>$1</strong>' )
      .replace( /\n\-\s(.+)/g, '<li>$1</li>' )
      .replace( /\bGo\s*to\s*strong>/gi, '' );

    const reverseRouteLabels: Record<string, string> = {};
    Object.keys( this.routeLabelMap ).forEach( path => {
      const label = this.routeLabelMap[path];
      if ( label ) reverseRouteLabels[label.toLowerCase()] = path;
    } );

    cleaned = cleaned.replace( /(?:via\s+the\s+)?route\s*:\s*([A-Za-z][A-Za-z\s\-]+)/gi, ( _m, p1: string ) => {
      const key = ( p1 || '' ).trim().toLowerCase();
      const path = reverseRouteLabels[key];
      return path ? ` ${path} ` : _m;
    } );

    let html = cleaned.replace( /\*\*(.*?)\*\*/g, '<strong>$1</strong>' );

    const lines = html
      .split( '\n' )
      .map( line => line.trim() )
      .filter( line => line.length > 0 );

    const blocks: string[] = [];
    let index = 0;
    while ( index < lines.length ) {
      if ( /^\d+\.\s+/.test( lines[index] ) ) {
        const items: string[] = [];
        while ( index < lines.length && /^\d+\.\s+/.test( lines[index] ) ) {
          items.push( lines[index].replace( /^\d+\.\s+/, '' ) );
          index++;
        }
        blocks.push( `<ol>${items.map( item => `<li>${item}</li>` ).join( '' )}</ol>` );
        continue;
      }

      if ( /^[-*]\s+/.test( lines[index] ) ) {
        const items: string[] = [];
        while ( index < lines.length && /^[-*]\s+/.test( lines[index] ) ) {
          items.push( lines[index].replace( /^[-*]\s+/, '' ) );
          index++;
        }
        blocks.push( `<ul>${items.map( item => `<li>${item}</li>` ).join( '' )}</ul>` );
        continue;
      }

      blocks.push( `<p>${lines[index]}</p>` );
      index++;
    }

    html = blocks.join( '' );
    html = this.linkifyAppRoutes( html );

    html = html
      .replace( /<\s*Go\s*to[^>]*>/gi, '' )
      .replace( /<\s*\/\s*Go\s*to[^>]*>/gi, '' )
      .replace( /&lt;\s*Go\s*to[^&]*&gt;/gi, '' )
      .replace( /\bGo\s*to\s*p>/gi, '' );

    html = this.normalizeAssistantHtml( html );
    html = this.replaceMarkdownLinksWithButtons( html );
    html = html.replace( /\*\*(.*?)\*\*/g, '<strong>$1</strong>' );
    try { this.logger.info( '[AssistantBox] markdown->html OUT:', html ); } catch { }
    return this.postCleanButtonTicks( html );
  }

  public linkifyAppRoutes ( html: string ): string {
    if ( !html ) return html;

    const routeRe = /(^|[^A-Za-z0-9_])((?:\/[a-z0-9][a-z0-9\-]*)(?:\/[a-z0-9:\-]+)*)(?=$|[^A-Za-z0-9_\/])/gi;
    const segments = html.split( /(<[^>]+>)/g );

    return segments.map( segment => {
      if ( !segment || segment.startsWith( '<' ) ) return segment;

      return segment.replace( routeRe, ( _match, prefix: string, route: string ) => {
        return `${prefix}<a href="${route}" class="route-link" data-path="${route}">${route}</a>`;
      } );
    } ).join( '' );
  }

  public normalizeCommand ( text: string ): string {
    return ( text || '' )
      .toLowerCase()
      .replace( /[\/\-]/g, ' ' )
      .replace( /\s+/g, ' ' )
      .trim();
  }

  public tryWhatWorkIntent ( p: string ): string | null {
    if ( /\b(what work do you do|what do you actually do|do you actually do work|what work you do)\b/i.test( p ) ) {
      return this.normalizeAssistantHtml( `
      <strong>Here's what I actually do for you, automatically:</strong>
      <ul>
        <li>Validate email addresses (mark blocked/checked, catch bounces)</li>
        <li>Enrich & clean contacts (add missing data, fix formatting, normalize phones)</li>
        <li>Detect duplicates & stale records; flag low-quality data</li>
        <li>Track last contact and nudge timely follow-ups</li>
        <li>Suggest who to contact today based on inactivity & engagement</li>
      </ul>
    `);
    }
    return null;
  }
}
