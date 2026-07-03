import { defineConfig } from 'vite'

// base './' so the built app can be dropped into any path on a static host
// (e.g. cerv.one/topoloco/) without rebuilding.
export default defineConfig({
  base: './',
})
