import { defineConfig } from 'vite';

// Photos are inlined so the site ships as one small set of files.
// HOSTED=1 builds the copy served at jqin110-tech.github.io, which links to its own source code.
export default defineConfig({
  base: './',
  build: { assetsInlineLimit: 600000 },
  define: { __HOSTED__: JSON.stringify(process.env.HOSTED === '1') },
});
