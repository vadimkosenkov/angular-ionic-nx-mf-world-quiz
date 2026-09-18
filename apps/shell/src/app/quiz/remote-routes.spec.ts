import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { loadRemoteModule } from '@angular-architects/native-federation';
import type { Routes } from '@angular/router';
import { loadQuizRemoteRoutes } from './remote-routes';
import { RemoteUnavailablePage } from './remote-unavailable.page';

vi.mock('@angular-architects/native-federation', () => ({
  loadRemoteModule: vi.fn(),
}));

const loadRemoteModuleMock = vi.mocked(loadRemoteModule);

function load(): Promise<Routes> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({});
  return TestBed.runInInjectionContext(() => loadQuizRemoteRoutes('capitals'));
}

describe('loadQuizRemoteRoutes', () => {
  it('returns the routes the remote exposes', async () => {
    const remoteRoutes: Routes = [{ path: '', redirectTo: '/home' }];
    loadRemoteModuleMock.mockResolvedValue({ remoteRoutes });

    await expect(load()).resolves.toBe(remoteRoutes);
    expect(loadRemoteModuleMock).toHaveBeenCalledWith('capitals', './routes');
  });

  it('reports the failure and falls back to a recoverable page', async () => {
    const failure = new Error('remoteEntry.json not reachable');
    loadRemoteModuleMock.mockRejectedValue(failure);
    const handleError = vi.fn();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: ErrorHandler, useValue: { handleError } }],
    });
    const routes = await TestBed.runInInjectionContext(() =>
      loadQuizRemoteRoutes('capitals'),
    );

    expect(handleError).toHaveBeenCalledWith(failure);
    expect(routes[0]?.component).toBe(RemoteUnavailablePage);
  });
});
