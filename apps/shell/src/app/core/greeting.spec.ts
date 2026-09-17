import { greetingFor } from './greeting';

describe('greetingFor', () => {
  it.each([
    [0, 'night'],
    [4, 'night'],
    [5, 'morning'],
    [11, 'morning'],
    [12, 'afternoon'],
    [17, 'afternoon'],
    [18, 'evening'],
    [22, 'evening'],
    [23, 'night'],
  ] as const)('%i:00 → %s', (hour, expected) => {
    expect(greetingFor(hour)).toBe(expected);
  });
});
