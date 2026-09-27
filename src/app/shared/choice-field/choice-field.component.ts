import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface ChoiceOption {
  value: string;
  label: string;
}

let nextChoiceFieldId = 0;

/**
 * The one way Network asks for a choice instead of a form control: tap,
 * don't type. Five options or fewer render as chips; more than five render
 * as a row showing the current choice with a chevron that expands the full
 * list inline (no popup). `allowOther` adds an "Other" choice that reveals a
 * text box for a custom value. Used on contact edit (stage, category, email
 * and phone types, gender), the contact list's Set stage, and the pipeline.
 */
@Component( {
  selector: 'app-choice-field',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './choice-field.component.html',
  styleUrl: './choice-field.component.css',
} )
export class ChoiceFieldComponent implements OnInit {
  @Input() label = '';
  @Input() options: ChoiceOption[] = [];
  @Input() value = '';
  /** Label for a free-text "Other" choice; empty = no Other. */
  @Input() allowOther = '';
  @Input() otherPlaceholder = 'Type your own';
  /** Shown on the chevron row when nothing is chosen yet. */
  @Input() placeholder = 'Choose';
  /** Chips up to this many choices (Other included), chevron list above it. */
  @Input() chipThreshold = 5;
  /** Start the chevron list open (e.g. the contact list's Set stage). */
  @Input() startExpanded = false;
  /** Show only the open list, no chevron row - when something else (like
   * the contact list's Set stage button) is already the toggle. */
  @Input() listOnly = false;
  @Output() valueChange = new EventEmitter<string>();

  @ViewChild( 'otherInput' ) otherInput?: ElementRef<HTMLInputElement>;

  readonly id = `choice-field-${nextChoiceFieldId++}`;
  expanded = false;
  private otherActive = false;

  ngOnInit (): void {
    this.expanded = this.startExpanded || this.listOnly;
    this.otherActive = !!this.allowOther && !!this.value && !this.isPreset( this.value );
  }

  get useChips (): boolean {
    return this.options.length + ( this.allowOther ? 1 : 0 ) <= this.chipThreshold;
  }

  get isOther (): boolean {
    return this.otherActive;
  }

  get currentLabel (): string {
    if ( !this.value ) return '';
    return this.options.find( ( option ) => option.value === this.value )?.label || this.value;
  }

  isSelected ( option: ChoiceOption ): boolean {
    return !this.otherActive && option.value === this.value;
  }

  choose ( option: ChoiceOption ): void {
    this.otherActive = false;
    this.value = option.value;
    this.valueChange.emit( option.value );
    this.expanded = false;
  }

  chooseOther (): void {
    if ( !this.otherActive ) {
      this.otherActive = true;
      if ( this.isPreset( this.value ) ) {
        this.value = '';
        this.valueChange.emit( '' );
      }
    }
    setTimeout( () => this.otherInput?.nativeElement.focus(), 0 );
  }

  onOtherInput ( text: string ): void {
    this.value = text;
    this.valueChange.emit( text );
  }

  toggle (): void {
    this.expanded = !this.expanded;
  }

  private isPreset ( value: string ): boolean {
    return this.options.some( ( option ) => option.value === value );
  }
}
