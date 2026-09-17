import { Component, inject, signal } from '@angular/core';
import {
  IonContent,
  IonHeader,
  IonLabel,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { EmptyState } from '@world-quiz/client/ui';
import {
  LEADERBOARD_BOARDS,
  type LeaderboardBoardId,
} from '@world-quiz/quiz/domain';
import { ProgressStore } from '../core/progress.store';

type LeaderboardView = 'global' | 'mine';

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
          (ionChange)="view.set($any($event).detail.value)"
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
          (ionChange)="board.set($any($event).detail.value)"
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
}
