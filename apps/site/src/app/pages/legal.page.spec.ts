import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { SiteI18n } from '../i18n/site-i18n';
import { DEFAULT_SITE_CONFIG, SITE_CONFIG } from '../site-config';
import { LegalPage } from './legal.page';

describe('LegalPage', () => {
  it('says it is a draft while no operator is configured, never inventing one', async () => {
    await render(LegalPage, { inputs: { doc: 'privacy' } });

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Privacy Policy',
    );
    expect(screen.getByTestId('legal-draft').textContent).toContain('Draft');
    expect(screen.getByTestId('legal').textContent).not.toContain('@');
  });

  it('names the operator and contact once they are configured', async () => {
    await render(LegalPage, {
      inputs: { doc: 'terms' },
      providers: [
        {
          provide: SITE_CONFIG,
          useValue: {
            ...DEFAULT_SITE_CONFIG,
            operator: {
              name: 'Example Operator',
              email: 'privacy@example.com',
            },
          },
        },
      ],
    });

    expect(screen.queryByTestId('legal-draft')).toBeNull();
    expect(screen.getByTestId('legal').textContent).toContain(
      'The service is operated by Example Operator. Questions about this page or your data: privacy@example.com.',
    );
  });

  it('is in Russian on /ru', async () => {
    await render(LegalPage, {
      inputs: { doc: 'privacy' },
      configureTestBed: () => TestBed.inject(SiteI18n).language.set('ru'),
    });

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Политика конфиденциальности',
    );
  });
});
