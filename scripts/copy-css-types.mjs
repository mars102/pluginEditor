import { copyFileSync, mkdirSync } from 'node:fs'

mkdirSync('dist/types/editor', { recursive: true })
copyFileSync('src/editor/ophx.css.d.ts', 'dist/types/editor/ophx.css.d.ts')
