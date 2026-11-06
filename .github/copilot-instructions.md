# Workspace instructions

- This repository packages a framework-neutral TypeScript WYSIWYM editor powered by Tiptap; keep editor logic independent of the Vite demo.
- Public library APIs live in `src/index.ts`; editor extensions and archive helpers belong under `src/editor/`.
- `.ophx` v2 is a flat ZIP: one root HTML file named after the outer archive, optional root CSS files, and root image files. Preserve template-field metadata and sanitize imported HTML.
- Keep keyboard input accessible, preserve Tiptap transaction/selection behavior, and typecheck/build changes with `npm run typecheck` and `npm run build`.
- The Vite app is a demo integration only; do not make React/Vue/etc. a runtime requirement of the editor package.
