import {
  afterNextRender,
  Component,
  type ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import type { AnswerRecord } from '@world-quiz/quiz/domain';

/**
 * The verdict on one answer, shown under the flag in place of the choices.
 *
 * The card itself is the control that moves on. It sits where the player is
 * already looking, within reach of the thumb that just answered, which a
 * button at the bottom of the screen is not — and one tap less to think
 * about. It takes focus when it appears, so a keyboard continues with Enter.
 *
 * Both verdicts end with the answer in the same block: after a mistake it is
 * what the player should remember, after a correct answer it shows what they
 * chose. The text is the largest on screen either way.
 */
@Component({
  selector: 'wq-answer-feedback',
  imports: [IonIcon, TranslocoPipe],
  host: {
    role: 'status',
    '[class.correct]': 'record().correct',
  },
  template: `
    @let answer = record();
    <!-- Phrasing content only: a button may not contain <p>. -->
    <button
      #card
      type="button"
      class="card"
      data-testid="quiz-continue"
      (click)="next.emit()"
    >
      <span class="verdict">
        <ion-icon
          [name]="answer.correct ? 'checkmark-circle' : 'close-circle'"
          aria-hidden="true"
        />
        {{ (answer.correct ? 'quiz.correct' : 'quiz.incorrect') | transloco }}
      </span>
      @if (answer.judgement === 'typo' && answer.matchedText) {
        <span class="detail">
          {{ 'quiz.accepted' | transloco: { answer: answer.matchedText } }}
        </span>
      }
      <span class="answer-block">
        <span class="label">
          {{
            (answer.correct ? 'quiz.yourAnswer' : 'quiz.correctAnswer')
              | transloco
          }}
        </span>
        <span class="answer" data-testid="quiz-correct-answer">
          {{ correctAnswer() }}
        </span>
      </span>
      <span class="hint">
        {{ 'quiz.tapToContinue' | transloco }}
        <ion-icon name="chevron-forward" aria-hidden="true" />
      </span>
    </button>
  `,
  styleUrl: './answer-feedback.scss',
})
export class AnswerFeedback {
  readonly record = input.required<AnswerRecord>();
  /** The right answer, already localized (a capital or a country name). */
  readonly correctAnswer = input.required<string>();
  /** The player is done reading: move to the next question. */
  readonly next = output<void>();

  private readonly card =
    viewChild.required<ElementRef<HTMLButtonElement>>('card');

  constructor() {
    // A fresh component per verdict (the parent's `@if` recreates it), so
    // this runs once per answer. `preventScroll` because the card is already
    // in view: the question above it must not scroll away.
    afterNextRender(() =>
      this.card().nativeElement.focus({ preventScroll: true }),
    );
  }
}
