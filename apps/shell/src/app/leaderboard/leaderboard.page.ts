import { Component, inject, signal } from '@angular/core';
import {
  IonContent,
  IonHeader,
  IonLabel,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
  type SegmentCustomEvent,
} from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { EmptyState } from '@world-quiz/client/ui';
import {
  isLeaderboardBoardId,
  LEADERBOARD_BOARDS,
  type LeaderboardBoardId,
} from '@world-quiz/quiz/domain';
import { ProgressStore } from '../core/progress.store';

const LEADERBOARD_VIEWS = ['global', 'mine'] as const;
type LeaderboardView = (typeof LEADERBOARD_VIEWS)[number];

function isLeaderboardView(value: unknown): value is LeaderboardView {
  return (LEADERBOARD_VIEWS as readonly unknown[]).includes(value);
}

/**
 * Global ranking and personal records for the four perfect-run boards.
 * Rankings need sign-in and the API (later phases), so the page shows the
 * real board structure and rules with an honest "not available yet" state.
 */
@Component({
  selector: 'wq-leaderboard-page',
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    TranslocoPipe,
    EmptyState,
  ],
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-title>{{ 'leaderboard.title' | transloco }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content [fullscreen]="true" class="wq-aurora">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">{{
            'leaderboard.title' | transloco
          }}</ion-title>
        </ion-toolbar>
      </ion-header>

      <div class="wq-page">
        <ion-segment
          class="wq-segment-pill"
          data-testid="leaderboard-view"
          [value]="view()"
          (ionChange)="onViewChange($event)"
        >
          <ion-segment-button value="global">
            <ion-label>{{ 'leaderboard.views.global' | transloco }}</ion-label>
          </ion-segment-button>
          <ion-segment-button value="mine">
            <ion-label>{{ 'leaderboard.views.mine' | transloco }}</ion-label>
          </ion-segment-button>
        </ion-segment>

        <ion-segment
          class="boards wq-segment-pill"
          data-testid="leaderboard-board"
          [scrollable]="true"
          [value]="board()"
          [attr.aria-label]="'leaderboard.boardsLabel' | transloco"
          (ionChange)="onBoardChange($event)"
        >
          @for (item of boards; track item.id) {
            <ion-segment-button [value]="item.id">
              <ion-label>{{
                'leaderboard.boards.' + item.id | transloco
              }}</ion-label>
            </ion-segment-button>
          }
        </ion-segment>

        <p class="rules wq-text-secondary" data-testid="leaderboard-rules">
          {{
            'leaderboard.rules' | transloco: { count: progress.countryCount }
          }}
        </p>

        <div class="wq-card">
          <wq-empty-state
            data-testid="leaderboard-unavailable"
            [icon]="view() === 'global' ? 'podium-outline' : 'trophy-outline'"
            [heading]="'leaderboard.unavailable.title' | transloco"
            [message]="'leaderboard.unavailable.message' | transloco"
          />
        </div>
      </div>
    </ion-content>
  `,
  styles: `
    .boards ion-segment-button {
      min-width: max-content;
    }
    .rules {
      margin: 0;
      line-height: 1.45;
    }
  `,
})
export class LeaderboardPage {
  protected readonly progress = inject(ProgressStore);
  protected readonly boards = LEADERBOARD_BOARDS;
  protected readonly view = signal<LeaderboardView>('global');
  protected readonly board = signal<LeaderboardBoardId>('capitals-easy');

  // `ionChange` is a DOM event for Angular's strict templates, so the Ionic
  // event type is applied here and the value is validated before use.
  protected onViewChange(event: Event): void {
    const { value } = (event as SegmentCustomEvent).detail;
    if (isLeaderboardView(value)) {
      this.view.set(value);
    }
  }

  protected onBoardChange(event: Event): void {
    const { value } = (event as SegmentCustomEvent).detail;
    if (isLeaderboardBoardId(value)) {
      this.board.set(value);
    }
  }
}
