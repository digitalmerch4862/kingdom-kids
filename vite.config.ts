import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    build: {
      outDir: 'dist',
      sourcemap: false
    },
    define: {
      // Expose the API_KEY specifically to process.env as required by the Gemini SDK guidelines
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      // Fallback for other process.env usages if any (though strict usage is advised)
      'process.env': {}
    }
  };
});
