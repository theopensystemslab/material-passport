import { dirname } from 'path'
import { fileURLToPath } from 'url'

import { FlatCompat } from '@eslint/eslintrc'
import stylistic from '@stylistic/eslint-plugin'
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript'
import importNewlines from 'eslint-plugin-import-newlines'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

const eslintConfig = [
  ...compat.extends(
    'next/core-web-vitals',
    'next/typescript',
    'prettier',
    'plugin:import-x/recommended',
    'plugin:import-x/typescript',
  ),
  {
    plugins: {
      'import-newlines': importNewlines,
      '@stylistic': stylistic,
    },
    rules: {
      // enforce some explicit eslint rules as code style prefs, which can be enforced with `pnpm fix`
      '@stylistic/semi': ['warn', 'never'],
      '@stylistic/indent': ['warn', 2],
      '@stylistic/quotes': ['warn', 'single'],
      '@stylistic/jsx-quotes': ['warn', 'prefer-double'],
      'sort-imports'  : ['warn', {
        ignoreCase: false,
        ignoreDeclarationSort: true, // leave this to eslint-plugin-import
        ignoreMemberSort: false,
        memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'],
        allowSeparatedGroups: true, // respect groupings as defined below
      }],
      'import-newlines/enforce': ['warn', 2],
      // below config enables auto-fixing import order
      // see: https://medium.com/weekly-webtips/how-to-sort-imports-like-a-pro-in-typescript-4ee8afd7258a
      'import-x/no-unresolved': 'error',
      'import-x/order': ['warn', {
        'groups': [
          'builtin',
          'external',
          'internal',
          ['sibling', 'parent'],
          'index',
          'unknown',
        ],
        'newlines-between': 'always',
        'alphabetize': {
          order: 'asc',
          caseInsensitive: true,
        },
      }]
    },
    // eslint-import-resolver-typescript extends eslint config
    settings: {
      'import-x/resolver-next': [
        createTypeScriptImportResolver({
          alwaysTryTypes: true,
        })
      ]
    }
  }
]

export default eslintConfig
