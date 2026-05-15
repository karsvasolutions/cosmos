import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://cosmos.example.com',
  compressHTML: true,
  build: {
    inlineStylesheets: 'auto',
  },
});
