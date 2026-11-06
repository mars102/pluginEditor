import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es', 'cjs'],
      fileName: (format) => format === 'es' ? 'ophx-editor.js' : 'ophx-editor.cjs',
      cssFileName: 'ophx-editor',
    },
    rollupOptions: {
      external: [
        '@tiptap/core',
        '@tiptap/starter-kit',
        '@tiptap/extension-underline',
        '@tiptap/extension-link',
        '@tiptap/extension-image',
        '@tiptap/extension-placeholder',
        '@tiptap/extension-table',
        '@tiptap/extension-table-row',
        '@tiptap/extension-table-header',
        '@tiptap/extension-table-cell',
        '@tiptap/pm/state',
        '@tiptap/pm/view',
        'jszip',
      ],
    },
    outDir: 'dist',
    emptyOutDir: false,
  },
})
