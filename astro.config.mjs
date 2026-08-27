// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// Static output: fast on poor connections, free to host, no server to maintain.
export default defineConfig({
  site: 'https://noorture.com',
  vite: {
    plugins: [tailwindcss()],
  },
});
