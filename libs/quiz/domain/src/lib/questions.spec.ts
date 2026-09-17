import { FIXTURE_DATASET } from '../testing/fixture-dataset';
import type { Country } from './country';
import { countriesInScope, indexCountriesByCode } from './country';
import { createQuestionSource, generateChoices } from './questions';
import { createSeededRandom } from './random';

const byCode = indexCountriesByCode(FIXTURE_DATASET);
const get = (code: string) => byCode.get(code) as Country;

describe('generateChoices', () => {
  it('returns four distinct options including the correct one', () => {
    for (let run = 0; run < 50; run++) {
      const choices = generateChoices(
        get('fr'),
        FIXTURE_DATASET,
        createSeededRandom(`run-${run}`),
      );
      expect(choices).toHaveLength(4);
      expect(new Set(choices).size).toBe(4);
      expect(choices).toContain('fr');
    }
  });

  it('prefers distractors from the same sub-region', () => {
    // Western Europe in the fixture: fr, de, at, ch → exactly the other three.
    const choices = generateChoices(
      get('fr'),
      FIXTURE_DATASET,
      createSeededRandom('x'),
    );
    expect([...choices].sort()).toEqual(['at', 'ch', 'de', 'fr']);
  });

  it('falls back to the same region, then the rest of the world', () => {
    // Eastern Asia has only Japan; Asia adds Iran and Iraq; one more comes from elsewhere.
    const choices = generateChoices(
      get('jp'),
      FIXTURE_DATASET,
      createSeededRandom('y'),
    );
    expect(choices).toEqual(expect.arrayContaining(['jp', 'ir', 'iq']));
    const other = choices.find((code) => !['jp', 'ir', 'iq'].includes(code));
    expect(get(other as string).region).not.toBe('asia');
  });

  it('places the correct answer at different positions across questions', () => {
    const positions = new Set(
      Array.from({ length: 40 }, (_, run) =>
        generateChoices(
          get('fr'),
          FIXTURE_DATASET,
          createSeededRandom(`p-${run}`),
        ).indexOf('fr'),
      ),
    );
    expect(positions.size).toBe(4);
  });

  it('returns fewer options when the dataset is too small', () => {
    const tiny = [get('fr'), get('de')];
    expect(
      [...generateChoices(get('fr'), tiny, createSeededRandom('z'))].sort(),
    ).toEqual(['de', 'fr']);
  });
});

describe('createQuestionSource', () => {
  const europe = countriesInScope(FIXTURE_DATASET, 'europe');
  const source = (
    overrides: Partial<Parameters<typeof createQuestionSource>[0]> = {},
  ) =>
    createQuestionSource({
      dataset: FIXTURE_DATASET,
      pool: europe,
      difficulty: 'easy',
      length: 5,
      seed: 'seed-1',
      ...overrides,
    });
  const codes = (s: ReturnType<typeof source>, count: number) =>
    Array.from(
      { length: count },
      (_, index) => s.questionAt(index).countryCode,
    );

  it('is deterministic: same seed, same questions and choices', () => {
    const a = source();
    const b = source();
    for (let index = 0; index < 5; index++) {
      expect(a.questionAt(index)).toEqual(b.questionAt(index));
    }
  });

  it('changes with the seed', () => {
    expect(codes(source({ length: 9 }), 9)).not.toEqual(
      codes(source({ length: 9, seed: 'seed-2' }), 9),
    );
  });

  it('never repeats a country within a fixed-length session', () => {
    const questions = codes(source({ length: europe.length }), europe.length);
    expect(new Set(questions).size).toBe(europe.length);
    expect(questions.every((code) => get(code).region === 'europe')).toBe(true);
  });

  it('adds choices only in Easy mode', () => {
    expect(source().questionAt(0).choices).toHaveLength(4);
    expect(
      source({ difficulty: 'hard' }).questionAt(0).choices,
    ).toBeUndefined();
  });

  it('rejects out-of-range indexes for fixed lengths', () => {
    expect(() => source().questionAt(5)).toThrow(RangeError);
    expect(() => source().questionAt(-1)).toThrow(RangeError);
    expect(() => source().questionAt(1.5)).toThrow(RangeError);
  });

  it('validates its options', () => {
    expect(() => source({ pool: [] })).toThrow(RangeError);
    expect(() => source({ length: 0 })).toThrow(RangeError);
    expect(() => source({ length: europe.length + 1 })).toThrow(RangeError);
  });

  describe('unlimited length (Endless, Timed)', () => {
    const unlimited = source({ length: null });

    it('cycles through the whole pool before repeating', () => {
      const n = europe.length;
      const all = codes(unlimited, n * 4);
      for (let cycle = 0; cycle < 4; cycle++) {
        expect(new Set(all.slice(cycle * n, (cycle + 1) * n)).size).toBe(n);
      }
    });

    it('never asks the same country twice in a row', () => {
      for (let seed = 0; seed < 30; seed++) {
        const all = codes(
          source({ length: null, seed: `s${seed}` }),
          europe.length * 5,
        );
        all
          .slice(1)
          .forEach((code, index) => expect(code).not.toBe(all[index]));
      }
    });

    it('repeats the only country of a single-country pool', () => {
      const single = source({ length: null, pool: [get('fr')] });
      expect(codes(single, 3)).toEqual(['fr', 'fr', 'fr']);
      expect(single.length).toBeNull();
      expect(single.poolSize).toBe(1);
    });
  });
});
