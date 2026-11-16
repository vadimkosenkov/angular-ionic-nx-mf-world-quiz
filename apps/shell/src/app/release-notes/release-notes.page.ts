import { Component, computed, inject } from '@angular/core';
import { IonContent } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { SettingsStore } from '@world-quiz/client/settings';
import { PageChromeState, PageHeader } from '@world-quiz/client/ui';
import { NotificationsStore } from '../core/notifications.store';
import { releaseLines, RELEASES } from './release-notes';

/** One release as the page shows it: a version, a day, and what changed. */
interface ReleaseRow {
  readonly version: string;
  readonly date: string;
  readonly lines: readonly string[];
}

/**
 * What changed in each release, newest first.
 *
 * Everything here is in the bundle (release-notes.ts), so the page needs no
 * API and works offline. It is reached from the bell on Home and from
 * Settings, and opening it is what clears the bell's mark: reading is the
 * thing the mark is about.
 */
@Component({
  selector: 'wq-release-notes-page',
  imports: [IonContent, PageHeader, TranslocoPipe],
  // Without this the header of this page stays lit over the screen it is
  // being left for, for the length of the transition (page-chrome-state.ts).
  providers: [PageChromeState],
  templateUrl: './release-notes.page.html',
  styleUrl: './release-notes.page.scss',
})
export class ReleaseNotesPage {
  private readonly settings = inject(SettingsStore);
  private readonly notifications = inject(NotificationsStore);

  protected readonly releases = computed<readonly ReleaseRow[]>(() => {
    const locale = this.settings.locale();
    // The day is written the way the player's language writes a date; the
    // stored value is an ISO day, which no language reads out loud.
    const date = new Intl.DateTimeFormat(locale, { dateStyle: 'long' });
    return RELEASES.map((release) => ({
      version: release.version,
      date: date.format(new Date(`${release.date}T00:00:00Z`)),
      lines: releaseLines(release, locale),
    }));
  });

  /**
   * `ionViewWillEnter`, not the constructor: Ionic keeps a page instance and
   * shows it again, so a player coming back to a later release would find
   * the mark still on the bell.
   */
  ionViewWillEnter(): void {
    void this.notifications.markReleasesRead();
  }
}
