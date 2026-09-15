import { Injectable } from '@angular/core';

export type MomentumNudge = {
  id: string;
  message: string;
  action?: {
    type: 'navigate';
    param: any;
  };
};

/**
 * Trimmed port of TODD's MomentumNudgeService. The original tracks
 * contact/task/survey question counts across three domains; this app only
 * ever has contacts, so the other two kinds are dropped rather than kept as
 * dead counters.
 */
@Injectable( { providedIn: 'root' } )
export class MomentumNudgeService {

  private contactQuestionCount = 0;
  private lastNudgeAt = 0;
  private nudgeCooldownMs = 1000 * 60 * 3; // 3 minutes

  register ( context: { warmContactsCount?: number; } = {} ): MomentumNudge | null {
    this.contactQuestionCount++;

    const now = Date.now();
    if ( now - this.lastNudgeAt < this.nudgeCooldownMs ) {
      return null; // don't nag
    }

    if ( this.contactQuestionCount >= 3 && ( context.warmContactsCount || 0 ) > 0 ) {
      this.lastNudgeAt = now;
      this.contactQuestionCount = 0;
      return {
        id: 'warm-contacts',
        message: "You've been checking people a lot. Want me to show you the warmest contacts to focus on?",
        action: {
          type: 'navigate',
          param: '/contact-list?warm=true'
        }
      };
    }

    return null;
  }
}
