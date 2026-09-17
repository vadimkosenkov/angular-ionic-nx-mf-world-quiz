import { Component } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import { EmptyState } from './empty-state';

@Component({
  imports: [EmptyState],
  template: `
    <wq-empty-state
      icon="trophy-outline"
      heading="Nothing yet"
      message="Come back later"
    >
      <button type="button">Retry</button>
    </wq-empty-state>
  `,
})
class Host {}

describe('EmptyState', () => {
  it('announces its heading and message and projects actions', async () => {
    await render(Host);

    const status = screen.getByRole('status');
    expect(status.textContent).toContain('Nothing yet');
    expect(status.textContent).toContain('Come back later');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });

  it('hides the decorative icon from assistive technology', async () => {
    const { container } = await render(Host);
    expect(container.querySelector('.icon')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
  });

  it('omits the message paragraph when there is no message', async () => {
    await render(EmptyState, { inputs: { icon: 'star', heading: 'Empty' } });
    expect(document.querySelector('.message')).toBeNull();
  });
});
