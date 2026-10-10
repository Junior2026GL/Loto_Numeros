import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/', 'backups/'] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      // Parámetros sin usar que empiezan con _ son intencionales (firmas de Express, etc.).
      'no-unused-vars': ['error', { argsIgnorePattern: '^_|^next$|^req$|^res$', varsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
];
