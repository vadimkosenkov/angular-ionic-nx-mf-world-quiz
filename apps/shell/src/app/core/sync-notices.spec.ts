import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SyncService, type SyncRecovery } from '@world-quiz/client/progress';
import { Toasts } from '@world-quiz/client/ui';
import type { Locale } from '@world-quiz/quiz/domain';
import { provideShellTesting } from '../../testing/shell-testing';
import { provideSyncNotices } from './sync-notices';

@Component({ template: '' })
class Blank {}

/** Only `recovered` is read here; the real sync has a screen of its own. */
async function setUp(locale: Locale = 'en') {
  const recovered = signal<SyncRecovery | null>(null);
  const view = await render(Blank, {
    providers: [
      ...provideShellTesting({ locale }),
      { provide: SyncService, useValue: { recovered: recovered.asReadonly() } },
      provideSyncNotices(),
    ],
  });
  return { ...view, recovered, toasts: TestBed.inject(Toasts) };
}

describe('provideSyncNotices', () => {
  it('says nothing until a sync has caught up', async () => {
    const { toasts } = await setUp();
    expect(toasts.current()).toBeNull();
  });

  it('says what reached the account', async () => {
    const { recovered, toasts, detectChanges } = await setUp();

    recovered.set({ sent: 1, at: 1_000 });
    detectChanges();

    expect(toasts.current()).toMatchObject({
      tone: 'success',
      text: 'Back online: 1 result is saved to your account.',
    });
  });

  it('counts them in the language the player reads', async () => {
    const { recovered, toasts, detectChanges } = await setUp('ru');

    recovered.set({ sent: 2, at: 1_000 });
    detectChanges();

    expect(toasts.current()?.text).toBe(
      'Связь вернулась: 2 результата сохранены в аккаунте.',
    );
  });
});
