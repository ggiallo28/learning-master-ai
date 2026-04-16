import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.AI_PROVIDER': JSON.stringify(env.AI_PROVIDER || 'gemini'),
      'process.env.GEMINI_TEXT_MODEL': JSON.stringify(env.GEMINI_TEXT_MODEL || 'gemini-3-flash-preview'),
      'process.env.GEMINI_EMBED_MODEL': JSON.stringify(env.GEMINI_EMBED_MODEL || 'gemini-embedding-2-preview'),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
