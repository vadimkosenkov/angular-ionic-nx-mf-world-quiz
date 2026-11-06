import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { provideShellTesting } from '../../testing/shell-testing';
import type { ManualClock } from '@world-quiz/shared/util';
import { ProgressStore } from '@world-quiz/client/progress';
import { finishedSession } from '@world-quiz/client/progress/testing';
import {
  LAST_SETUP_STORAGE_KEY,
  LastSetupStore,
} from '../core/last-setup.store';
import { CLOCK } from '../core/tokens';
import { HomePage } from './home.page';

/** What the Play card says it is going to start. */
const playSetup = () =>
  screen.getByTestId('play-setup').textContent?.replace(/\s+/g, ' ').trim();

describe('HomePage', () => {
  it('greets by time of day and shows real totals', async () => {
    await render(HomePage, {
      providers: provideShellTesting({ now: new Date(2026, 8, 17, 20, 30) }),
    });

    expect((await screen.findByTestId('greeting')).textContent?.trim()).toBe(
      'Good evening',
    );
    const overall = screen.getByRole('progressbar', {
      name: 'Overall progress',
    });
    expect(overall.getAttribute('aria-valuetext')).toBe('0 of 390');
  });

  it('refreshes the greeting whenever the tab is entered again', async () => {
    const { fixture } = await render(HomePage, {
      providers: provideShellTesting({ now: new Date(2026, 8, 17, 8, 0) }),
    });
    expect((await screen.findByTestId('greeting')).textContent?.trim()).toBe(
      'Good morning',
    );

    // Ionic keeps the page alive; later the user comes back to the tab.
    (TestBed.inject(CLOCK) as ManualClock).set(
      new Date(2026, 8, 17, 19, 0).getTime(),
    );
    fixture.componentInstance.ionViewWillEnter();
    fixture.detectChanges();

    expect(screen.getByTestId('greeting').textContent?.trim()).toBe(
      'Good evening',
    );
  });

  it('shows the practice empty state, then the number of countries to review', async () => {
    const { fixture } = await render(HomePage, {
      providers: provideShellTesting(),
    });
    expect((await screen.findByTestId('practice')).textContent).toContain(
      'All clear',
    );

    const progress = TestBed.inject(ProgressStore);
    progress.recordSession(finishedSession([{ code: 'fr', correct: false }]));
    progress.recordSession(
      finishedSession([{ code: 'jp', correct: false }], { category: 'flags' }),
    );
    fixture.detectChanges();

    expect(
      screen
        .getByTestId('practice-capitals')
        .textContent?.replace(/\s+/g, ' ')
        .trim(),
    ).toBe('Capitals 1 country to review Practise');
    expect(screen.getByTestId('practice-flags').getAttribute('href')).toBe(
      '/quiz/setup?category=flags&mode=practice',
    );
  });

  it('uses Russian plural forms', async () => {
    const { fixture } = await render(HomePage, {
      providers: provideShellTesting({
        locale: 'ru',
        now: new Date(2026, 8, 17, 8),
      }),
    });

    expect((await screen.findByTestId('greeting')).textContent?.trim()).toBe(
      'Доброе утро',
    );

    TestBed.inject(ProgressStore).recordSession(
      finishedSession([
        { code: 'fr', correct: false },
        { code: 'de', correct: false },
      ]),
    );
    fixture.detectChanges();

    expect(
      screen
        .getByTestId('practice-capitals')
        .textContent?.replace(/\s+/g, ' ')
        .trim(),
    ).toBe('Столицы 2 страны для повторения Повторить');
  });

  // One way into the quiz, and it says what it is going to start: the
  // player chose it last time and does not have to choose again here.
  it('opens the quiz setup, showing the setup the player last played', async () => {
    await render(HomePage, { providers: provideShellTesting() });

    expect((await screen.findByTestId('play-quiz')).getAttribute('href')).toBe(
      '/quiz/setup',
    );
    expect(playSetup()).toBe('Capitals · World · Easy · Quick round');
    // And how far the player is in the category it would start.
    expect(screen.getByTestId('play-card').textContent).toContain(
      '0/195 mastered',
    );
  });

  it('offers the countries reference beside it', async () => {
    await render(HomePage, { providers: provideShellTesting() });

    expect(
      (await screen.findByTestId('learn-countries')).getAttribute('href'),
    ).toBe('/countries');
    expect(screen.getByTestId('learn-card').textContent).toContain(
      '195 countries · 6 regions',
    );
  });

  it('shows the remembered setup once the device has one', async () => {
    const { fixture } = await render(HomePage, {
      providers: provideShellTesting({
        storage: {
          [LAST_SETUP_STORAGE_KEY]: JSON.stringify({
            category: 'flags',
            scope: 'europe',
            difficulty: 'hard',
            mode: 'timed',
          }),
        },
      }),
    });
    await TestBed.inject(LastSetupStore).load();
    fixture.detectChanges();

    expect(playSetup()).toBe('Flags · Europe · Hard · Time attack');
  });

  it('previews three achievements with accessible progress', async () => {
    await render(HomePage, { providers: provideShellTesting() });

    const preview = await screen.findByTestId('achievement-preview');
    expect(preview.querySelectorAll('li')).toHaveLength(3);
    expect(
      screen.getByRole('link', { name: 'See all' }).getAttribute('href'),
    ).toBe('/achievements');
  });
});
