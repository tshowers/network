import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Nomenclature } from '../../models/nomenclature.model';
import { NetworkNomenclatureService } from '../../services/network-nomenclature.service';
import { Observable, Subscription } from 'rxjs';
import { ChoiceFieldComponent, ChoiceOption } from '../choice-field/choice-field.component';

/** Ported from shared/page/status-flow/status-flow.component.ts - logic unchanged. */
@Component( {
  selector: 'app-status-flow',
  standalone: true,
  imports: [FormsModule, CommonModule, ChoiceFieldComponent],
  templateUrl: './status-flow.component.html',
  styleUrl: './status-flow.component.css'
} )
export class StatusFlowComponent implements OnInit, OnDestroy {

  @Input() mode: 'view' | 'input' = 'view';
  @Input() currentStatus: string = '';
  @Input() userStatuses: { name: string; }[] = [];
  @Input() viewMode: 'flow' | 'single' = 'flow';
  /** Input mode: open the stage list right away (contact list's Set stage). */
  @Input() startExpanded = false;
  /** Input mode: just the list of stages, no chevron row. */
  @Input() listOnly = false;
  @Output() statusChange = new EventEmitter<string>();

  nomenclature$: Observable<Nomenclature>;
  nomenclatureSubscription!: Subscription;
  nomenclature!: Nomenclature;


  readonly pipelineStages: string[] = [
    'Lead Generation',
    'Qualification',
    'Engagement',
    'Proposal',
    'Negotiation',
    'Closing',
    'Post-Sale',
    'Closed Won'
  ];

  constructor ( private nomenclatureService: NetworkNomenclatureService ) {
    this.nomenclature$ = this.nomenclatureService.currentNomenclature$;
  }

  ngOnInit (): void {
    this.nomenclatureSubscription = this.nomenclature$.subscribe( settings => {
      this.nomenclature = settings;
    } );

  }

  ngOnDestroy (): void {
    if ( this.nomenclatureSubscription )
      this.nomenclatureSubscription.unsubscribe();
  }


  get userDefinedStatuses (): string[] {
    if ( !Array.isArray( this.userStatuses ) ) {
      return [];
    }

    return this.userStatuses
      .map( status => status.name )
      .filter( name => !!name && name.trim() && !this.pipelineStages.includes( name ) );
  }

  /** Input mode's choices: the pipeline stages (in the user's own wording)
   * plus any custom statuses they've defined. */
  get stageOptions (): ChoiceOption[] {
    return [
      ...this.pipelineStages.map( ( stage ) => ( { value: stage, label: this.getNomenclatureLabel( stage ) } ) ),
      ...this.userDefinedStatuses.map( ( status ) => ( { value: status, label: status } ) ),
    ];
  }

  get isCustomStatusInView (): boolean {
    return this.mode === 'view' &&
      !this.pipelineStages.includes( this.currentStatus ) &&
      !this.userDefinedStatuses.includes( this.currentStatus );
  }

  getNomenclatureLabel ( stageName: string ): string {
    const normalizedStage = stageName.trim().toLowerCase();

    const stageKeyMap: { [key: string]: keyof Nomenclature; } = {
      'lead generation': 'lead',
      'qualification': 'qualification',
      'engagement': 'engaged',
      'proposal': 'proposal',
      'negotiation': 'negotiation',
      'closing': 'closing',
      'post-sale': 'post',
      'closed won': 'closed'
    };

    const key = stageKeyMap[normalizedStage];
    return key ? ( this.nomenclature?.[key] || stageName ) : stageName;
  }
}
