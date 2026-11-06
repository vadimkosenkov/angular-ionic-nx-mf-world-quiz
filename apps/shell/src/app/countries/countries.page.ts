import { Component, computed, inject, signal } from '@angular/core';
import { IonContent, IonIcon } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { PluralPipe } from '@world-quiz/client/i18n';
import { ProgressStore } from '@world-quiz/client/progress';
import { SettingsStore } from '@world-quiz/client/settings';
import { PageHeader, RegionOptions } from '@world-quiz/client/ui';
import {
  isQuizScope,
  type QuizCategory,
  type QuizScope,
} from '@world-quiz/quiz/domain';
import { regionOptions } from '../core/region-options';
import { countryRows, type CountryRow } from './country-rows';

/**
 * The reference: every country with its capital and its flag, filtered by
 * region. It answers the question a quiz cannot — "what am I supposed to
 * learn?" — and the marks on each row say what the player already knows.
 *
 * Everything on screen comes from the bundled dataset and from the progress
 * already on the device, so the page works offline and needs no API.
 */
@Component({
  selector: 'wq-countries-page',
  imports: [
    IonContent,
    IonIcon,
    PageHeader,
    PluralPipe,
    RegionOptions,
    TranslocoPipe,
  ],
  templateUrl: './countries.page.html',
  styleUrl: './countries.page.scss',
})
export class CountriesPage {
  private readonly progress = inject(ProgressStore);
  private readonly settings = inject(SettingsStore);

  /** The same regions, in the same order, as the quiz setup offers. */
  protected readonly regionOptions = regionOptions();

  protected readonly scope = signal<QuizScope>('world');

  protected selectScope(scope: string): void {
    if (isQuizScope(scope)) this.scope.set(scope);
  }

  protected readonly rows = computed(() =>
    countryRows(
      this.progress.dataset,
      this.progress.snapshot(),
      this.scope(),
      this.settings.locale(),
    ),
  );

  /**
   * Mastery is shown by lighting the fact itself up, and colour alone says
   * nothing to a screen reader, so each fact also carries these words:
   * "Capital: mastered".
   */
  protected markLabel(category: QuizCategory, row: CountryRow): string {
    return `countries.mark.${category}.${row.mastered[category] ? 'known' : 'unknown'}`;
  }
}
