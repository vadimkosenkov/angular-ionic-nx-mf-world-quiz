export type GreetingKey = 'morning' | 'afternoon' | 'evening' | 'night';

/** Time-of-day greeting for a local hour (0–23). */
export function greetingFor(hour: number): GreetingKey {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 23) return 'evening';
  return 'night';
}
