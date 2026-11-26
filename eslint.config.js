// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // NestJS reads constructor parameter types at runtime (decorator metadata) to inject
    // dependencies, so those imports must stay value imports. With these parser options,
    // consistent-type-imports leaves files that use decorators alone.
    files: ['apps/api/**/*.ts'],
    languageOptions: {
      parserOptions: { emitDecoratorMetadata: true, experimentalDecorators: true },
    },
    rules: {
      // Nest modules are empty classes carrying a @Module decorator.
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
    },
  },
  prettier,
);
