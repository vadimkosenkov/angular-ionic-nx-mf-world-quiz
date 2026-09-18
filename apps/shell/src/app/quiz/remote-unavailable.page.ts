import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { EmptyState } from '@world-quiz/client/ui';

/**
 * Shown when a quiz microfrontend cannot be loaded — on the web the remote is
 * deployed separately and may be unreachable. A blank screen would look like
 * a broken app, so the shell keeps the user in a recoverable state.
 */
@Component({
  selector: 'wq-remote-unavailable-page',
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButton,
    RouterLink,
    TranslocoPipe,
    EmptyState,
  ],
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-title>{{ 'quiz.unavailable.title' | transloco }}</ion-title>
      </ion-toolbar>
    </ion-header>

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
