import { Component, input } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import type { AnswerRecord } from '@world-quiz/quiz/domain';

/**
 * The verdict on one answer, shown under the flag in place of the choices.
 * After a mistake the correct answer gets its own block with the largest text
 * on screen, because it is what the player should remember.
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
    <p class="verdict">
      <ion-icon
        [name]="answer.correct ? 'checkmark-circle' : 'close-circle'"
        aria-hidden="true"
      />
      {{ (answer.correct ? 'quiz.correct' : 'quiz.incorrect') | transloco }}
    </p>
    @if (answer.judgement === 'typo' && answer.matchedText) {
      <p class="detail">
        {{ 'quiz.accepted' | transloco: { answer: answer.matchedText } }}
      </p>
    }
    @if (!answer.correct) {
      <div class="correct-answer">
        <p class="label">{{ 'quiz.correctAnswer' | transloco }}</p>
        <p class="answer" data-testid="quiz-correct-answer">
          {{ correctAnswer() }}
        </p>
      </div>
    }
  `,
  styleUrl: './answer-feedback.scss',
})
export class AnswerFeedback {
  readonly record = input.required<AnswerRecord>();
  /** The right answer, already localized (a capital or a country name). */
  readonly correctAnswer = input.required<string>();
}
