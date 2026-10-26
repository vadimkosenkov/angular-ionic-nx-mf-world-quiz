import { Component } from '@angular/core';
import { render } from '@testing-library/angular';
import { FadesWithPage } from './fades-with-page';
import { PageChromeState } from './page-chrome-state';

@Component({
  selector: 'wq-fade-host',
  imports: [FadesWithPage],
  providers: [PageChromeState],
  template: `<span wqFadesWithPage data-testid="chrome">Title</span>`,
})
class FadeHost {}

async function renderChrome() {
  const view = await render(FadeHost);
  const chrome = view.getByTestId('chrome');
  const state = view.fixture.debugElement.injector.get(PageChromeState);
  const settle = () => view.detectChanges();
  return { chrome, state, settle };
}

describe('FadesWithPage', () => {
  it('is visible while its page is the one on screen', async () => {
    const { chrome } = await renderChrome();

    expect(chrome.classList.contains('wq-leaving')).toBe(false);
  });

  // The whole point: the chrome of the page being left must not sit on top of
  // the page arriving.
  it('hides while the page is being left', async () => {
    const { chrome, state, settle } = await renderChrome();

    state.leaving.set(true);
    settle();

    expect(chrome.classList.contains('wq-leaving')).toBe(true);
  });

  it('comes back when the page is entered again', async () => {
    const { chrome, state, settle } = await renderChrome();

    state.leaving.set(true);
    state.leaving.set(false);
    settle();

    expect(chrome.classList.contains('wq-leaving')).toBe(false);
  });
});
