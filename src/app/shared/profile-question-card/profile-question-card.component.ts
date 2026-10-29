import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  PROFILE_AI_QUESTIONS,
  ProfileAiField,
  ProfileChoice,
  ProfileQuestion,
  ToddProfile,
  computeProfileCompletion,
  fillProfileChoice,
} from '@taliferro/ui/platform/profile-choices.model';

import { ProfileApiService } from '../../services/profile-api.service';
import { WriteActionDirective } from '../write-access/write-action.directive';

/**
 * Asks the four profile questions TODD's AI writes from, one at a time
 * (design_handoff_network_onboarding 04 "While TODD works", 07 Profile).
 * Saves each answer to the shared profile on "Save and next" - optimistic,
 * then PATCH /api/profile; "Later" moves on without saving. Saving needs
 * Network (appWriteAction), like every other write.
 */
@Component( {
  selector: 'app-profile-question-card',
  standalone: true,
  imports: [FormsModule, RouterLink, WriteActionDirective],
  templateUrl: './profile-question-card.component.html',
  styleUrl: './profile-question-card.component.css',
} )
export class ProfileQuestionCardComponent {
  @Input( { required: true } ) profile!: ToddProfile;
  @Input() heading = 'How well 16Ahead knows you';
  @Input() showProfileLink = false;
  /** Jump to this question (the profile page's "Answer" buttons). */
  @Input() set ask ( field: ProfileAiField | null ) {
    if ( !field ) return;
    this.index = Math.max( 0, PROFILE_AI_QUESTIONS.findIndex( ( q ) => q.field === field ) );
    this.resetDraft();
  }
  @Output() readonly saved = new EventEmitter<ToddProfile>();

  private readonly api = inject( ProfileApiService );

  readonly questions = PROFILE_AI_QUESTIONS;
  index = 0;
  draft = '';
  pickedChoice: string | null = null;
  isSaving = false;
  errorMessage = '';

  private isAnswered ( question: ProfileQuestion ): boolean {
    return !!( this.profile?.[question.field] || '' ).trim();
  }

  /** The question on screen: the selected one, or the next unanswered one after it. */
  get question (): ProfileQuestion | null {
    for ( let k = 0; k < this.questions.length; k++ ) {
      const q = this.questions[( this.index + k ) % this.questions.length];
      if ( !this.isAnswered( q ) ) return q;
    }
    return null;
  }

  get answeredCount (): number {
    return this.questions.filter( ( q ) => this.isAnswered( q ) ).length;
  }

  get remaining (): number {
    return this.questions.length - this.answeredCount;
  }

  get completion () {
    return computeProfileCompletion( this.profile );
  }

  choiceText ( choice: ProfileChoice ): string {
    return fillProfileChoice( choice, this.profile?.companyName || '' );
  }

  pick ( choice: ProfileChoice ): void {
    this.pickedChoice = choice.label;
    this.draft = this.choiceText( choice );
  }

  onType (): void {
    this.pickedChoice = null;
  }

  skip (): void {
    const q = this.question;
    if ( !q ) return;
    this.index = ( this.questions.indexOf( q ) + 1 ) % this.questions.length;
    this.resetDraft();
  }

  async save (): Promise<void> {
    const q = this.question;
    const answer = this.draft.trim();
    if ( !q || !answer || this.isSaving ) return;

    const before = this.profile;
    const next: ToddProfile = { ...this.profile, [q.field]: answer };
    this.profile = next;
    this.index = ( this.questions.indexOf( q ) + 1 ) % this.questions.length;
    this.resetDraft();
    this.saved.emit( next );

    this.isSaving = true;
    this.errorMessage = '';
    try {
      this.saved.emit( await this.api.save( next ) );
    } catch ( error: any ) {
      this.profile = before;
      this.saved.emit( before );
      this.errorMessage = error?.error?.message || error?.message || 'We could not save that answer.';
    } finally {
      this.isSaving = false;
    }
  }

  private resetDraft (): void {
    this.draft = '';
    this.pickedChoice = null;
  }
}
