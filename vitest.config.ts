import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
  },
  resolve: {
    alias: {
      '@webstack': resolve(__dirname, 'src/webstack'),
      '@ui': resolve(__dirname, 'src/modules/ui'),
      '@shared': resolve(__dirname, 'src/modules/shared'),
      '@Canopy': resolve(__dirname, 'src/modules/apps/Canopy'),
      '@': resolve(__dirname, 'src'),
      '~': resolve(__dirname),
    },
  },
});
