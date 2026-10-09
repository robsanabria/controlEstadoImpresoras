// ESLint 9 (flat config) para el backend Express (CommonJS).
// npm i -D eslint @eslint/js globals eslint-config-prettier
// package.json: "lint": "eslint ."
const js = require('@eslint/js');
const globals = require('globals');
const prettier = require('eslint-config-prettier');

module.exports = [
  { ignores: ['client/**', 'node_modules/**', 'dist/**'] },
  js.configs.recommended,
  prettier,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_|^next$' }],
      'no-console': 'off',
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'warn',
    },
  },
  // Los tests corren en vitest (ESM), no en CommonJS como el resto del backend.
  {
    files: ['test/**/*.js'],
    languageOptions: { sourceType: 'module' },
  },
];
