import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton, IonContent } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { EmptyState, PageHeader } from '@world-quiz/client/ui';

/**
 * Shown when a quiz microfrontend cannot be loaded — on the web the remote is
 * deployed separately and may be unreachable. A blank screen would look like
 * a broken app, so the shell keeps the user in a recoverable state.
 */
@Component({
  selector: 'wq-remote-unavailable-page',
  imports: [
    IonContent,
    PageHeader,
    IonButton,
    RouterLink,
    TranslocoPipe,
    EmptyState,
  ],
  template: `
    <wq-page-header [heading]="'quiz.unavailable.title' | transloco" />

    <ion-content [fullscreen]="true" class="wq-aurora">
      <div class="wq-page">
        <div class="wq-card" data-testid="quiz-unavailable">
          <wq-empty-state
            icon="close-circle"
            [heading]="'quiz.unavailable.title' | transloco"
            [message]="'quiz.unavailable.message' | transloco"
          />
        </div>
      </div>
    </ion-content>

    <!-- The way out of a dead end is this page's next step, so it sits where
         every page keeps its next step. Inside the card it had no padding of
         its own and ran edge to edge. -->
    <div class="wq-action-bar">
      <ion-button
        class="wq-glass-button secondary"
        expand="block"
        routerLink="/home"
        data-testid="quiz-unavailable-home"
      >
        {{ 'quiz.unavailable.back' | transloco }}
      </ion-button>
    </div>
  `,
  styles: `
    .wq-page {
      padding-bottom: var(--wq-action-bar-clearance);
    }
  `,
})
export class RemoteUnavailablePage {}
