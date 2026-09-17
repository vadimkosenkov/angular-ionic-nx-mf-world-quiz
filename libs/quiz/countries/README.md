# quiz-countries

`@world-quiz/quiz/countries` · tags: `scope:shared`, `type:domain`

The static, offline country dataset: **195 countries** (193 UN members +
Vatican City + Palestine) with English and Russian names and capitals, Hard-mode
aliases, UN M49 regions and sub-regions, and flag asset paths.

Full documentation (scope, sources, naming rules, ambiguous capitals,
update procedure): [docs/domain/countries.md](../../../docs/domain/countries.md).
Decision record: [ADR-008](../../../docs/decisions/ADR-008-country-data.md).

## Usage

```ts
import { COUNTRIES, flagAssetPath } from '@world-quiz/quiz/countries';
import { createQuizEngine } from '@world-quiz/quiz/domain';

const engine = createQuizEngine(COUNTRIES);
flagAssetPath('fr'); // 'flags/fr.svg'
```

## Commands

```bash
npx nx test quiz-countries                  # dataset, flags, real-data matching, challenge replay
npx nx typecheck quiz-countries
npx nx run quiz-countries:check-wikidata    # manual drift check against Wikidata (network)
```

## Third-party data

| Data                      | Source                                                                      | License                                                               |
| ------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Country and capital names | Wikidata (bootstrapped, then curated)                                       | CC0 1.0                                                               |
| Regions                   | UN M49 standard                                                             | UN public standard                                                    |
| Flag SVGs                 | [`flag-icons`](https://github.com/lipis/flag-icons) by Panayiotis Lipiridis | MIT: the license text must be shipped with apps that bundle the flags |
