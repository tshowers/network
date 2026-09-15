import { Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { AssistantEngineService, AssistantEngineContext, AssistantEngineHelpers, AssistantEngineIO, AssistantEnginePatches } from '../../../services/assistant-engine.service';
import { OpenAIService } from '../../../services/open-ai.service';
import { NetworkAssistantCapabilitiesService } from '../../../services/network-assistant-capabilities.service';
import { AssistantBoxHelperService } from '../../../services/assistant-box-helper.service';
import { AssistantIntentRunnerService } from '../../../services/assistant-intent-runner.service';
import { ContactLLMService } from '../../../services/contact-llm.service';
import { ContactLocalAssistantService } from '../../../services/contact-local-assistant.service';
import { SystemRecoveryService } from '../../../services/system-recovery.service';
import { NetworkAssistantSignalService } from '../../../services/network-assistant-signal.service';
import { AssistantUiService } from '../../../services/assistant-ui.service';

type ChatMsg = { role: 'user' | 'assistant'; content: string; };

/**
 * Network's own assistant-box - a trimmed port of TODD's
 * shared/page/assistant-box/assistant-box.component.ts. Everything tied to
 * domains this app doesn't have (Moves/Docs/Pulse tasks-documents-surveys,
 * the Outreach/Catalyst email composer flow, the Momentum Engine "goal"
 * intercept, and TODD's landing-page guest/demo mode) is dropped rather
 * than stubbed - see the assistant-box scoping decision. What's left is
 * the chat shell plus the single Contact domain.
 */
@Component( {
    selector: 'app-assistant-box',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './assistant-box.component.html',
    styleUrls: ['./assistant-box.component.css']
} )
export class AssistantBoxComponent implements OnInit, OnChanges, OnDestroy {
    @Input() parentOwnsHistory = false;
    @Input() externalMode = false;
    @Input() pageContext: any = null;
    @Input() isOpen = false;
    @Input() userId: string | null | undefined;
    @Input() tenantId: string | null | undefined;
    @ViewChild( 'messageContainer' ) messageContainerRef?: ElementRef<HTMLElement>;
    @Output() message = new EventEmitter<ChatMsg>();
    @Output() navigateTo = new EventEmitter<any>();
    @Output() routeTo = new EventEmitter<any>();
    @Output() callAction = new EventEmitter<any>();

    inlineReply: any = null;
    showResponses = true;
    history: ChatMsg[] = [];
    pendingAction: { action: string; param: any; } | null = null;
    showConfirmPrompt = false;
    assistantPrompt = '';
    assistantResponse = '';
    isLoading = false;
    @Input() placeholder = 'Ask about a contact, or tell me what you need.';
    PRODUCTION = false;

    private openAISubscription: Subscription | null = null;
    private transcriptSubscription: Subscription | null = null;
    private lastContextSignature: string | null = null;

    constructor (
        private engine: AssistantEngineService,
        private openAIService: OpenAIService,
        private capabilities: NetworkAssistantCapabilitiesService,
        private boxHelper: AssistantBoxHelperService,
        private intentRunner: AssistantIntentRunnerService,
        private contactLLM: ContactLLMService,
        private contactLocal: ContactLocalAssistantService,
        private systemRecovery: SystemRecoveryService,
        private assistantBus: NetworkAssistantSignalService,
        private assistantUi: AssistantUiService,
    ) { }

    ngOnInit (): void {
        this.transcriptSubscription = this.assistantBus.transcriptIn$.subscribe( ( msg ) => {
            if ( !msg?.role || !msg?.content ) return;

            const content = msg.role === 'assistant'
                ? this.renderAssistantContent( msg.content )
                : String( msg.content );

            this.publishChatMessage( msg.role, content );
        } );
    }

    ngOnDestroy (): void {
        this.openAISubscription?.unsubscribe?.();
        this.transcriptSubscription?.unsubscribe?.();
    }

    ngOnChanges ( changes: SimpleChanges ): void {
        if ( changes['pageContext'] ) {
            this.resetAssistantOnlyTranscriptIfContextShifted();
        }
    }

    // Template helpers ------------------------------------------------------
    private emitNavigation ( target: any ): void {
        const normalized = this.normalizeNavigationTarget( target );
        if ( !normalized ) return;

        this.navigateTo.emit( normalized );
        this.routeTo.emit( normalized );
    }

    private normalizeNavigationTarget ( target: any ): { path: string; queryParams?: any; fragment?: string; } | null {
        if ( !target ) return null;

        if ( typeof target === 'string' ) {
            const [pathWithMaybeLeadingSlash, fragment] = target.split( '#' );
            const [pathPart, queryString] = pathWithMaybeLeadingSlash.split( '?' );
            const path = pathPart.startsWith( '/' ) ? pathPart : `/${pathPart}`;
            const queryParams = queryString ? Object.fromEntries( new URLSearchParams( queryString ).entries() ) : undefined;
            return { path, queryParams, fragment: fragment || undefined };
        }

        if ( target.path ) {
            return {
                path: String( target.path ).startsWith( '/' ) ? String( target.path ) : `/${String( target.path )}`,
                queryParams: target.queryParams ?? target.params ?? undefined,
                fragment: target.fragment || undefined
            };
        }

        if ( target.route ) {
            return this.normalizeNavigationTarget( {
                path: target.route,
                queryParams: target.queryParams ?? target.param ?? target.params,
                fragment: target.fragment
            } );
        }

        return null;
    }

    private publishChatMessage ( role: 'user' | 'assistant', content: string ): void {
        if ( role === 'assistant' ) {
            const rendered = this.renderAssistantContent( content || '' );
            this.assistantResponse = rendered;
            content = rendered;
        }

        if ( !content ) return;

        if ( !this.parentOwnsHistory ) {
            this.history.push( { role, content } );
            this.scheduleAssistantScroll();
            return;
        }

        this.message.emit( { role, content } );
    }

    confirmAction (): void {
        if ( !this.pendingAction ) return;
        const { action, param } = this.pendingAction;
        if ( action === 'navigate' ) {
            this.emitNavigation( param );
        } else {
            this.callAction.emit( { action, param } );
        }
        this.pendingAction = null;
        this.showConfirmPrompt = false;
    }

    cancelAction (): void {
        this.pendingAction = null;
        this.showConfirmPrompt = false;
    }

    onAssistantContentClick ( evt: MouseEvent ): void {
        const target = evt.target as HTMLElement | null;
        const routeLink = target?.closest?.( 'a.route-link' ) as HTMLAnchorElement | null;
        if ( !routeLink ) return;

        const dataPath = String( routeLink.getAttribute( 'data-path' ) || routeLink.getAttribute( 'href' ) || '' ).trim();
        const normalized = this.normalizeNavigationTarget( dataPath );
        if ( !normalized ) return;

        evt.preventDefault();
        evt.stopPropagation();
        this.emitNavigation( normalized );
    }

    onPromptChange ( v: string ): void {
        this.assistantPrompt = v;
    }

    applyInline (): void {
        const apply = this.inlineReply?.apply;
        if ( !apply ) return;
        this.emitNavigation( apply );
        this.inlineReply = null;
    }

    resetConversation (): void {
        this.history = [];
        this.inlineReply = null;
        this.pendingAction = null;
        this.assistantPrompt = '';
        this.assistantResponse = '';
        this.showConfirmPrompt = false;
        this.isLoading = false;
    }

    private scheduleAssistantScroll ( delay = 0 ): void {
        if ( this.parentOwnsHistory ) return;
        this.assistantUi.scheduleScrollToBottom( this.messageContainerRef?.nativeElement || null, delay );
    }

    private renderAssistantContent ( content: string ): string {
        const raw = this.boxHelper.normalizeAssistantText( String( content || '' ) );
        if ( !raw ) return '';

        const withInlineMarkdown = this.boxHelper.stripBackticksAroundRoutes( raw )
            .replace( /\*\*(.*?)\*\*/g, '<strong>$1</strong>' );
        const looksHtml = /<\s*[a-zA-Z][\s\S]*?>/.test( raw );
        const html = looksHtml
            ? this.boxHelper.linkifyAppRoutes( withInlineMarkdown )
            : this.boxHelper.convertMarkdownToHtml( withInlineMarkdown );

        return this.boxHelper.normalizeAssistantHtml( html );
    }

    private buildRouteDisplayText ( target: any ): string {
        const normalized = this.normalizeNavigationTarget( target );
        if ( !normalized?.path ) return '';

        const query = normalized.queryParams
            ? new URLSearchParams(
                Object.entries( normalized.queryParams )
                    .filter( ( [_, value] ) => value !== undefined && value !== null && `${value}`.length > 0 )
                    .map( ( [key, value] ) => [key, String( value )] )
            ).toString()
            : '';

        const fragment = normalized.fragment ? `#${normalized.fragment}` : '';
        return `${normalized.path}${query ? `?${query}` : ''}${fragment}`;
    }

    private foldPendingActionIntoAssistantResponse (
        assistantResponse: string | null | undefined,
        pendingAction: { action: string; param: any; } | null | undefined,
        showConfirmPrompt: boolean | null | undefined
    ): { assistantResponse?: string; pendingAction: { action: string; param: any; } | null; showConfirmPrompt: boolean; } {
        const normalizedResponse = typeof assistantResponse === 'string' ? assistantResponse : '';
        const shouldConfirm = !!showConfirmPrompt;

        if ( !pendingAction || !shouldConfirm ) {
            return {
                assistantResponse: normalizedResponse || undefined,
                pendingAction: pendingAction ?? null,
                showConfirmPrompt: shouldConfirm
            };
        }

        if ( pendingAction.action === 'navigate' ) {
            const routeText = this.buildRouteDisplayText( pendingAction.param );
            const alreadyMentionsRoute = !!routeText && normalizedResponse.includes( routeText );
            const augmented = routeText
                ? `${normalizedResponse}${normalizedResponse ? '\n\n' : ''}${alreadyMentionsRoute ? '' : `Go to ${routeText}`}`.trim()
                : normalizedResponse;

            return { assistantResponse: augmented || undefined, pendingAction, showConfirmPrompt: false };
        }

        return { assistantResponse: normalizedResponse || undefined, pendingAction, showConfirmPrompt: false };
    }

    private extractAssistantErrorText ( err: any ): string {
        const parts = [
            err?.error?.message,
            err?.error?.error?.message,
            err?.message,
            err?.statusText,
            typeof err?.error === 'string' ? err.error : '',
        ]
            .filter( Boolean )
            .map( ( value ) => String( value ).toLowerCase() );

        return parts.join( ' ' );
    }

    private formatAssistantError ( err: any, area = 'general' ): string {
        const text = this.extractAssistantErrorText( err );
        const status = Number( err?.status || 0 );
        const looksLikeQuotaOrBilling = status === 429
            || text.includes( 'insufficient_quota' )
            || text.includes( 'quota' )
            || text.includes( 'rate limit' )
            || text.includes( 'too many requests' )
            || text.includes( 'billing' )
            || text.includes( 'credit balance' )
            || text.includes( 'credits' )
            || text.includes( 'exceeded your current quota' );

        if ( looksLikeQuotaOrBilling ) {
            return [
                '<div class="assistant-nudge">',
                '<strong>TODD could not finish that right now.</strong><br>',
                'It looks like the OpenAI Platform account may need attention because the balance, quota, or usage limit was reached.<br>',
                'Please try again shortly.',
                '</div>'
            ].join( '' );
        }

        const areaLabel = area === 'general' ? 'that' : `${area} right now`;
        return `<div class="assistant-nudge">I had trouble helping with ${areaLabel}. Please try again in a moment.</div>`;
    }

    private getCurrentPageSummary (): Record<string, any> {
        const summary = this.pageContext?.summary;
        return summary && typeof summary === 'object' ? summary : {};
    }

    private getCurrentPageDataPreview (): Record<string, any> {
        const dataPreview = this.pageContext?.dataPreview;
        return dataPreview && typeof dataPreview === 'object' ? dataPreview : {};
    }

    private getCurrentPageStats (): Record<string, any> {
        const preview = this.getCurrentPageDataPreview();
        const stats = preview['statsCards'];
        return stats && typeof stats === 'object' ? stats : {};
    }

    private tryAnswerFromPageContext ( raw: string ): string | null {
        const feature = String( this.pageContext?.feature || '' ).toLowerCase();
        if ( feature !== 'contacts' ) return null;

        const summary = this.getCurrentPageSummary();
        const stats = this.getCurrentPageStats();
        const normalized = String( raw || '' ).trim().toLowerCase();

        const totalContacts = Number( summary['totalContacts'] ?? stats['totalContacts'] ?? 0 );
        const validEmailContacts = Number( summary['validEmailContacts'] ?? stats['validEmailContacts'] ?? 0 );
        const enrichedContacts = Number( summary['enrichedContacts'] ?? stats['enrichedContacts'] ?? 0 );
        const filteredCount = Number( summary['filteredCount'] ?? 0 );

        if ( /\bhow many contacts\b/.test( normalized ) || /\bcontact count\b/.test( normalized ) ) {
            return `You have ${totalContacts.toLocaleString()} contacts in Network right now, with ${filteredCount.toLocaleString()} currently in view.`;
        }

        if ( /\b(valid emails?|reachable|reachability)\b/.test( normalized ) ) {
            return `You currently have ${validEmailContacts.toLocaleString()} contacts with valid email addresses ready for outreach.`;
        }

        if ( /\b(enriched|data expanded)\b/.test( normalized ) ) {
            return `TODD shows ${enrichedContacts.toLocaleString()} enriched contacts on this Network view right now.`;
        }

        return null;
    }

    private buildPageContextSnippet (): string {
        const ctx = this.pageContext;
        if ( !ctx || typeof ctx !== 'object' ) return '';

        const lines: string[] = [];
        if ( ctx.feature ) lines.push( `Feature: ${ctx.feature}` );
        if ( ctx.page ) lines.push( `Page: ${ctx.page}` );
        if ( ctx.mode ) lines.push( `Mode: ${ctx.mode}` );
        if ( ctx.title ) lines.push( `Page title: ${ctx.title}` );
        if ( ctx.description ) lines.push( `Page description: ${ctx.description}` );
        if ( ctx.summary ) lines.push( `Page summary: ${JSON.stringify( ctx.summary )}` );
        if ( ctx.dataPreview ) lines.push( `Page data preview: ${JSON.stringify( ctx.dataPreview )}` );

        return lines.length ? `\n\n[page-context]\n${lines.join( '\n' )}` : '';
    }

    private resetAssistantOnlyTranscriptIfContextShifted (): void {
        const nextSignature = this.buildContextSignature();
        const previousSignature = this.lastContextSignature;
        this.lastContextSignature = nextSignature;

        if ( !previousSignature || !nextSignature || previousSignature === nextSignature ) return;

        const hasUserAuthoredConversation = this.history.some( msg => msg.role === 'user' );
        if ( hasUserAuthoredConversation ) return;

        if ( this.history.length === 0 && !this.assistantResponse && !this.inlineReply && !this.pendingAction ) return;

        this.resetConversation();
    }

    private buildContextSignature (): string | null {
        const ctx = this.pageContext;
        if ( !ctx || typeof ctx !== 'object' ) return null;

        const summary = ctx.summary && typeof ctx.summary === 'object' ? ctx.summary : {};
        const signature = {
            feature: String( ctx.feature || '' ),
            page: String( ctx.page || '' ),
            route: String( ctx.route || '' ),
            mode: String( ctx.mode || '' ),
            summary: {
                totalContacts: summary['totalContacts'] ?? null,
                filteredCount: summary['filteredCount'] ?? null,
            }
        };

        try {
            return JSON.stringify( signature );
        } catch {
            return `${signature.feature}|${signature.page}|${signature.route}|${signature.mode}`;
        }
    }

    // Core: delegate to Engine ------------------------------------------------
    async askAssistant (): Promise<void> {
        const raw = ( this.assistantPrompt || '' ).trim();
        if ( !raw ) return;

        if ( !this.parentOwnsHistory ) {
            this.history.push( { role: 'user', content: raw } );
        } else {
            this.message.emit( { role: 'user', content: raw } );
        }

        const ctx: AssistantEngineContext = {
            rawPrompt: raw,
            userId: this.userId,
            externalMode: !!this.externalMode,
            parentOwnsHistory: !!this.parentOwnsHistory,
        };

        const patches: AssistantEnginePatches = {
            setLoading: ( v ) => { this.isLoading = v; },
            setAssistantPrompt: ( v ) => { this.assistantPrompt = v; },
            setAssistantResponse: ( v ) => {
                const rendered = this.renderAssistantContent( v || '' );
                this.assistantResponse = rendered;
                if ( !this.parentOwnsHistory && rendered ) {
                    this.history.push( { role: 'assistant', content: rendered } );
                    this.scheduleAssistantScroll( 40 );
                } else if ( rendered ) {
                    this.message.emit( { role: 'assistant', content: rendered } );
                }
            },
            setPendingAction: ( v ) => { this.pendingAction = v; },
            setInlineReply: ( v ) => { this.inlineReply = v; },
            setShowConfirmPrompt: ( v ) => { this.showConfirmPrompt = !!v; },
            patchState: ( p ) => {
                const folded = this.foldPendingActionIntoAssistantResponse(
                    p.assistantResponse,
                    p.pendingAction !== undefined ? p.pendingAction : this.pendingAction,
                    p.showConfirmPrompt !== undefined ? p.showConfirmPrompt : this.showConfirmPrompt
                );

                if ( folded.assistantResponse !== undefined ) patches.setAssistantResponse( folded.assistantResponse || '' );
                if ( p.assistantResponse === undefined && folded.assistantResponse ) {
                    patches.setAssistantResponse( folded.assistantResponse );
                }
                if ( p.pendingAction !== undefined ) this.pendingAction = folded.pendingAction;
                if ( p.inlineReply !== undefined ) this.inlineReply = p.inlineReply;
                if ( p.showConfirmPrompt !== undefined || p.pendingAction !== undefined ) this.showConfirmPrompt = !!folded.showConfirmPrompt;
            },
            enforceExternalModeUiGuards: () => {
                if ( !this.externalMode ) return;
                this.pendingAction = null;
                this.showConfirmPrompt = false;
                this.inlineReply = null;
            },
        };

        const io: AssistantEngineIO = {
            pushLocalHistory: ( role, content ) => {
                if ( !this.parentOwnsHistory ) {
                    this.history.push( { role, content } );
                    this.scheduleAssistantScroll( 40 );
                } else {
                    this.message.emit( { role, content } );
                }
            },
            emitMessage: ( role, content ) => {
                if ( !this.parentOwnsHistory ) {
                    this.history.push( { role, content } );
                    this.scheduleAssistantScroll( 40 );
                } else {
                    this.message.emit( { role, content } );
                }
            },
            scheduleScrollToBottom: () => { this.scheduleAssistantScroll( 40 ); },
            scrollHistoryToBottom: () => { this.scheduleAssistantScroll( 40 ); },
            clearSuggestions: () => { /* suggestions not implemented in this shell */ },
        };

        const helpers: AssistantEngineHelpers = {
            tryDirectNavCommand: ( prompt: string ) => {
                const res = this.capabilities.tryDirectNavCommand( prompt );
                if ( !res.handled ) return false;
                if ( res.kind === 'message' ) {
                    patches.setAssistantResponse( res.message );
                    patches.setPendingAction( null );
                    patches.setShowConfirmPrompt( false );
                    return true;
                }
                if ( res.kind === 'navigate' ) {
                    patches.patchState( { pendingAction: { action: 'navigate', param: res.path }, showConfirmPrompt: true } );
                    return true;
                }
                return false;
            },
            runGlobalPreChecks: ( raw: string ) => {
                const pageContextAnswer = this.tryAnswerFromPageContext( raw );
                if ( pageContextAnswer ) {
                    patches.setAssistantResponse( pageContextAnswer );
                    patches.setPendingAction( null );
                    patches.setShowConfirmPrompt( false );
                    io.scheduleScrollToBottom( true );
                    return true;
                }

                const workflowGuide = this.capabilities.tryWorkflowGuide( raw );
                if ( workflowGuide.handled && workflowGuide.kind === 'message' ) {
                    patches.setAssistantResponse( this.boxHelper.normalizeAssistantHtml( workflowGuide.message ) );
                    patches.setPendingAction( null );
                    patches.setShowConfirmPrompt( false );
                    io.scheduleScrollToBottom( true );
                    return true;
                }

                const routeIntentGuide = this.capabilities.tryRouteIntentGuide( raw );
                if ( routeIntentGuide.handled && routeIntentGuide.kind === 'message' ) {
                    patches.setAssistantResponse( this.boxHelper.normalizeAssistantHtml( routeIntentGuide.message ) );
                    patches.setPendingAction( null );
                    patches.setShowConfirmPrompt( false );
                    io.scheduleScrollToBottom( true );
                    return true;
                }

                const html = this.boxHelper.tryWhatWorkIntent( raw );
                if ( !html ) return false;
                patches.setAssistantResponse( this.boxHelper.normalizeAssistantHtml( html ) );
                patches.setPendingAction( null );
                patches.setShowConfirmPrompt( false );
                io.scheduleScrollToBottom( true );
                return true;
            },
            tryContactFilterLocalIntent: ( raw: string ) => {
                const parsed = this.contactLocal.tryFilterParse( raw );
                if ( !parsed || !parsed.handled ) return null;
                if ( parsed.value ) {
                    try { this.emitNavigation( { path: '/contact-list', params: parsed.filters } ); } catch { }
                    return { handled: true, responseHtml: parsed.message || '', pendingAction: null } as any;
                }
                patches.patchState( { assistantResponse: parsed.message || '', pendingAction: null, showConfirmPrompt: true } );
                this.inlineReply = { kind: 'navigateWithFilters', payload: parsed.filters, apply: { route: '/contact-list', param: parsed.filters } };
                return { handled: true, responseHtml: parsed.message || '', pendingAction: null } as any;
            },
            contactLocalDeep: async ( raw: string ) => {
                const res = await this.contactLocal.tryLocal( raw, this.tenantId || '' );
                return res ? ( res as any ) : null;
            },
            routeDomain: ( raw: string ) => this.intentRunner.routeDomain( raw ),
            handleContactLLMIntent: ( raw: string ) => {
                this.openAISubscription?.unsubscribe?.();
                const promptWithContext = raw;
                const history = this.buildHistoryForLLM();
                this.openAISubscription = this.contactLLM.run( {
                    promptWithContext,
                    userId: this.userId || 'UI',
                    history,
                    selectedContact: null,
                    setLoading: ( v ) => ( this.isLoading = v ),
                    patchState: ( p ) => patches.patchState( p as any ),
                    emitAssistant: ( html ) => io.emitMessage( 'assistant', html ),
                    onError: ( err ) => { this.isLoading = false; patches.setAssistantResponse( this.formatAssistantError( err, 'contacts' ) ); }
                } );
            },
            buildUiHint: () => '',
            withUserContext: ( p ) => `${p}${this.buildPageContextSnippet()}`,
            onSystemTrouble: ( raw: string ) => {
                if ( !this.systemRecovery.isSystemTrouble( raw ) ) return false;
                patches.setAssistantResponse( 'Looks like something’s off. Want to troubleshoot?' );
                return true;
            },
            cancelInFlight: () => { try { this.openAISubscription?.unsubscribe?.(); } catch { } this.openAISubscription = null; },
            replaceOpenAISubscription: ( s: Subscription | null ) => { this.openAISubscription = s; },
            runGeneralLLM: ( { promptForLLM, setLoading, emitAssistant, onError } ) => {
                setLoading( true );
                const data = {
                    history: this.buildHistoryForLLM(),
                    pageContext: this.pageContext || null
                };
                const sub = this.openAIService.getAssistance( promptForLLM, 'general', this.userId || 'UI', data ).subscribe( {
                    next: ( res: any ) => {
                        setLoading( false );
                        let out = '';
                        if ( res && typeof res === 'object' && res.response ) {
                            out = String( res.response );
                        } else {
                            out = typeof res === 'string' ? res : JSON.stringify( res || '' );
                        }
                        emitAssistant( out );
                    },
                    error: ( err: any ) => { onError( { ...err, toddUserMessage: this.formatAssistantError( err, 'general' ) } ); }
                } );
                this.openAISubscription = sub;
                return sub;
            },
            formatAssistantError: ( err, area ) => this.formatAssistantError( err, area ),
        };

        await this.engine.run( ctx, patches, io, helpers );

        this.assistantPrompt = '';
    }

    private buildHistoryForLLM (): Array<ChatMsg> {
        if ( !this.history?.length ) return [];
        const stripHtml = ( html: string ) => html.replace( /<[^>]*>/g, '' );
        return this.history.slice( -6 ).map( m => ( { role: m.role, content: stripHtml( m.content || '' ).slice( 0, 1000 ) } ) );
    }
}
