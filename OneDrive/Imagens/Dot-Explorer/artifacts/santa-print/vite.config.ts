import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

export default defineConfig(async ({ mode }) => {
  const workspaceRoot = path.resolve(import.meta.dirname, '..', '..');
  const env = loadEnv(mode, workspaceRoot, '');
  const port = Number(process.env.PORT ?? env.PORT ?? 5173);
  const basePath = process.env.BASE_PATH ?? env.BASE_PATH ?? '/';

  const supabaseUrl =
    process.env.VITE_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    env.VITE_SUPABASE_URL ??
    env.SUPABASE_URL ??
    '';

  const supabaseAnonKey =
    process.env.VITE_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    env.VITE_SUPABASE_ANON_KEY ??
    env.SUPABASE_PUBLISHABLE_KEY ??
    '';

  const replitPlugins =
    process.env.NODE_ENV !== 'production' && process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((module) =>
            module.cartographer({
              root: path.resolve(import.meta.dirname, '..'),
            }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((module) =>
            module.devBanner(),
          ),
        ]
      : [];

  return {
    base: basePath,
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
    },
    plugins: [react(), tailwindcss(), runtimeErrorOverlay(), ...replitPlugins],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, 'src'),
        '@assets': path.resolve(import.meta.dirname, '..', '..', 'attached_assets'),
      },
      dedupe: ['react', 'react-dom'],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, 'dist'),
      emptyOutDir: true,
    },
    server: {
      port,
      strictPort: true,
      host: '0.0.0.0',
      allowedHosts: true,
      fs: {
        strict: true,
      },
    },
    preview: {
      port,
      host: '0.0.0.0',
      allowedHosts: true,
    },
  };
});
