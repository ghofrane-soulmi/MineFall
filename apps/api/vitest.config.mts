import { defineConfig } from 'vitest/config';

/**
 * API tests. Vite compiles TypeScript with Oxc, which honours `emitDecoratorMetadata` from
 * tsconfig.json, so NestJS dependency injection works in tests without extra plugins.
 * `@minefall/shared` resolves to its TypeScript source (package "default" export).
 */
export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
    testTimeout: 15_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/main.ts', 'src/**/*.spec.ts'],
    },
  },
});
