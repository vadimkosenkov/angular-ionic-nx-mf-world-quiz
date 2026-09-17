/**
 * Maintenance tool: compares the curated dataset with Wikidata (CC0).
 *
 *   npx nx run quiz-countries:check-wikidata
 *
 * It never edits the dataset. It prints every place where Wikidata's current
 * English/Russian country or capital labels are not accepted by our dataset
 * (neither as the display value nor as an alias). A maintainer then decides
 * whether to update the dataset or to record the difference as intentional
 * in `INTENTIONAL_DIFFERENCES` below. Exit code 1 means "review needed".
 *
 * Requires network access. Not part of CI: Wikidata changes independently of
 * this repository and must not make builds flaky.
 */
import {
  acceptedAnswers,
  type Country,
  type QuizCategory,
  normalizeAnswer,
} from '@world-quiz/quiz/domain';
import { COUNTRIES } from '../src/lib/countries.data';

const ENDPOINT = 'https://query.wikidata.org/sparql';
const USER_AGENT =
  'world-quiz-dataset-check/1.0 (https://github.com/vadimkosenkov/angular-ionic-nx-mf-world-quiz)';

/**
 * Wikidata values we deliberately do not accept, in both languages
 * (compared after normalization). Key: `<code>:<category>`.
 */
const INTENTIONAL_DIFFERENCES: Readonly<
  Record<
    string,
    { readonly values: readonly string[]; readonly reason: string }
  >
> = {
  'il:capitals': {
    values: ['Tel Aviv', 'Тель-Авив'],
    reason:
      'Tel Aviv is not a capital; Wikidata lists it for diplomatic reasons.',
  },
  'nl:capitals': {
    values: ['The Hague', 'Гаага'],
    reason: 'The Hague is the seat of government, not the capital (Amsterdam).',
  },
  'pk:capitals': {
    values: ['Rawalpindi', 'Равалпинди'],
    reason: 'Rawalpindi was only an interim capital (1959–1967).',
  },
  'ps:capitals': {
    values: ['Jerusalem', 'Иерусалим'],
    reason:
      'Only "East Jerusalem" is accepted for Palestine, to keep it distinct from Israel.',
  },
};

function isIntentional(
  code: string,
  category: QuizCategory,
  key: string,
): boolean {
  return (INTENTIONAL_DIFFERENCES[`${code}:${category}`]?.values ?? [])
    .map(normalizeAnswer)
    .includes(key);
}

interface WikidataRow {
  readonly iso: string;
  readonly name?: string;
  readonly nameRu?: string;
  readonly capital?: string;
  readonly capitalRu?: string;
}

async function fetchWikidata(codes: readonly string[]): Promise<WikidataRow[]> {
  const values = codes.map((code) => `"${code.toUpperCase()}"`).join(' ');
  const query = `
    SELECT ?iso ?name ?nameRu ?capital ?capitalRu WHERE {
      VALUES ?iso { ${values} }
      ?country wdt:P297 ?iso .
      OPTIONAL { ?country rdfs:label ?name FILTER(lang(?name) = "en") }
      OPTIONAL { ?country rdfs:label ?nameRu FILTER(lang(?nameRu) = "ru") }
      OPTIONAL {
        ?country p:P36 ?statement .
        ?statement ps:P36 ?capitalItem .
        FILTER NOT EXISTS { ?statement pq:P582 ?end }
        OPTIONAL { ?capitalItem rdfs:label ?capital FILTER(lang(?capital) = "en") }
        OPTIONAL { ?capitalItem rdfs:label ?capitalRu FILTER(lang(?capitalRu) = "ru") }
      }
    }`;

  const response = await fetch(
    `${ENDPOINT}?query=${encodeURIComponent(query)}`,
    {
      headers: {
        Accept: 'application/sparql-results+json',
        'User-Agent': USER_AGENT,
      },
    },
  );
  if (!response.ok) {
    throw new Error(`Wikidata responded with HTTP ${response.status}`);
  }

  const body = (await response.json()) as {
    results: { bindings: Record<string, { value: string } | undefined>[] };
  };
  return body.results.bindings.map((binding) => ({
    iso: (binding['iso']?.value ?? '').toLowerCase(),
    name: binding['name']?.value,
    nameRu: binding['nameRu']?.value,
    capital: binding['capital']?.value,
    capitalRu: binding['capitalRu']?.value,
  }));
}

function findIssues(country: Country, rows: readonly WikidataRow[]): string[] {
  if (rows.length === 0) {
    return ['not found in Wikidata by ISO code'];
  }

  const issues = new Set<string>();
  const check = (category: QuizCategory, value: string | undefined) => {
    if (!value) return;
    const key = normalizeAnswer(value);
    const accepted = acceptedAnswers(country, category).map(normalizeAnswer);
    if (accepted.includes(key) || isIntentional(country.code, category, key)) {
      return;
    }
    const field = category === 'capitals' ? 'capital' : 'name';
    issues.add(`${field} "${value}" is not accepted`);
  };

  for (const row of rows) {
    check('flags', row.name);
    check('flags', row.nameRu);
    check('capitals', row.capital);
    check('capitals', row.capitalRu);
  }
  return [...issues];
}

async function main(): Promise<void> {
  const rows = await fetchWikidata(COUNTRIES.map((country) => country.code));
  let problems = 0;

  for (const country of COUNTRIES) {
    const issues = findIssues(
      country,
      rows.filter((row) => row.iso === country.code),
    );
    for (const issue of issues) {
      problems++;
      console.log(`${country.code} (${country.name.en}): ${issue}`);
    }
  }

  console.log(
    problems === 0
      ? `OK: all ${COUNTRIES.length} countries match Wikidata.`
      : `${problems} difference(s) to review. See docs/domain/countries.md.`,
  );
  process.exitCode = problems === 0 ? 0 : 1;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 2;
});
