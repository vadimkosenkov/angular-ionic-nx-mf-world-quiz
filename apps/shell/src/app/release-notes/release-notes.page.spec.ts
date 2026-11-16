import { render, screen } from '@testing-library/angular';
import { TestBed } from '@angular/core/testing';
import { provideShellTesting } from '../../testing/shell-testing';
import { NotificationsStore } from '../core/notifications.store';
import { RELEASES } from './release-notes';
import { ReleaseNotesPage } from './release-notes.page';

describe('ReleaseNotesPage', () => {
  it('shows every release this build ships, newest first', async () => {
    await render(ReleaseNotesPage, { providers: provideShellTesting() });

    const cards = await screen.findAllByTestId('release');
    expect(cards).toHaveLength(RELEASES.length);
    expect(cards[0]?.textContent).toContain(RELEASES[0]?.version);
    for (const line of RELEASES[0]?.lines.en ?? []) {
      expect(cards[0]?.textContent).toContain(line);
    }
  });

  it('speaks the player language, down to the way a date is written', async () => {
    await render(ReleaseNotesPage, {
      providers: provideShellTesting({ locale: 'ru' }),
    });

    const card = (await screen.findAllByTestId('release'))[0];
    expect(card?.textContent).toContain(RELEASES[0]?.lines.ru[0]);
    // The ISO day is never shown: `2026-11-13` reads as nothing out loud.
    expect(card?.textContent).not.toContain(RELEASES[0]?.date);
  });

  it('counts as read when the page is entered, not when it is built', async () => {
    // Ionic keeps a page instance and shows it again, so the mark has to be
    // cleared from the lifecycle hook rather than the constructor.
    const { fixture } = await render(ReleaseNotesPage, {
      providers: provideShellTesting(),
    });
    const notifications = TestBed.inject(NotificationsStore);
    const read: string[] = [];
    notifications.markReleasesRead = async () => {
      read.push('read');
    };

    expect(read).toEqual([]);
    fixture.componentInstance.ionViewWillEnter();
    expect(read).toEqual(['read']);
  });
});
