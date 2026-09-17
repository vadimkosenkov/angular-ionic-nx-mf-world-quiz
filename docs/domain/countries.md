# Country dataset

> Status: **implemented** (Phase 2). Code: [`libs/quiz/countries`](../../libs/quiz/countries).
> Decision record: [ADR-008](../decisions/ADR-008-country-data.md).

## Scope

**195 countries** = 193 UN member states + 2 UN General Assembly observer
states (**Vatican City**, **Palestine**).

| Excluded                                                            | Why                                                     |
| ------------------------------------------------------------------- | ------------------------------------------------------- |
| Kosovo (`xk`)                                                       | Partially recognized, not a UN member or observer state |
| Taiwan (`tw`)                                                       | Not a UN member or observer state                       |
| Western Sahara (`eh`)                                               | Non-self-governing territory, disputed                  |
| Dependencies and territories (Greenland, Puerto Rico, Hong Kong, …) | Not sovereign states                                    |

The rule is objective (UN membership/observer status), which avoids judging
recognition case by case. A unit test asserts the three excluded codes are absent.

## Record format

```ts
{
  code: 'bo',                                  // ISO 3166-1 alpha-2, lowercase
  region: 'south-america',                     // one of 6 app regions
  subregion: 'south-america',                  // UN M49 sub-region
  name:    { en: 'Bolivia', ru: 'Боливия' },   // displayed
  capital: { en: 'Sucre',   ru: 'Сукре' },     // displayed
  capitalAliases: { en: ['La Paz'], ru: ['Ла-Пас'] }, // accepted in Hard mode only
}
```

- **Identifier:** the ISO alpha-2 code. It is stable and matches the flag file names.
- **Flag reference:** derived, not stored: `flagAssetPath(code)` → `flags/<code>.svg`.
- **Aliases** are never displayed and never used as Easy-mode choices.

## Sources

| Data                                      | Source                                                                              | License            |
| ----------------------------------------- | ----------------------------------------------------------------------------------- | ------------------ |
| English/Russian country and capital names | [Wikidata](https://www.wikidata.org) (labels, property P36 "capital"), then curated | CC0                |
| Region / sub-region                       | [UN M49 standard](https://unstats.un.org/unsd/methodology/m49/)                     | Public UN standard |
| Flags                                     | [`flag-icons`](https://github.com/lipis/flag-icons) 7.5.0, 4:3 SVGs                 | MIT                |

Wikidata was queried once to bootstrap the file. From then on,
[`countries.data.ts`](../../libs/quiz/countries/src/lib/countries.data.ts) is the
**hand-maintained source of truth**; Wikidata is only used to detect drift (see _Updating_).

## Regions

The app's six regions follow UN M49. The Americas are split the way M49
groups them:

| App region    | M49 sub-regions                                             | Countries |
| ------------- | ----------------------------------------------------------- | --------- |
| Europe        | Eastern, Northern, Southern, Western Europe                 | 44        |
| Asia          | Central, Eastern, South-eastern, Southern, Western Asia     | 48        |
| Africa        | Northern, Eastern, Middle, Southern, Western Africa         | 54        |
| North America | Northern America, Central America, Caribbean                | 23        |
| South America | South America                                               | 12        |
| Oceania       | Australia and New Zealand, Melanesia, Micronesia, Polynesia | 14        |

Consequences worth knowing, because players may expect otherwise:

- **Russia** is in Europe (M49 Eastern Europe), even though most of its territory is in Asia.
- **Türkiye, Cyprus, Georgia, Armenia, Azerbaijan** are in Asia (M49 Western Asia).
- **Egypt** is in Africa; **Kazakhstan** is in Asia.
- **Mexico, Central America and the Caribbean** are in North America.

Sub-regions also drive Easy-mode distractors (neighbours first), see
[quiz-engine.md](quiz-engine.md).

## Naming rules

- **Display names are the common short form**, not the full official name:
  "Bolivia", not "Plurinational State of Bolivia"; "США"; "Великобритания".
- **Current UN English names are used where they are established:** "Czechia",
  "Cabo Verde", "Eswatini", "North Macedonia", "Timor-Leste", "Côte d'Ivoire".
  Former or common alternatives are aliases ("Czech Republic", "Cape Verde",
  "Swaziland", "Macedonia", "East Timor", "Ivory Coast").
- **Exceptions for recognizability:** "Turkey" (alias "Türkiye").
- **Russian** uses established Russian usage: "Киев", "Кишинёв", "Беларусь"
  (alias "Белоруссия"), "Кыргызстан" (alias "Киргизия").
- `ё` is written where standard; matching treats `ё` and `е` as equal.
- **Capital names equal to country names are kept as-is** (Djibouti, Luxembourg,
  Singapore, Russian "Алжир", "Тунис", "Панама").

## Countries with more than one capital (known ambiguities)

The primary or official seat is displayed; other legitimate capitals are
accepted in Hard mode. Each case is also commented in the data file.

| Country           | Displayed                 | Also accepted           | Note                                                                           |
| ----------------- | ------------------------- | ----------------------- | ------------------------------------------------------------------------------ |
| Bolivia           | Sucre                     | La Paz                  | Constitutional capital vs seat of government                                   |
| South Africa      | Pretoria                  | Cape Town, Bloemfontein | Executive / legislative / judicial                                             |
| Benin             | Porto-Novo                | Cotonou                 | Constitutional capital vs seat of government                                   |
| Côte d'Ivoire     | Yamoussoukro              | Abidjan                 | Official capital vs economic centre                                            |
| Burundi           | Gitega                    | Bujumbura               | Political capital since 2019                                                   |
| Eswatini          | Mbabane                   | Lobamba                 | Executive vs legislative/royal                                                 |
| Sri Lanka         | Sri Jayawardenepura Kotte | Kotte, Colombo          | Legislative vs executive/commercial                                            |
| Malaysia          | Kuala Lumpur              | Putrajaya               | Official capital vs administrative centre                                      |
| Yemen             | Sanaa                     | Aden                    | Constitutional vs temporary capital                                            |
| Indonesia         | Jakarta                   | Nusantara               | New capital under construction                                                 |
| Equatorial Guinea | Malabo                    | Ciudad de la Paz        | Designated future capital                                                      |
| Nauru             | Yaren                     | Yaren District          | No official capital; seat of government                                        |
| **Israel**        | Jerusalem                 | —                       | Proclaimed capital; status disputed internationally. Tel Aviv is not accepted. |
| **Palestine**     | Ramallah                  | East Jerusalem          | Ramallah is the administrative seat; East Jerusalem is the proclaimed capital  |
| Netherlands       | Amsterdam                 | —                       | The Hague is the seat of government, not a capital                             |
| Tanzania          | Dodoma                    | —                       | Dar es Salaam is a former capital                                              |
| Kazakhstan        | Astana                    | —                       | "Nur-Sultan" (2019–2022) is not accepted                                       |

**Palestine design note:** displaying Ramallah avoids an Easy-mode question
where "Jerusalem" (Israel) and "East Jerusalem" (Palestine) could appear
together as choices. The product owner can switch the displayed value to East
Jerusalem by swapping the two values in the data file; no code change is needed.

## Updating the dataset

1. Run the drift check (requires network):
   ```bash
   npx nx run quiz-countries:check-wikidata
   ```
   It lists every current Wikidata English/Russian name or capital that the
   dataset does not accept, except the documented intentional differences
   (Tel Aviv, The Hague, Rawalpindi, Jerusalem for Palestine). Exit code 1 means "review needed".
2. Edit [`countries.data.ts`](../../libs/quiz/countries/src/lib/countries.data.ts) by hand:
   change the display value, add an alias, or record an intentional difference
   in `libs/quiz/countries/tools/check-wikidata.ts`.
3. Run the tests. They verify:
   - 195 entries, the scope rule and region counts;
   - structural validity (codes, scripts, sub-region ↔ region);
   - display values are unique per locale (Easy choices never show duplicate labels);
   - no accepted answer is shared by two countries, and every display value is
     correct only for its own country (all 195 × 195 pairs, both categories and locales);
   - a flag SVG exists for every country.
   ```bash
   npx nx test quiz-countries
   ```
4. For a scope change (a new UN member), add the entry and update the counts in the tests and in this document.

Flags are updated by bumping `flag-icons` in `package.json`; the flag test
fails if a country's SVG disappears.

## Flag assets

- **Package:** `flag-icons`, 4:3 variant. It was chosen over
  `country-flag-icons`: the latter is lighter but simplifies emblems and colours,
  which matters for a flag-recognition quiz (Ecuador vs Colombia, Moldova vs
  Andorra vs Romania).
- **Size:** about 2.7 MB for all 271 SVGs, uncompressed; a few detailed flags
  (Serbia, Bolivia, Mexico, Spain) are 80–180 KB each. SVG compresses well; web
  apps load flags lazily, iOS bundles them.
- **Offline:** apps copy the files into their build (`FLAG_ICONS_SOURCE_DIRECTORY`
  → `flags/`), so no network is needed. The build rule is added with the app UI (Phase 3/4).
- **License:** MIT. The license text must ship with the app; this is done when
  the asset rule is added.
