import { describe, expect, it } from 'vitest';
import { appBuild, appVersion, DEV_VERSION } from './app-info';

/** A page with the meta tags a build is stamped into, or without them. */
const pageWith = (tags: Record<string, string>): Document => {
  const doc = document.implementation.createHTMLDocument('test');
  for (const [name, content] of Object.entries(tags)) {
    const meta = doc.createElement('meta');
    meta.setAttribute('name', name);
    meta.setAttribute('content', content);
    doc.head.append(meta);
  }
  return doc;
};

describe('appVersion', () => {
  it('is the version the build was stamped with', () => {
    expect(appVersion(pageWith({ 'wq-version': '0.3.107' }))).toBe('0.3.107');
  });

  it('names no version where nothing stamped one', () => {
    // A development server and the iPhone bundle serve the placeholder;
    // printing "development" as a version would read as a release name.
    expect(appVersion(pageWith({ 'wq-version': 'development' }))).toBe(
      DEV_VERSION,
    );
    expect(appVersion(pageWith({}))).toBe(DEV_VERSION);
    expect(appVersion(null)).toBe(DEV_VERSION);
  });
});

describe('appBuild', () => {
  it('reads the commit and time a deployment was stamped with', () => {
    const doc = pageWith({ 'wq-build': 'a1b2c3d 2026-11-10T13:20Z' });

    expect(appBuild(doc)).toBe('a1b2c3d 2026-11-10T13:20Z');
  });

  it('says nothing about a build nobody stamped', () => {
    expect(appBuild(pageWith({ 'wq-build': 'development' }))).toBeNull();
    expect(appBuild(pageWith({ 'wq-build': '  ' }))).toBeNull();
    expect(appBuild(pageWith({}))).toBeNull();
    expect(appBuild(null)).toBeNull();
  });
});
