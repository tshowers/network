import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { NetworkAuthService } from '../../services/network-auth.service';
import { HELP_OPTIONS, OnboardingProfileDraft, OnboardingProfileService, ROLE_OPTIONS } from '../../services/onboarding-profile.service';

type StepKey = 'firstName' | 'lastName' | 'role' | 'company' | 'helpWith' | 'timezone' | 'signIn';

interface Section { key: string; title: string; }

interface Step {
  key: StepKey;
  section: number;
  question: string;
  hint: string;
  optional?: boolean;
}

/**
 * Pre-sign-in onboarding wizard - the web twin of network-ios's
 * OnboardingWizardView (itself modeled on pulse-ios's pre-auth survey
 * builder). One question per screen under a 4-segment progress bar whose
 * first segment ("Start") is already complete when the page opens, so
 * every visitor begins a quarter of the way done. The questions mirror
 * TODD's first-login profile wizard (update-profile.component.ts); the
 * answers are saved to the TODD profile after sign-in by
 * OnboardingProfileService.submitIfPending() in AuthCallbackComponent.
 *
 * Returning users skip straight to /login via "Already have an account?".
 */
@Component( {
  selector: 'app-get-started',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './get-started.component.html',
  styleUrl: './get-started.component.css',
} )
export class GetStartedComponent implements OnInit {
  @ViewChild( 'answerInput' ) answerInput?: ElementRef<HTMLInputElement>;

  readonly sections: Section[] = [
    { key: 'start', title: 'Start' },
    { key: 'about', title: 'About you' },
    { key: 'business', title: 'Business' },
    { key: 'setup', title: 'Get set up' },
  ];

  readonly steps: Step[] = [
    { key: 'firstName', section: 1, question: "What's your first name?", hint: 'Network and Maya use it to personalize everything you send.' },
    { key: 'lastName', section: 1, question: 'And your last name?', hint: '' },
    { key: 'role', section: 1, question: "What's your role?", hint: 'Pick the closest fit.' },
    { key: 'company', section: 2, question: "What's your company called?", hint: "We'll use it when Maya drafts outreach for you.", optional: true },
    { key: 'helpWith', section: 2, question: 'What do you want Network to help you with?', hint: 'Pick as many as you like.' },
    { key: 'timezone', section: 3, question: 'What timezone is your workday in?', hint: 'So reminders and follow-ups land during your business hours.' },
    { key: 'signIn', section: 3, question: 'Last step: create your account', hint: 'Sign in with TODD to save your answers and open Network.' },
  ];

  readonly roleOptions = ROLE_OPTIONS;
  readonly helpOptions = HELP_OPTIONS;
  readonly timezones: string[] = this.supportedTimezones();

  draft!: OnboardingProfileDraft;
  stepIndex = 0;
  isSigningIn = false;

  private returnUrl = '/app';

  constructor (
    private readonly route: ActivatedRoute,
    private readonly title: Title,
    private readonly authService: NetworkAuthService,
    private readonly onboarding: OnboardingProfileService,
  ) { }

  ngOnInit (): void {
    this.title.setTitle( 'Get started — Network | Taliferro Tech' );
    this.returnUrl = this.route.snapshot.queryParamMap.get( 'returnUrl' ) || '/app';
    this.draft = this.onboarding.load();
    if ( !this.draft.timezone ) this.draft.timezone = this.onboarding.detectTimezone();
    if ( this.draft.timezone && !this.timezones.includes( this.draft.timezone ) ) {
      this.timezones.unshift( this.draft.timezone );
    }
    this.focusAnswer();
  }

  get step (): Step {
    return this.steps[this.stepIndex];
  }

  get isTextStep (): boolean {
    return ['firstName', 'lastName', 'company'].includes( this.step.key )
      || ( this.step.key === 'role' && this.hasCustomRole );
  }

  get textValue (): string {
    switch ( this.step.key ) {
      case 'firstName': return this.draft.firstName;
      case 'lastName': return this.draft.lastName;
      case 'role': return this.draft.role;
      case 'company': return this.draft.companyName;
      default: return '';
    }
  }

  set textValue ( value: string ) {
    switch ( this.step.key ) {
      case 'firstName': this.draft.firstName = value; break;
      case 'lastName': this.draft.lastName = value; break;
      case 'role': this.draft.role = value; break;
      case 'company': this.draft.companyName = value; break;
    }
    this.persist();
  }

  get textAutocomplete (): string {
    switch ( this.step.key ) {
      case 'firstName': return 'given-name';
      case 'lastName': return 'family-name';
      case 'role': return 'organization-title';
      case 'company': return 'organization';
      default: return 'off';
    }
  }

  get canAdvance (): boolean {
    switch ( this.step.key ) {
      case 'firstName': return !!this.draft.firstName.trim();
      case 'lastName': return !!this.draft.lastName.trim();
      case 'role': return !!this.draft.role.trim();
      case 'helpWith': return this.draft.helpWith.length > 0 || !!this.draft.helpNote.trim();
      case 'timezone': return !!this.draft.timezone;
      default: return true;
    }
  }

  /** 0...1 fill of a progress segment - earlier sections are full, the
   * active one fills partially as its screens are completed. */
  sectionFill ( index: number ): number {
    if ( index < this.step.section ) return 1;
    if ( index > this.step.section ) return 0;
    const siblings = this.steps.filter( ( s ) => s.section === index );
    return ( siblings.indexOf( this.step ) + 1 ) / ( siblings.length + 1 );
  }

  next (): void {
    if ( !this.canAdvance || this.stepIndex >= this.steps.length - 1 ) return;
    this.stepIndex++;
    if ( this.step.key === 'signIn' ) {
      this.draft.readyToSubmit = true;
      this.persist();
    }
    this.focusAnswer();
  }

  skip (): void {
    this.stepIndex++;
    this.focusAnswer();
  }

  back (): void {
    if ( this.stepIndex > 0 ) {
      this.stepIndex--;
      this.focusAnswer();
    }
  }

  /** True when the role is a custom one typed under "Other". */
  get hasCustomRole (): boolean {
    return !this.roleOptions.includes( this.draft.role );
  }

  selectRole ( option: string ): void {
    this.draft.role = option;
    this.persist();
  }

  selectOtherRole (): void {
    if ( !this.hasCustomRole ) {
      this.draft.role = '';
      this.persist();
    }
    this.focusAnswer();
  }

  toggleHelp ( option: string ): void {
    const selected = this.draft.helpWith;
    this.draft.helpWith = selected.includes( option )
      ? selected.filter( ( item ) => item !== option )
      : [...selected, option];
    this.persist();
  }

  persist (): void {
    this.onboarding.save( this.draft );
  }

  timezoneLabel ( zone: string ): string {
    return zone.replace( /_/g, ' ' );
  }

  signIn (): void {
    this.isSigningIn = true;
    this.persist();
    this.authService.signIn( this.returnUrl );
  }

  private focusAnswer (): void {
    setTimeout( () => this.answerInput?.nativeElement.focus(), 0 );
  }

  private supportedTimezones (): string[] {
    try {
      const intl = Intl as unknown as { supportedValuesOf?: ( key: string ) => string[] };
      return intl.supportedValuesOf ? [...intl.supportedValuesOf( 'timeZone' )] : [];
    } catch {
      return [];
    }
  }
}
