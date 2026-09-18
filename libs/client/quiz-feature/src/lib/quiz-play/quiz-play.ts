import {
  afterRenderEffect,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonButton, IonIcon, IonInput } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { SettingsStore } from '@world-quiz/client/settings';
import { ProgressBar } from '@world-quiz/client/ui';
import { flagAssetPath } from '@world-quiz/quiz/countries';
import {
  type Country,
  type CountryCode,
  displayAnswer,
  indexCountriesByCode,
  type QuizConfig,
  type QuizSession,
  TIMED_MODE_DURATION_MS,
} from '@world-quiz/quiz/domain';
import { COUNTRY_DATASET } from '@world-quiz/client/quiz-ports';
import { QuizSessionStore } from '../quiz-session.store';

/** The part of Ionic's `<ion-input>` element used for autofocus. */
interface IonicInputElement {
  setFocus?: () => Promise<void>;
}

/** How often the Timed-mode countdown re-renders. The rules use the clock, not this tick. */
const TICK_INTERVAL_MS = 250;

/**
 * Plays one quiz session: prompt, answers, feedback and progress.
 *
 * Used by both the Capitals and the Flags microfrontend; the category only
 * changes what the prompt shows and what the answers are.
 */
@Component({
  selector: 'wq-quiz-play',
  imports: [
    IonButton,
    IonIcon,
    IonInput,
    FormsModule,
    TranslocoPipe,
    ProgressBar,
  ],
  providers: [QuizSessionStore],
  templateUrl: './quiz-play.html',
  styleUrl: './quiz-play.scss',
})
export class QuizPlay {
  readonly config = input.required<QuizConfig>();
  readonly seed = input.required<string>();

  /** Emitted once the player has seen the feedback of the last answer. */
  readonly finished = output<QuizSession>();
  readonly exited = output<void>();

  protected readonly store = inject(QuizSessionStore);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private latestField: IonicInputElement | null = null;
  private listensForPageEnter = false;
  private readonly settings = inject(SettingsStore);
  private readonly countries = indexCountriesByCode(inject(COUNTRY_DATASET));

  /** The Hard-mode field; recreated for every question. */
  private readonly answerInput = viewChild('answerInput', { read: ElementRef });

  protected readonly typedAnswer = signal('');
  protected readonly showEmptyAnswerError = signal(false);

  protected readonly locale = this.settings.locale;
  protected readonly isTimed = computed(() => this.config().mode === 'timed');
  protected readonly timerPercent = computed(() => {
    const remaining = this.store.remainingMs();
    return remaining === null ? 0 : (remaining / TIMED_MODE_DURATION_MS) * 100;
  });
  protected readonly secondsLeft = computed(() =>
    Math.ceil((this.store.remainingMs() ?? 0) / 1000),
  );

  /** Easy mode: the offered options with their translated labels. */
  protected readonly choices = computed(() => {
    const question = this.store.question();
    const locale = this.locale();
    const category = this.config().category;
    return (question?.choices ?? []).map((code) => ({
      code,
      label: this.label(code, category, locale),
    }));
  });

  protected readonly promptCountry = computed(() => this.store.country());

  constructor() {
    // Start (or restart) whenever the configuration or seed changes.
    effect(() => {
      const config = this.config();
      const seed = this.seed();
      untracked(() => {
        this.typedAnswer.set('');
        this.store.start(config, seed);
      });
    });

    // Emit the finished session once its feedback has been acknowledged.
    effect(() => {
      const session = this.store.finishedSession();
      if (session && !this.store.feedback()) {
        untracked(() => this.finished.emit(session));
      }
    });

    // Hard mode: put the cursor in the answer field as soon as a question
    // appears, so the player can type (or dictate) right away. The field is
    // rendered anew for each question, which re-runs this effect.
    afterRenderEffect(() => {
      const field = this.answerInput()?.nativeElement as
        IonicInputElement | undefined;
      if (field) this.focusWhenVisible(field);
    });

    const ticker = setInterval(() => this.store.tick(), TICK_INTERVAL_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(ticker));
  }

  /**
   * `setFocus` exists only once the browser has upgraded `<ion-input>`, and a
   * field on a page that is still hidden by Ionic's enter transition cannot
   * keep focus. So focus now, and once more when the page has finished
   * entering (`ionViewDidEnter` is dispatched on the page element).
   */
  private focusWhenVisible(field: IonicInputElement): void {
    this.latestField = field;
    const focus = () =>
      void customElements
        .whenDefined('ion-input')
        .then(() => this.latestField?.setFocus?.())
        .catch(() => undefined);

    focus();
    if (!this.listensForPageEnter) {
      this.listensForPageEnter = true;
      this.host.nativeElement
        .closest('.ion-page')
        ?.addEventListener('ionViewDidEnter', focus, { once: true });
    }
  }

  protected flagFor(country: Country): string {
    return flagAssetPath(country.code);
  }

  protected answerLabel(code: CountryCode): string {
    return this.label(code, this.config().category, this.locale());
  }

  protected selectChoice(code: CountryCode): void {
    this.store.answerChoice(code);
  }

  protected submitTyped(): void {
    const text = this.typedAnswer();
    if (!text.trim()) {
      this.showEmptyAnswerError.set(true);
      return;
    }
    this.showEmptyAnswerError.set(false);
    this.store.answerText(text);
    this.typedAnswer.set('');
  }

  protected continue(): void {
    this.store.continue();
  }

  protected finish(): void {
    this.store.stop();
  }

  protected exit(): void {
    this.store.stop();
    this.exited.emit();
  }

  private label(
    code: CountryCode,
    category: QuizConfig['category'],
    locale: 'en' | 'ru',
  ): string {
    const country = this.countries.get(code);
    return country ? displayAnswer(country, category, locale) : code;
  }
}
