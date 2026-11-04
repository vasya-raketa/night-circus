import { defineConfig } from 'vite';

// host: true -> also reachable from phones on the same Wi-Fi (npm run dev and npm run phone).
// strictPort -> fail loudly if 5173 is busy instead of silently moving to another port.
export default defineConfig({
  server: { port: 5173, host: true, strictPort: true },
  preview: { port: 4173, host: true }
});
