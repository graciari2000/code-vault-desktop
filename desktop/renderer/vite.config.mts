import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
plugins: [react()],
build: {
    outDir: 'dist',          // where Electron expects the built files
    rollupOptions: {
        input: path.resolve(__dirname, 'index.html'), 
    },
},
});