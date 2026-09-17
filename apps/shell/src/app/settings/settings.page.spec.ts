import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { SettingsStore } from '@world-quiz/client/settings';
import { provideShellTesting } from '../../testing/shell-testing';
import { APP_VERSION } from '../app-info';
import { SettingsPage } from './settings.page';

function emitIonChange(element: Element, value: unknown) {
  element.dispatchEvent(new CustomEvent('ionChange', { detail: { value } }));
}

describe('SettingsPage', () => {
  it('offers Light, Dark and System and marks the current theme', async () => {
    await render(SettingsPage, { providers: provideShellTesting() });

    for (const label of ['Light', 'Dark', 'System']) {
      expect(await screen.findByText(label)).toBeTruthy();
    }
    const segment = screen.getByTestId('theme-segment') as HTMLElement & {
      value?: string;
    };
    expect(segment.value).toBe('light');
  });

  it('titles every section with a heading above its card', async () => {
    await render(SettingsPage, { providers: provideShellTesting() });

    for (const name of ['Appearance', 'Language', 'About']) {
      const region = await screen.findByRole('region', { name });
      const heading = screen.getByRole('heading', { level: 2, name });
      expect(region.firstElementChild).toBe(heading);
    }
  });

  it('changes the theme through the store and ignores unknown values', async () => {
    await render(SettingsPage, { providers: provideShellTesting() });
    const store = TestBed.inject(SettingsStore);
    const segment = await screen.findByTestId('theme-segment');

    emitIonChange(segment, 'dark');
    expect(store.theme()).toBe('dark');

    emitIonChange(segment, 'sepia');
    expect(store.theme()).toBe('dark');
  });

  it('switches the language and re-renders the page in Russian', async () => {
    const { fixture } = await render(SettingsPage, {
      providers: provideShellTesting(),
    });
    await screen.findByText('Appearance');

    emitIonChange(screen.getByTestId('language-group'), 'ru');
    fixture.detectChanges();

    expect(TestBed.inject(SettingsStore).locale()).toBe('ru');
    expect(await screen.findByText('Оформление')).toBeTruthy();
    // Native names stay the same; the second line is translated.
    expect(screen.getByText('English')).toBeTruthy();
    expect(screen.getByText('Английский')).toBeTruthy();
    expect(screen.getAllByText('Русский')).toHaveLength(2);
  });

  it('shows the app version and data sources', async () => {
    await render(SettingsPage, { providers: provideShellTesting() });

    expect((await screen.findByTestId('app-version')).textContent?.trim()).toBe(
      APP_VERSION,
    );
    expect(screen.getByText('Wikidata, UN M49')).toBeTruthy();
    expect(screen.getByText('flag-icons (MIT)')).toBeTruthy();
  });

  it('uses decorative flag images with the bundled asset paths', async () => {
    await render(SettingsPage, { providers: provideShellTesting() });
    await screen.findByText('Language');

    const flags = [...document.querySelectorAll<HTMLImageElement>('img.flag')];
    expect(flags.map((img) => img.getAttribute('src'))).toEqual([
      'flags/gb.svg',
      'flags/ru.svg',
    ]);
    expect(flags.every((img) => img.getAttribute('alt') === '')).toBe(true);
  });
});
