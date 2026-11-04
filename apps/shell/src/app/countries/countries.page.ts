import { Component, computed, inject, signal } from '@angular/core';
import { IonContent, IonIcon } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { PluralPipe } from '@world-quiz/client/i18n';
import { ProgressStore } from '@world-quiz/client/progress';
import { SettingsStore } from '@world-quiz/client/settings';
import { PageHeader } from '@world-quiz/client/ui';
import {
  countriesInScope,
  QUIZ_SCOPES,
  type QuizCategory,
  type QuizScope,
} from '@world-quiz/quiz/domain';
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
  imports: [IonContent, IonIcon, PageHeader, PluralPipe, TranslocoPipe],
  templateUrl: './countries.page.html',
  styleUrl: './countries.page.scss',
})
export class CountriesPage {
  private readonly progress = inject(ProgressStore);
  private readonly settings = inject(SettingsStore);

  /** The same six regions and the same counts as the quiz setup offers. */
  protected readonly scopeOptions = QUIZ_SCOPES.map((scope) => ({
    scope,
    count: countriesInScope(this.progress.dataset, scope).length,
  }));

  protected readonly scope = signal<QuizScope>('world');

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
