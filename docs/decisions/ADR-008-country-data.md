# ADR-008: Curated static country dataset (Wikidata + UN M49) and `flag-icons` SVGs

## Status

Accepted (2026-09-16)

## Context

The quiz must work offline, in English and Russian, for a clearly defined set
of 195 countries (193 UN members + Vatican City + Palestine). It needs
country names, capitals, regions and flags. Hard mode also needs alternative
accepted spellings and additional legitimate capitals. The data ships inside
the app, so its license must allow redistribution.

## Decision

1. **A hand-maintained TypeScript file** (`libs/quiz/countries/src/lib/countries.data.ts`)
   is the source of truth, validated by tests.
2. It was **bootstrapped from Wikidata** (CC0) and is **checked for drift** with
   a manual tool (`nx run quiz-countries:check-wikidata`), which is not part of CI.
3. **Regions follow UN M49**, with the Americas split into North America
   (Northern America, Central America, Caribbean) and South America. M49
   sub-regions are stored too and drive Easy-mode distractors.
4. **Flags come from the `flag-icons` npm package** (MIT, 4:3 SVG). Apps copy
   them into their build; the dataset derives paths from the ISO code.
5. The domain engine takes the dataset as a parameter; `quiz-domain` does not
   import `quiz-countries`, so domain tests use a small fixture and
   real-dataset tests live in `quiz-countries`.

## Alternatives

| Alternative                                           | Why not                                                                                                                                       |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **REST Countries API at runtime**                     | Breaks offline play; external availability becomes a product dependency                                                                       |
| **`world-countries` npm package** (mledoze)           | Good data, but ODbL share-alike obligations for a bundled database; no Russian capital names                                                  |
| **Generate the dataset from Wikidata on every build** | Upstream edits (vandalism, renames, the Rawalpindi/Tel Aviv capital statements) would silently change the quiz; curated aliases would be lost |
| **Store the dataset in PostgreSQL**                   | The quiz must work offline, and the data is static; the server imports the same TypeScript module                                             |
| **JSON file instead of TypeScript**                   | Loses compile-time checking of region/sub-region literals                                                                                     |
| **`country-flag-icons`** (MIT, actively released)     | Much smaller, but flags are stylized: simplified emblems and non-standard colours. Recognizing real flags is the point of the Flags quiz.     |
| **Committing copied SVGs**                            | Duplicates 2.7 MB of third-party files in git; updating would be a manual copy                                                                |
| **Emoji flags**                                       | Rendered differently per platform; Windows shows letters instead of flags                                                                     |

## Consequences

**Positive**

- Offline by construction; the same data runs in the browser, the WebView and Node.
- Every curation choice is visible in code review, with comments for ambiguous capitals.
- Clean licensing: CC0 names, UN standard regions, MIT flags.
- Tests catch structural mistakes, duplicate labels, answer collisions between
  countries, and missing flags.

**Negative**

- Updates are manual. The drift tool reduces the effort but needs a maintainer.
- `flag-icons` had its last release in May 2025. Flags change rarely; if the
  package is abandoned, the SVGs can be vendored.
- Detailed flags make the bundle larger (≈2.7 MB uncompressed for all files).
  Optimization (SVGO, only copying the 195 needed files) is deferred until measured.
- M49 places some countries where players might not expect them (Russia in
  Europe; Cyprus and Türkiye in Asia). This is documented in `docs/domain/countries.md`.

## Rationale

A small curated dataset under version control is the simplest approach that
satisfies offline use, two languages, auditable edge-case decisions and clean
licensing. Wikidata gives a trustworthy, license-free starting point, and the
drift tool keeps the manual process honest.
