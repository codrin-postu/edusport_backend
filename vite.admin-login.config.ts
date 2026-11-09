import path from 'node:path';
import { defineConfig } from 'vite';

/**
 * The `/intrare` page bundle (6b-1 T16): src/admin-login, built into dist/admin-login and served by `global::admin-login-page`
 * under `/intrare/` (the hashed files under `/intrare/assets/`). It imports src/admin/ui files one by one, never the ui index
 * (that pulls in the Strapi admin package).
 */
export default defineConfig({
  root: path.resolve(__dirname, 'src/admin-login'),
  base: '/intrare/',
  publicDir: false,
  esbuild: { jsx: 'automatic' },
  build: {
    outDir: path.resolve(__dirname, 'dist/admin-login'),
    emptyOutDir: true,
    assetsDir: 'assets',
    sourcemap: false,
  },
});
