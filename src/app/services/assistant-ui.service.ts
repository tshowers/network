import { Injectable } from '@angular/core';

@Injectable( { providedIn: 'root' } )
export class AssistantUiService {
    scheduleScrollToBottom ( element: HTMLElement | null, delay = 0 ): void {
        setTimeout( () => this.scrollToBottom( element ), delay );
    }

    /**
     * Brings the newest message into view. A reply is aligned to its top so
     * a long answer reads from the start; the user's own message is aligned
     * to its bottom. With no thread rendered yet this is a no-op - it used to
     * fall back to scrolling the whole page, which yanked the page under the
     * chat window on the first message.
     */
    scrollToBottom ( element: HTMLElement | null ): void {
        try {
            if ( !element ) return;
            const bubbles = element.querySelectorAll( '.assistant-message' );
            const last = bubbles.length ? bubbles[bubbles.length - 1] as HTMLElement : null;
            if ( !last ) {
                element.scrollTop = element.scrollHeight;
                return;
            }
            const isAssistant = last.classList.contains( 'assistant-message-assistant' );
            last.scrollIntoView( { behavior: 'smooth', block: isAssistant ? 'start' : 'end' } );
        } catch {
            // ignore
        }
    }
}
