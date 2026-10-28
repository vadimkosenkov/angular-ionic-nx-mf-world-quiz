import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { ToastHost } from '@world-quiz/client/ui';

@Component({
  selector: 'wq-root',
  imports: [IonApp, IonRouterOutlet, ToastHost, TranslocoPipe],
  template: `
    <ion-app>
      <ion-router-outlet />
      <!-- Outside the outlet: a message about an action outlives the page
           transition the action may start (signing out leaves for /welcome). -->
      <wq-toast-host [dismissLabel]="'toast.dismiss' | transloco" />
    </ion-app>
  `,
})
export class App {}
