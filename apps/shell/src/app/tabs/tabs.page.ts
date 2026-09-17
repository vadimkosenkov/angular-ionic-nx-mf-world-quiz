import { Component } from '@angular/core';
import {
  IonIcon,
  IonLabel,
  IonTabBar,
  IonTabButton,
  IonTabs,
} from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';

interface TabDefinition {
  readonly tab: 'home' | 'leaderboard' | 'achievements' | 'settings';
  readonly icon: string;
  readonly selectedIcon: string;
}

/**
 * Main navigation. The tab bar is the most visible Liquid Glass surface: a
 * floating capsule (`wq-floating-tab-bar`, libs/client/ui) that the page
 * content scrolls underneath.
 */
@Component({
  selector: 'wq-tabs',
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, TranslocoPipe],
  template: `
    <ion-tabs>
      <ion-tab-bar
        slot="bottom"
        class="wq-floating-tab-bar"
        [attr.aria-label]="'tabs.label' | transloco"
      >
        @for (item of tabs; track item.tab) {
          <ion-tab-button
            [tab]="item.tab"
            [attr.data-testid]="'tab-' + item.tab"
          >
            <ion-icon
              [name]="item.icon"
              class="icon-default"
              aria-hidden="true"
            />
            <ion-icon
              [name]="item.selectedIcon"
              class="icon-selected"
              aria-hidden="true"
            />
            <ion-label>{{ 'tabs.' + item.tab | transloco }}</ion-label>
          </ion-tab-button>
        }
      </ion-tab-bar>
    </ion-tabs>
  `,
  styles: `
    ion-tab-button .icon-selected,
    ion-tab-button.tab-selected .icon-default {
      display: none;
    }
    ion-tab-button.tab-selected .icon-selected {
      display: block;
    }
  `,
})
export class TabsPage {
  protected readonly tabs: readonly TabDefinition[] = [
    { tab: 'home', icon: 'home-outline', selectedIcon: 'home' },
    { tab: 'leaderboard', icon: 'trophy-outline', selectedIcon: 'trophy' },
    { tab: 'achievements', icon: 'star-outline', selectedIcon: 'star' },
    { tab: 'settings', icon: 'settings-outline', selectedIcon: 'settings' },
  ];
}
