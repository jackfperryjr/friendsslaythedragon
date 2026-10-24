import { defineConfig } from 'vitest/config'

// Unit tests for the game's pure logic (no Phaser rendering). Run: npm test
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
