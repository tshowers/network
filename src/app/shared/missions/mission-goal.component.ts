import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';

import { MissionsApiService } from './missions-api.service';
import { GoalMeasure, MissionView } from './missions.model';

interface MeasureRow { metric: string; label: string; target: number; value: number; met: boolean; pct: number }

/**
 * A Mission's goal (Ty, 2026-11-05): what success means, counted from what
 * the Mission really did, so "Done" never hides a goal it missed. The owner
 * can change the targets until it finishes. Synced from Moves.
 */
@Component( {
  selector: 'tm-mission-goal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (view(); as g) {
      <section class="goal" data-cy="mission-goal" [attr.data-met]="g.verdict">
        <div class="head">
          <h2>Goal</h2>
          @if (g.verdict === 'met') { <span class="pill met" data-cy="goal-verdict">Met</span> }
          @if (g.verdict === 'missed') { <span class="pill missed" data-cy="goal-verdict">Not met</span> }
          @if (canEdit() && !editing() && g.rows.length) { <button type="button" class="link" (click)="startEdit()" data-cy="goal-edit">Change targets</button> }
        </div>
        @if (g.statement) { <p class="statement" data-cy="goal-statement">{{ g.statement }}</p> }
        @if (editing()) {
          <div class="edit" data-cy="goal-editor">
            @for (r of draft(); track r.metric; let i = $index) {
              <label><span>{{ r.label }}</span>
                <input type="number" min="1" step="1" [value]="r.target" (input)="setTarget(i, $event)" [attr.data-cy]="'goal-target-' + r.metric" />
              </label>
            }
            <div class="actions">
              <button type="button" class="btn primary" (click)="save()" [disabled]="busy()" data-cy="goal-save">Save</button>
              <button type="button" class="btn" (click)="editing.set(false)" [disabled]="busy()">Cancel</button>
            </div>
            @if (error()) { <p class="error">{{ error() }}</p> }
          </div>
        } @else if (g.rows.length) {
          <div class="measures">
            @for (r of g.rows; track r.metric) {
              <div class="measure" [class.met]="r.met" data-cy="goal-measure">
                <div class="nums"><b>{{ r.value }}</b><span>/ {{ r.target }}</span></div>
                <span class="label">{{ r.label }}</span>
                <span class="bar"><span [style.width.%]="r.pct"></span></span>
              </div>
            }
          </div>
        } @else {
          <p class="muted">Nothing here that 16Ahead can count, so it's judged by its steps.</p>
        }
      </section>
    }
  `,
  styles: [`
    :host { display: block; }
    .goal { padding: 18px 20px; border-radius: 16px; background: var(--surface); display: flex; flex-direction: column; gap: 10px; }
    .head { display: flex; align-items: center; gap: 10px; }
    h2 { font-size: 20px; font-weight: 800; margin: 0; }
    .pill { height: 26px; padding: 0 12px; border-radius: 999px; font-size: 13px; font-weight: 700; display: inline-flex; align-items: center; }
    .pill.met { background: rgba(60, 207, 142, .18); color: #1f9d68; }
    .pill.missed { background: rgba(229, 72, 77, .15); color: #c9363b; }
    .link { margin-left: auto; border: 0; background: none; color: inherit; font: inherit; font-size: 13px; font-weight: 700; text-decoration: underline; cursor: pointer; }
    .statement { margin: 0; font-size: 15px; }
    .measures { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; }
    .measure { display: flex; flex-direction: column; gap: 4px; padding: 12px 14px; border-radius: 12px; background: var(--bg, rgba(255, 255, 255, .5)); }
    .nums b { font-size: 24px; font-weight: 800; }
    .nums span { margin-left: 4px; color: var(--muted); font-weight: 600; }
    .label { font-size: 13px; color: var(--muted); font-weight: 600; }
    .bar { height: 6px; border-radius: 3px; background: rgba(128, 128, 128, .2); overflow: hidden; }
    .bar span { display: block; height: 100%; background: var(--blue, #5b4cf5); }
    .measure.met .bar span { background: #3ccf8e; }
    .edit { display: flex; flex-direction: column; gap: 10px; }
    .edit label { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-weight: 600; }
    .edit input { width: 110px; height: 40px; padding: 0 12px; border-radius: 10px; border: 1px solid rgba(128, 128, 128, .35); background: transparent; color: inherit; font: inherit; }
    .actions { display: flex; gap: 8px; }
    .btn { height: 40px; padding: 0 18px; border-radius: 999px; border: 0; font: inherit; font-weight: 700; cursor: pointer; background: rgba(128, 128, 128, .18); color: inherit; }
    .btn.primary { background: var(--blue, #5b4cf5); color: #fff; }
    .muted { color: var(--muted); margin: 0; font-size: 14px; }
    .error { color: #c9363b; margin: 0; font-size: 14px; }
  `],
} )
export class MissionGoalComponent {
  private readonly api = inject( MissionsApiService );

  readonly mission = input.required<MissionView>();
  readonly saved = output<MissionView>();

  readonly editing = signal( false );
  readonly busy = signal( false );
  readonly error = signal( '' );
  readonly draft = signal<{ metric: string; label: string; target: number }[]>( [] );

  /** The owner changes targets until it finishes or while 16Ahead isn't mid-step. */
  readonly canEdit = computed( () => {
    const m = this.mission();
    return m.isOwner && ![ 'done', 'failed', 'cancelled', 'running' ].includes( m.status as string );
  } );

  readonly view = computed( () => {
    const m = this.mission();
    const progress = m.goalProgress;
    const goal = m.goal;
    if ( !progress && !goal ) return null;
    const measures: GoalMeasure[] = progress?.measures || goal?.measures || [];
    const rows: MeasureRow[] = measures.map( ( r ) => {
      const value = Number( r.value ) || 0;
      return { metric: r.metric, label: r.label, target: r.target, value, met: value >= r.target, pct: Math.min( 100, Math.round( ( value / Math.max( 1, r.target ) ) * 100 ) ) };
    } );
    const finished = m.status === 'done';
    const verdict = finished && m.goalMet === true ? 'met' : finished && m.goalMet === false ? 'missed' : '';
    return { statement: progress?.statement || goal?.statement || '', rows, verdict };
  } );

  startEdit (): void {
    this.draft.set( ( this.view()?.rows || [] ).map( ( r ) => ( { metric: r.metric, label: r.label, target: r.target } ) ) );
    this.error.set( '' );
    this.editing.set( true );
  }

  setTarget ( index: number, event: Event ): void {
    const target = Math.round( Number( ( event.target as HTMLInputElement ).value ) );
    this.draft.update( ( rows ) => rows.map( ( r, i ) => ( i === index ? { ...r, target } : r ) ) );
  }

  async save (): Promise<void> {
    const rows = this.draft();
    if ( rows.some( ( r ) => !Number.isFinite( r.target ) || r.target < 1 ) ) {
      this.error.set( 'Give each measure a number of at least 1.' );
      return;
    }
    this.busy.set( true );
    try {
      const mission = await this.api.saveGoal( this.mission().id, { measures: rows.map( ( r ) => ( { metric: r.metric, target: r.target } ) ) } );
      this.editing.set( false );
      this.saved.emit( mission );
    } catch ( error: any ) {
      this.error.set( String( error?.error?.message || 'Couldn’t save the targets.' ) );
    } finally {
      this.busy.set( false );
    }
  }
}
