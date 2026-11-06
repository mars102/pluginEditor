# @ophx/editor

## Установка

### npm + любой сборщик

```bash
npm i @phenix1024/editor
```

```ts
import { OphxEditor, mountToolbar } from '@phenix1024/editor'
import '@phenix1024/editor/style.css'

const editor = new OphxEditor({
  element: document.querySelector('#editor')!,
  content: '<h1>Документ</h1><p>Текст…</p>',
})

mountToolbar(document.querySelector('#toolbar')!, editor.editor)
```

### Vue 3 + TypeScript

```vue
<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'
import { OphxEditor, mountToolbar } from '@phenix1024/editor'
import '@phenix1024/editor/style.css'

let editor: OphxEditor | null = null
let unmountToolbar: (() => void) | null = null

onMounted(() => {
  editor = new OphxEditor({ element: document.querySelector('#editor')! })
  unmountToolbar = mountToolbar(document.querySelector('#toolbar')!, editor.editor)
})

onBeforeUnmount(() => {
  unmountToolbar?.()
  editor?.destroy()
})
</script>
```

### CDN без сборщика

```html
<link rel="stylesheet" href="https://unpkg.com/@phenix1024/editor@0.1.0/dist/ophx-editor.css">
<script src="https://unpkg.com/@phenix1024/editor@0.1.0/dist/ophx-editor.iife.js"></script>
<script>
  const editor = new OphxEditor.OphxEditor({ element: document.querySelector('#editor') })
  OphxEditor.mountToolbar(document.querySelector('#toolbar'), editor.editor)
</script>
```

Аналогично для jsDelivr:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@phenix1024/editor@0.1.0/dist/ophx-editor.css">
<script src="https://cdn.jsdelivr.net/npm/@phenix1024/editor@0.1.0/dist/ophx-editor.iife.js"></script>
```

> Для CDN лучше жёстко фиксировать версию, чтобы обновления не ломали существующий код.

Переносимый WYSIWYM-редактор на Tiptap. Ядро не зависит от React, Vue, Svelte или другого UI-фреймворка: ему нужен только DOM-контейнер. Панель инструментов опциональна — можно использовать готовую `mountToolbar()` или построить собственный интерфейс поверх публичного Tiptap instance.

## Возможности

- Заголовки H1–H6, абзацы, маркированные и нумерованные списки; стандартные markdown/input rules Tiptap преобразуют `# `, `- ` и `1. ` при вводе.
- Жирный, курсив, подчёркивание, зачёркивание, ссылки и метки.
- Списки, отступы для абзацев/заголовков, изображения, таблицы и сворачивание разделов по заголовкам.
- Содержание с переходом к заголовку, поиск с подсветкой, Undo/Redo.
- Не допускается повторный пробел при обычном вводе; Enter не создаёт последовательные пустые строки. Проверка орфографии использует браузерную проверку (`spellcheck`) и язык `ru`.
- Обычные клавиатурные команды редактора и браузера: выделение, копирование/вставка, Home/End, Undo/Redo и др.
- Импорт/экспорт `.ophx` v2: плоский ZIP с HTML-файлом, stylesheet-файлами и изображениями.
- Поля шаблонов Ophx: сохранение `contenteditable`, редактирование полей `.ophx-field`, сбор значений и проверка обязательных полей.

Проверка орфографии зависит от браузера и установленных словарей. Для удалённых изображений, недоступных из-за CORS, сохраняется исходная внешняя ссылка; локальные/вставленные изображения упаковываются в корень архива.

## Разработка

```sh
npm install
npm run dev
npm run typecheck
npm run build
```

`npm run build` собирает демо в `dist-demo/` и библиотеку/standalone-бандлы в `dist/`.

## Подключение без фреймворка

```ts
import { OphxEditor, mountToolbar } from '@ophx/editor'
import '@ophx/editor/style.css'

const editor = new OphxEditor({
  element: document.querySelector('#editor')!,
  content: '<h1>Документ</h1><p>Текст…</p>',
  onUpdate: ({ editor }) => autosave(editor.getHTML()),
})
const unmountToolbar = mountToolbar(document.querySelector('#toolbar')!, editor.editor)

// При размонтировании host:
unmountToolbar()
editor.destroy()
```

## Подключение в React

```tsx
import { useEffect, useRef } from 'react'
import { OphxEditor, mountToolbar } from '@ophx/editor'
import '@ophx/editor/style.css'

export function DocumentEditor() {
  const editorHost = useRef<HTMLDivElement>(null)
  const toolbarHost = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!editorHost.current || !toolbarHost.current) return
    const editor = new OphxEditor({ element: editorHost.current })
    const unmountToolbar = mountToolbar(toolbarHost.current, editor.editor)
    return () => { unmountToolbar(); editor.destroy() }
  }, [])

  return <><div ref={toolbarHost} /><div ref={editorHost} /></>
}
```

Для Vue/Svelte/Angular используется тот же DOM API в `onMounted`/`onMount`/lifecycle хуке. Не подключайте одновременно встроенный и собственный toolbar.

## Формат `.ophx`

`.ophx` соответствует v2 спецификации: это обычный ZIP без шифрования и ZIP64; записи создаются с DEFLATE, имена кодируются в UTF-8. Все файлы лежат плоским списком в корне. Внутри должен быть ровно один HTML-файл, его имя совпадает с именем внешнего `.ophx` без расширения. Стили и изображения тоже лежат в корне, без каталогов:

```text
Договор.ophx
├── Договор.html
├── default.css
└── image-1.png
```

```ts
import { exportOphx, importOphx, downloadBlob } from '@phenix1024/editor'

const archive = await exportOphx(editor.getHTML(), {
  filename: 'Договор', // basename должен совпадать с именем скачиваемого .ophx
  title: 'Договор поставки',
  styles: { 'default.css': cssText },
  bodyContentEditable: 'false', // если архив был импортирован с таким атрибутом
})
downloadBlob(archive, 'Договор.ophx')

const document = await importOphx(file)
editor.setContent(document.html)
const updatedArchive = await exportOphx(editor.getHTML(), {
  filename: document.filename,
  title: document.title,
  styles: document.styles,
  bodyContentEditable: document.bodyContentEditable,
})
downloadBlob(updatedArchive, `${document.filename}.ophx`)
// document.styles содержит все подключённые локальные CSS-файлы.
// document.css — удобный алиас первого stylesheet.
```

Имена в `styles` и `assets` — простые имена файлов, без путей. Изображения с локальными именами можно передать в `assets`; вставленные в редактор `data:image` и `blob:` изображения автоматически превращаются в `image-<номер>.<ext>`. Внешние `http(s)` и `data:` ссылки сохраняются как внешние.

Импорт принимает только ZIP v2 с одним корневым `.html`; старые не-ZIP/XML варианты определяются как неподдерживаемые. Локальные ссылки на CSS и изображения проверяются по точным именам. Скриптовые элементы и event-handler атрибуты удаляются перед передачей HTML редактору. Содержимое `styles` возвращается вызывающему приложению — оно может применить CSS в изолированном контейнере или iframe.

### Поля шаблона

В документе сохраняются поля `span` (inline) и `p`/`div` (block) с `.ophx-field`, `contenteditable="true"` и уникальным `data-ophx-field`. Статические фрагменты с `contenteditable="false"` сохраняются; при `body contenteditable="false"` это состояние также переносится в editor-модель. Значения доступны через `editor.getFields()`, обязательные незаполненные поля — через `editor.getMissingRequiredFields()`.

Для подготовки шаблона helper `convertUnderscoresToFields(html)` заменяет каждую последовательность `_{2,}` в текстовых узлах отдельным пустым полем с ключами `f1`, `f2`, …; кодовые блоки и нередактируемые участки пропускаются.

## API

- `new OphxEditor({ element, content?, placeholder?, editable?, onUpdate?, extensions? })`
- `editor.editor` — исходный Tiptap `Editor` для команд и подписок.
- `getHTML()`, `getJSON()`, `setContent(content)`, `setSearchQuery(query)`, `destroy()`.
- `mountToolbar(host, editor, { onInsertImage? })` возвращает функцию очистки.
- `exportOphx(html, { filename, title?, styles?, assets?, bodyContentEditable? })`, `importOphx(file)`, `downloadBlob(blob, filename)`.
- `getFields()` и `getMissingRequiredFields()` возвращают валидные уникальные поля шаблона.
- `convertUnderscoresToFields(html, prefix?)` возвращает преобразованный HTML, число полей и их IDs.

Интеграционный пакет поставляет Tiptap extensions и JSZip как runtime-зависимости. Подключайте stylesheet явно в приложении, где сборщик не обрабатывает CSS imports автоматически.
