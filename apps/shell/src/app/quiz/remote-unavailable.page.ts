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
          <ion-button
            expand="block"
            routerLink="/home"
            data-testid="quiz-unavailable-home"
          >
            {{ 'quiz.unavailable.back' | transloco }}
          </ion-button>
        </div>
      </div>
    </ion-content>
  `,
})
export class RemoteUnavailablePage {}
