import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';

/** Root of the standalone dev app; unused when the shell hosts this remote. */
@Component({
  selector: 'wq-root',
  imports: [IonApp, IonRouterOutlet],
  template: `
    <ion-app>
      <ion-router-outlet />
    </ion-app>
  `,
})
export class App {}
