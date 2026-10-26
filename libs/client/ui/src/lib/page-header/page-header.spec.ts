import { NavController } from '@ionic/angular';
import { fireEvent, render, screen } from '@testing-library/angular';
import { PageHeader } from './page-header';

/** Just enough of Ionic's navigation to see where the header sends you. */
function fakeNav(canPop = false) {
  const visited: string[] = [];
  let popped = false;
  return {
    visited,
    get popped() {
      return popped;
    },
    provider: {
      provide: NavController,
      useValue: {
        pop: () => {
          popped = canPop;
          return Promise.resolve(canPop);
        },
        navigateBack: (url: string) => {
          visited.push(url);
          return Promise.resolve(true);
        },
      },
    },
  };
}

describe('PageHeader', () => {
  it('shows the page title', async () => {
    await render(PageHeader, { inputs: { heading: 'Quiz setup' } });

    expect(screen.getByRole('heading', { name: 'Quiz setup' })).toBeTruthy();
  });

  // The tab pages are reached from the tab bar, so they have nowhere to go
  // back to and must not offer a button that pretends otherwise.
  it('has no back button unless it is given somewhere to go', async () => {
    await render(PageHeader, { inputs: { heading: 'Settings' } });

    expect(screen.queryByTestId('page-back')).toBeNull();
  });

  // Popping returns to wherever this page was opened from; the address is
  // only a fallback, so it must not be used when there is a stack.
  it('pops the page off the stack when there is one', async () => {
    const nav = fakeNav(true);
    await render(PageHeader, {
      inputs: { heading: 'Quiz setup', backHref: '/home', backLabel: 'Back' },
      providers: [nav.provider],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await Promise.resolve();

    expect(nav.popped).toBe(true);
    expect(nav.visited).toEqual([]);
  });

  it('falls back to the given page when there is nothing to pop', async () => {
    const nav = fakeNav(false);
    await render(PageHeader, {
      inputs: { heading: 'Quiz setup', backHref: '/home', backLabel: 'Back' },
      providers: [nav.provider],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await Promise.resolve();
    await Promise.resolve();

    expect(nav.visited).toEqual(['/home']);
  });
});
