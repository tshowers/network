import { Injectable } from '@angular/core';
import { Subscription } from 'rxjs';

import { OpenAIService } from './open-ai.service';
import { AssistantBoxHelperService } from './assistant-box-helper.service';
import { LoggerService } from './logger.service';

export type AssistantMessage = { role: 'user' | 'assistant'; content: string; };
export type AssistantUiPatch = Partial<{
  assistantResponse: string;
  pendingAction: { action: string; param: any; } | null;
  inlineReply: any | null;
  showConfirmPrompt: boolean;
}>;

export type RunContactArgs = {
  promptWithContext: string;
  userId: string;
  history: AssistantMessage[];
  selectedContact?: any | null;

  setLoading: ( v: boolean ) => void;
  patchState: ( patch: AssistantUiPatch ) => void;
  emitAssistant?: ( assistantHtml: string ) => void;
  onError: ( err: any ) => void;
};

/**
 * Port of TODD's ContactLLMService, unchanged - it only ever depended on
 * OpenAIService/AssistantBoxHelperService/LoggerService, so it was already
 * scoped to just the Contact domain.
 */
@Injectable( { providedIn: 'root' } )
export class ContactLLMService {
  constructor (
    private openAIService: OpenAIService,
    private assistantBoxHelper: AssistantBoxHelperService,
    private logger: LoggerService
  ) { }

  run ( args: RunContactArgs ): Subscription {
    const {
      promptWithContext,
      userId,
      history,
      selectedContact,
      setLoading,
      patchState,
      onError
    } = args;

    setLoading( true );
    patchState( { assistantResponse: '', pendingAction: null, inlineReply: null, showConfirmPrompt: false } );

    const context = selectedContact ? { contacts: [selectedContact] } : null;
    const data = { ...( context || {} ), history };

    return this.openAIService.getContactAssistantResponse( promptWithContext, userId, data ).subscribe( {
      next: ( res: any ) => {
        setLoading( false );
        const content: any = res?.parsedQuery ?? res ?? {};

        if ( content.route && !content.action ) {
          const [path, fragment] = String( content.route ).split( '#' );
          const routeStr = fragment ? `${path}#${fragment}` : path;

          if ( content.param && typeof content.param === 'object' ) {
            const inlineReply = {
              kind: 'navigateWithFilters',
              payload: content.param,
              apply: { route: routeStr, param: content.param }
            };

            const html = this.assistantBoxHelper.normalizeAssistantHtml(
              this.assistantBoxHelper.convertMarkdownToHtml(
                this.assistantBoxHelper.parseAssistantResponse( content )
              )
            ) || 'Open the filtered contact list?';

            patchState( { inlineReply, assistantResponse: html, showConfirmPrompt: false, pendingAction: null } );
            return;
          }

          const html = this.assistantBoxHelper.normalizeAssistantHtml(
            this.assistantBoxHelper.convertMarkdownToHtml(
              this.assistantBoxHelper.parseAssistantResponse( content )
            )
          ) || 'I found something for you.';

          patchState( {
            pendingAction: { action: 'navigate', param: routeStr },
            assistantResponse: html,
            showConfirmPrompt: true,
            inlineReply: null
          } );
          return;
        }

        if ( content.action ) {
          const html = this.assistantBoxHelper.normalizeAssistantHtml(
            this.assistantBoxHelper.convertMarkdownToHtml(
              this.assistantBoxHelper.parseAssistantResponse( content )
            )
          ) || 'Proceed with this action?';

          patchState( {
            pendingAction: { action: content.action, param: content.param },
            assistantResponse: html,
            showConfirmPrompt: true,
            inlineReply: null
          } );
          return;
        }

        const message = this.assistantBoxHelper.parseAssistantResponse( content );
        if ( message ) {
          const html = this.assistantBoxHelper.normalizeAssistantHtml(
            this.assistantBoxHelper.convertMarkdownToHtml( message )
          );
          patchState( { assistantResponse: html } );
        }

        patchState( { showConfirmPrompt: false } );
      },
      error: ( err: any ) => {
        this.logger.error( 'CONTACT_LLM_ERROR', err );
        onError( err );
      }
    } );
  }
}
