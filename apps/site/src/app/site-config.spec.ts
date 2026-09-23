import { TestBed } from '@angular/core/testing';
import { TransferState } from '@angular/core';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SITE_CONFIG,
  SITE_CONFIG,
  SITE_CONFIG_STATE,
  siteConfigFromEnvironment,
} from './site-config';

describe('site configuration', () => {
  it('reads the server environment', () => {
    expect(
      siteConfigFromEnvironment({
        SITE_URL: 'https://worldquiz.test',
        APP_URL: 'https://app.worldquiz.test',
        API_URL: 'https://api.worldquiz.test/',
        SITE_OPERATOR_NAME: 'Operator',
        SITE_OPERATOR_EMAIL: 'hello@worldquiz.test',
      }),
    ).toEqual({
      siteUrl: 'https://worldquiz.test',
      appUrl: 'https://app.worldquiz.test',
      apiUrl: 'https://api.worldquiz.test',
      operator: { name: 'Operator', email: 'hello@worldquiz.test' },
    });
  });

  it('falls back to the development values, without an operator', () => {
    expect(siteConfigFromEnvironment({})).toEqual(DEFAULT_SITE_CONFIG);
  });

  it('takes the server-rendered values in the browser', () => {
    TestBed.configureTestingModule({});
    const deployed = siteConfigFromEnvironment({
      API_URL: 'https://api.worldquiz.test',
    });
    TestBed.inject(TransferState).set(SITE_CONFIG_STATE, deployed);

    // Without the transferred state the browser would keep the bundle's
    // development defaults and link to localhost after hydration.
    expect(TestBed.inject(SITE_CONFIG)).toEqual(deployed);
  });

  it('uses the development defaults without transferred state', () => {
    TestBed.configureTestingModule({});

    expect(TestBed.inject(SITE_CONFIG)).toEqual(DEFAULT_SITE_CONFIG);
  });
});
