import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // Ratchet: these are the existing backlog. They stay visible as warnings
      // so CI fails only on genuine breakage (undefined vars, syntax, bad
      // hook usage), and the backlog can be burned down file by file without
      // blocking every unrelated change. Promote back to 'error' once a
      // category reaches zero.
      'no-unused-vars': ['warn', { varsIgnorePattern: '^[A-Z_]' }],
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-refresh/only-export-components': 'warn',
      'no-empty': 'warn',
      'no-useless-escape': 'warn',
    },
  },
  {
    // Node-run config/tooling files: give them Node globals so `process`
    // resolves (they are not browser code).
    files: ['*.config.js', 'vite.config.js', 'playwright.config.js', 'e2e/**/*.js'],
    languageOptions: { globals: { ...globals.node } },
  },
])
