import type { AuthResponse, User } from '@world-quiz/shared/contracts';

export const API = 'http://api.test';

export const USER: User = {
  id: '1f0e6b8f-0000-4000-8000-000000000001',
  displayName: 'Ann',
  nickname: 'Ann the Explorer',
  email: 'ann@example.com',
  providers: ['google'],
  createdAt: '2026-09-21T10:00:00.000Z',
};

export const session = (accessToken = 'access-1'): AuthResponse => ({
  user: USER,
  accessToken,
  accessTokenExpiresAt: '2026-09-21T10:15:00.000Z',
});
