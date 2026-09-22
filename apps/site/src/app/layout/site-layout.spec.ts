import { DOCUMENT } from '@angular/common';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  provideRouter,
  Router,
  withComponentInputBinding,
} from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { SiteI18n } from '../i18n/site-i18n';
import { SiteLayout } from './site-layout';

@Component({ template: '<p>page</p>' })
class StubPage {}

async function renderAt(url: string) {
  const view = await render('<router-outlet />', {
    providers: [
      provideRouter(
        [
          {
            path: ':lang',
            component: SiteLayout,
            children: [{ path: '**', component: StubPage }],
          },
        ],
        withComponentInputBinding(),
      ),
    ],
  });
  await TestBed.inject(Router).navigateByUrl(url);
  view.fixture.detectChanges();
  await view.fixture.whenStable();
  return view;
}

describe('SiteLayout', () => {
  it('sets the language from the URL, for the page and for <html>', async () => {
    await renderAt('/ru/privacy');

    expect(TestBed.inject(SiteI18n).language()).toBe('ru');
    expect(TestBed.inject(DOCUMENT).documentElement.lang).toBe('ru');
    expect(screen.getByRole('navigation').textContent).toContain('Рейтинг');
  });

  it('links the same page in the other language, and tells search engines', async () => {
    await renderAt('/en/leaderboard/flags-hard');

    expect(screen.getByTestId('language-switch').getAttribute('href')).toBe(
      '/ru/leaderboard/flags-hard',
    );
    const links = [
      ...TestBed.inject(DOCUMENT).head.querySelectorAll(
        'link[data-wq-alternate]',
      ),
    ].map((link) => [
      link.getAttribute('rel'),
      link.getAttribute('hreflang'),
      link.getAttribute('href'),
    ]);
    expect(links).toEqual([
      ['canonical', null, 'http://localhost:4300/en/leaderboard/flags-hard'],
      ['alternate', 'en', 'http://localhost:4300/en/leaderboard/flags-hard'],
      ['alternate', 'ru', 'http://localhost:4300/ru/leaderboard/flags-hard'],
    ]);
  });
});
