
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    base: mode === 'development'
      ? '/'
      : (env.VITE_BASE_PATH || '/Educa-mais/'),

    build: {
      outDir: 'dist',
      sourcemap: false,
      assetsDir: 'assets',
    },

    server: {
      host: '0.0.0.0',
    },
  };
});
