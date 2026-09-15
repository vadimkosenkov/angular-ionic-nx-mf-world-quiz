import nx from '@nx/eslint-plugin';

/**
 * Architectural boundaries (see docs/architecture/nx.md).
 *
 * Every project has two tags:
 *   scope:*  – who may use it (shell, capitals, flags, api, site, client, shared)
 *   type:*   – what kind of code it is (app, e2e, feature, ui, data-access,
 *              ports, contracts, domain, util)
 *
 * A dependency is allowed only if it satisfies BOTH the scope and type rules.
 * Some tags (feature, ui, ports, client, site…) have no projects yet; the
 * rules are declared up front so new libraries fall into the agreed layers.
 */

/** Imports that make code framework-, browser- or Node-specific. */
const PLATFORM_SPECIFIC_IMPORTS = [
  '@angular/*',
  '@ionic/*',
  '@capacitor/*',
  '@capacitor-community/*',
  'rxjs',
  'rxjs/*',
  'zone.js',
  'express',
  'dexie',
  'drizzle-orm',
  'drizzle-orm/*',
];

const NODE_BUILTIN_PATTERNS = [
  'node:*',
  'assert',
  'buffer',
  'child_process',
  'crypto',
  'events',
  'fs',
  'fs/*',
  'http',
  'https',
  'net',
  'os',
  'path',
  'process',
  'stream',
  'url',
  'util',
  'worker_threads',
];

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['**/dist', '**/out-tsc', '**/vitest.config.*.timestamp*'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            // ---- scope rules --------------------------------------------
            {
              sourceTag: 'scope:shared',
              onlyDependOnLibsWithTags: ['scope:shared'],
            },
            {
              sourceTag: 'scope:client',
              onlyDependOnLibsWithTags: ['scope:client', 'scope:shared'],
            },
            {
              sourceTag: 'scope:shell',
              onlyDependOnLibsWithTags: [
                'scope:shell',
                'scope:client',
                'scope:shared',
              ],
            },
            {
              sourceTag: 'scope:capitals',
              onlyDependOnLibsWithTags: [
                'scope:capitals',
                'scope:client',
                'scope:shared',
              ],
            },
            {
              sourceTag: 'scope:flags',
              onlyDependOnLibsWithTags: [
                'scope:flags',
                'scope:client',
                'scope:shared',
              ],
            },
            {
              sourceTag: 'scope:api',
              onlyDependOnLibsWithTags: ['scope:api', 'scope:shared'],
            },
            {
              sourceTag: 'scope:site',
              onlyDependOnLibsWithTags: ['scope:site', 'scope:shared'],
            },

            // ---- type (layer) rules -------------------------------------
            {
              sourceTag: 'type:app',
              onlyDependOnLibsWithTags: [
                'type:feature',
                'type:ui',
                'type:data-access',
                'type:ports',
                'type:contracts',
                'type:domain',
                'type:util',
              ],
            },
            {
              sourceTag: 'type:e2e',
              onlyDependOnLibsWithTags: ['type:contracts', 'type:util'],
            },
            {
              sourceTag: 'type:feature',
              onlyDependOnLibsWithTags: [
                'type:feature',
                'type:ui',
                'type:data-access',
                'type:ports',
                'type:contracts',
                'type:domain',
                'type:util',
              ],
            },
            {
              sourceTag: 'type:ui',
              onlyDependOnLibsWithTags: ['type:ui', 'type:domain', 'type:util'],
            },
            {
              sourceTag: 'type:data-access',
              onlyDependOnLibsWithTags: [
                'type:data-access',
                'type:ports',
                'type:contracts',
                'type:domain',
                'type:util',
              ],
            },
            {
              sourceTag: 'type:ports',
              onlyDependOnLibsWithTags: [
                'type:contracts',
                'type:domain',
                'type:util',
              ],
            },
            {
              sourceTag: 'type:contracts',
              onlyDependOnLibsWithTags: [
                'type:contracts',
                'type:domain',
                'type:util',
              ],
              bannedExternalImports: PLATFORM_SPECIFIC_IMPORTS,
            },
            {
              // The quiz domain is shared by the Angular apps AND the Express API.
              sourceTag: 'type:domain',
              onlyDependOnLibsWithTags: ['type:domain', 'type:util'],
              bannedExternalImports: [...PLATFORM_SPECIFIC_IMPORTS, 'zod'],
            },
            {
              sourceTag: 'type:util',
              onlyDependOnLibsWithTags: ['type:util'],
              bannedExternalImports: [...PLATFORM_SPECIFIC_IMPORTS, 'zod'],
            },
          ],
        },
      ],
    },
  },
];

/**
 * Extra rules for platform-independent libraries (quiz domain, shared util).
 * Apply in the library's own eslint.config.mjs: `[...baseConfig, ...pureLibraryConfig]`.
 */
export const pureLibraryConfig = [
  {
    // Node built-ins are not npm packages, so `bannedExternalImports` cannot see
    // them. Pure libraries additionally ban them (and browser globals) here.
    files: ['src/**/*.ts'],
    ignores: ['**/*.spec.ts', '**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: NODE_BUILTIN_PATTERNS,
              message:
                'Pure libraries must not depend on Node.js built-ins. Inject an abstraction instead.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        ...[
          'window',
          'document',
          'navigator',
          'localStorage',
          'sessionStorage',
          'indexedDB',
        ].map((name) => ({
          name,
          message:
            'Pure libraries must not use browser globals. Inject an abstraction instead.',
        })),
        ...['process', 'Buffer', '__dirname', '__filename', 'require'].map(
          (name) => ({
            name,
            message:
              'Pure libraries must not use Node.js globals. Inject an abstraction instead.',
          }),
        ),
      ],
    },
  },
];
