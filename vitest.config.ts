import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/helpers/setup.ts'],
    fileParallelism: false,
    coverage: {
      reporter: ['text', 'html'],
      include: ['src/server/**/*.ts', 'src/app/api/**/*.ts']
    }
  },
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname
    }
  }
})
