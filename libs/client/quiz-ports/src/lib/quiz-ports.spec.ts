import { TestBed } from '@angular/core/testing';
import { COUNTRIES } from '@world-quiz/quiz/countries';
import { CLOCK, COUNTRY_DATASET } from './quiz-ports';

describe('quiz ports', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
  });

  it('defaults the dataset to the bundled countries', () => {
    expect(TestBed.inject(COUNTRY_DATASET)).toBe(COUNTRIES);
  });

  it('defaults the clock to a monotonic source near wall-clock time', () => {
    const clock = TestBed.inject(CLOCK);
    const before = clock.now();
    const after = clock.now();

    expect(after).toBeGreaterThanOrEqual(before);
    // performance.timeOrigin + performance.now() tracks Date.now() closely.
    expect(Math.abs(before - Date.now())).toBeLessThan(1_000);
  });
});
