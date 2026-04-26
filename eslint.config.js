// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    files: ["src/app/**/*.tsx", "src/app/**/*.ts"],
    rules: {
      // Architecture boundary: UI/app layer must not import data/network internals directly.
      // All data access must go through repositories or hooks.
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['@/core/data/database/client', '@/core/supabase/client'],
            message: 'UI layer must not import database or Supabase clients directly. Use repositories or hooks instead.',
          },
        ],
      }],
    },
  },
]);
