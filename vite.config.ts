import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GROUPSPARK_API_URL': JSON.stringify(env.GROUPSPARK_API_URL || env.VITE_API_URL || 'http://localhost:3000'),
        'process.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL || 'http://localhost:3000')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      server: {
        hmr: {
          overlay: false
        }
      },
      build: {
        outDir: 'dist',
        assetsDir: 'assets',
        sourcemap: false,
        rollupOptions: {
          output: {
            manualChunks: undefined,
          }
        }
      },
      esbuild: {
        target: 'ES2022'
      }
    };
});
