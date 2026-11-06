import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es', 'iife'],
      fileName: (format) => format === 'es' ? 'ophx-editor.standalone.js' : 'ophx-editor.iife.js',
      cssFileName: 'ophx-editor',
      name: 'OphxEditor',
    },
    outDir: 'dist',
    emptyOutDir: false,
    minify: true,
    sourcemap: true,
    rollupOptions: {
      external: [],
    },
  },
})
