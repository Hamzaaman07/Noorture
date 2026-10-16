// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';

// Static output: fast on poor connections, free to host, no server to maintain.
export default defineConfig({
  site: 'https://noorture.com',
  integrations: [
    // React exists on this site for exactly one thing: the WebGL ambience,
    // which is react-three-fiber. Nothing else is an island.
    react(),
    sitemap({
      // The 404 has no business in a sitemap.
      filter: (page) => !page.includes('/404'),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
