# @phenix1024/editor

Редактор документов для браузера на базе [Tiptap](https://tiptap.dev). Работает без фреймворков (подойдут React, Vue, Svelte, Angular или чистый JS), ему нужен только DOM-элемент. Документы сохраняются в переносимый архив `.ophx` (HTML + CSS + изображения в одном ZIP).

- Заголовки, списки, отступы, таблицы, изображения с обтеканием, ссылки и цветные метки.
- Markdown-подобный ввод: `# ` даёт заголовок, `- ` маркированный список, `1. ` нумерованный.
- Готовая панель инструментов: стиль текста, поиск с подсветкой, содержание, отмена и повтор.
- Три режима: редактирование, заполнение шаблона (меняются только поля) и просмотр. Выбранный режим запоминается между перезагрузками.
- Поля шаблонов: заполняемые места в документе, сбор значений, проверка обязательных полей.

## Установка

```bash
npm i @phenix1024/editor
```

## Быстрый старт

```html
<div id="toolbar"></div>
<div id="editor"></div>
```

```ts
import { OphxEditor } from '@phenix1024/editor'
import '@phenix1024/editor/style.css'

const editor = new OphxEditor({
  element: '#editor',   // элемент или CSS-селектор
  toolbar: '#toolbar',  // необязательно: встроенная панель инструментов
  content: '<h1>Документ</h1><p>Начните писать…</p>',
  onUpdate: () => localStorage.setItem('draft', editor.getHTML()),
})
```

Готово: редактор с панелью работает. Когда редактор больше не нужен, вызовите `editor.destroy()`. Он уберёт и панель.

## Частые задачи

### Получить и задать содержимое

```ts
const html = editor.getHTML()          // для автосохранения и отправки на сервер
const json = editor.getJSON()          // структура документа Tiptap
const text = editor.getText()          // простой текст

editor.setContent('<p>Новый текст</p>')                    // onUpdate не вызывается
editor.setContent('<p>Новый текст</p>', { emitUpdate: true })
editor.clearContent()
```

### Режимы: редактирование, заполнение, просмотр

```ts
editor.setMode('edit')  // всё редактируется
editor.setMode('fill')  // меняются только поля шаблона, остальной текст заблокирован
editor.setMode('view')  // только чтение
editor.mode             // 'edit' | 'fill' | 'view'
```

| Режим | Текст документа | Поля шаблона | Панель инструментов |
| --- | --- | --- | --- |
| `edit` | редактируется | редактируются | всё доступно |
| `fill` | заблокирован | редактируются, Tab и Shift+Tab переходят между полями | доступны поиск, содержание, отмена и повтор |
| `view` | заблокирован | заблокированы | доступны поиск и содержание |

`setEditable(true)` и `setEditable(false)` по-прежнему работают как `setMode('edit')` и `setMode('view')`.

Режим сохраняется в `localStorage` и восстанавливается после перезагрузки.

| Опция | Поведение |
| --- | --- |
| `mode: 'fill'` | Начальный режим, если сохранённого значения ещё нет. |
| `editableStorageKey: 'my-key'` | Свой ключ `localStorage`, например отдельный для каждого документа. |
| `editableStorageKey: null` | Не запоминать режим: всегда используется `mode`. |

### Сохранить и открыть `.ophx`

```ts
// Скачать файл в браузере
await editor.downloadOphx({ filename: 'Договор', title: 'Договор поставки' })

// Или получить Blob, например чтобы отправить на сервер
const blob = await editor.saveOphx({ filename: 'Договор' })

// Открыть файл, выбранный пользователем
input.addEventListener('change', async () => {
  const file = input.files?.[0]
  if (!file) return
  const doc = await editor.loadOphx(file)   // { title, filename, styles, css, html, ... }
  console.log(doc.title)
})
```

После `loadOphx()` имя, заголовок и стили архива запоминаются. Следующий `saveOphx()` или `downloadOphx()` без параметров сохранит документ с теми же метаданными. Параметры, переданные явно, имеют приоритет.

### Свои действия поверх Tiptap

`editor.editor` — это исходный экземпляр Tiptap `Editor`. Через него доступны все команды и события:

```ts
editor.editor.chain().focus().toggleBold().run()
editor.editor.on('selectionUpdate', () => { /* ... */ })
```

Дополнительные расширения Tiptap передаются через `extensions: [...]`.

### Загрузка изображений на сервер

По умолчанию панель вставляет изображения как `data:` URL, а при сохранении они упаковываются в `.ophx`. Чтобы загружать их на свой сервер:

```ts
const editor = new OphxEditor({
  element: '#editor',
  toolbar: '#toolbar',
  toolbarOptions: {
    onInsertImage: async (file) => {
      const url = await uploadToServer(file)
      editor.editor.chain().focus().setImage({ src: url, alt: file.name }).run()
    },
  },
})
```

### Метки

Выделите текст и нажмите «Метка» на панели. Во всплывающем окне введите название или выберите существующее. Клик по метке показывает её название, а в режиме редактирования там же её можно изменить или удалить. Метки сохраняются как `<mark data-label="...">`. Метки «важно» и «идея» имеют свои цвета, цвета остальных задаются в CSS:

```css
.ophx-editor-surface mark[data-label="срочно"] { background: #ffe0b3; }
```

### Поля шаблонов

Поле — это элемент с классом `ophx-field`, атрибутом `contenteditable="true"` и уникальным `data-ophx-field`:

```html
<p>Покупатель: <span class="ophx-field" contenteditable="true"
   data-ophx-field="buyer" data-ophx-label="Покупатель" data-ophx-required="true"></span></p>
```

```ts
editor.getFields()                 // [{ id, label, required, value }]
editor.getMissingRequiredFields()  // незаполненные обязательные поля

import { convertUnderscoresToFields } from '@phenix1024/editor'
const { html } = convertUnderscoresToFields('<p>ФИО: ______</p>')  // «___» превращается в поля f1, f2, …
```

Фрагменты с `contenteditable="false"` сохраняются и остаются нередактируемыми.

#### Заполнение шаблона

Типичный сценарий: автор готовит шаблон в режиме `edit`, а пользователь заполняет его в режиме `fill`.

```ts
const editor = new OphxEditor({
  element: '#editor',
  toolbar: '#toolbar',
  mode: 'fill',
  editableStorageKey: null,   // для форм режим обычно задаёт приложение, а не прошлый визит
  content: templateHtml,
})

submitButton.addEventListener('click', () => {
  const missing = editor.getMissingRequiredFields()
  if (missing.length) return alert(`Заполните: ${missing.map((f) => f.label ?? f.id).join(', ')}`)
  send(editor.getFields())    // [{ id: 'buyer', value: 'Иванов', ... }]
})
```

Что происходит в режиме заполнения:

| Действие | Результат |
| --- | --- |
| Клик по обычному тексту | Курсор не появляется: текст вне полей нельзя менять. Выделять и копировать его можно. |
| Клик по полю | Курсор встаёт в поле, поле обводится рамкой, подпись-подсказка (`data-ophx-label`) исчезает. |
| Клик вплотную к краю поля | Курсор переносится внутрь поля, ввод продолжает его значение. |
| Ввод, вставка | Только внутри поля. Вне полей ввод игнорируется. |
| Backspace, Delete, Alt+Backspace | Стирают только внутри поля, текст рядом с полем не трогают. |
| Enter | Ничего не делает: поле не разбивается на строки. |
| Tab / Shift+Tab | Следующее / предыдущее поле, его содержимое выделяется (можно сразу печатать поверх). |
| Стрелки | Перемещают курсор как обычно. За пределами поля он скрыт. |
| «Выделить всё» + удаление | Отклоняется. |
| Отмена / повтор (⌘Z / ⌘⇧Z) | Работают, в том числе кнопками панели. |

Оформление полей в этом режиме:
- все поля подсвечены голубым, незаполненные обязательные (`data-ophx-required="true"`) — красным;
- пустое поле показывает подпись из `data-ophx-label`, пока по нему не кликнули;
- активное поле получает класс `ophx-field--active`. Через него можно задать своё оформление:

```css
.ophx-editor-surface[data-ophx-mode="fill"] .ophx-field { background: #f0f7ff; }
```

Программные изменения работают в любом режиме: `setContent()` и `loadOphx()` заменяют документ целиком. Если открыть архив `.ophx` с `<body contenteditable="false">` в режиме `edit`, `loadOphx()` сам переключит редактор в `fill`. Чтобы сохранённый документ открывался как шаблон, передайте `bodyContentEditable: 'false'` в `saveOphx()` или `downloadOphx()`.

#### Свой переключатель режимов

```ts
const buttons = document.querySelectorAll<HTMLButtonElement>('[data-mode]')
const sync = () => buttons.forEach((b) => b.classList.toggle('is-active', b.dataset.mode === editor.mode))

buttons.forEach((b) => b.addEventListener('click', () => {
  editor.setMode(b.dataset.mode as 'edit' | 'fill' | 'view')
  sync()
}))
sync()

// После открытия файла режим мог смениться автоматически
await editor.loadOphx(file)
sync()
```

#### Ограничения

- Ввод через IME (составление символов: китайский, японский, корейский, некоторые мобильные клавиатуры) обрабатывается браузером. Правки вне полей всё равно отклоняются, но поведение внутри поля может отличаться.
- Пустое поле можно заполнить кликом или через Tab. Если выделение стоит далеко от поля, ввод игнорируется.

## Фреймворки

### React

```tsx
import { useEffect, useRef } from 'react'
import { OphxEditor } from '@phenix1024/editor'
import '@phenix1024/editor/style.css'

export function DocumentEditor({ initialHtml }: { initialHtml?: string }) {
  const editorRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const editor = new OphxEditor({
      element: editorRef.current!,
      toolbar: toolbarRef.current!,
      content: initialHtml,
    })
    return () => editor.destroy()
  }, [])

  return (
    <>
      <div ref={toolbarRef} />
      <div ref={editorRef} />
    </>
  )
}
```

### Vue 3

```vue
<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { OphxEditor } from '@phenix1024/editor'
import '@phenix1024/editor/style.css'

const editorEl = ref<HTMLElement>()
const toolbarEl = ref<HTMLElement>()
let editor: OphxEditor | undefined

onMounted(() => {
  editor = new OphxEditor({ element: editorEl.value!, toolbar: toolbarEl.value! })
})
onBeforeUnmount(() => editor?.destroy())
</script>

<template>
  <div ref="toolbarEl" />
  <div ref="editorEl" />
</template>
```

Не храните экземпляр `OphxEditor` в `ref()` или `reactive()`: прокси Vue мешают работе Tiptap.

### Без сборщика (CDN)

```html
<link rel="stylesheet" href="https://unpkg.com/@phenix1024/editor@0.3.0/dist/ophx-editor.css">
<script src="https://unpkg.com/@phenix1024/editor@0.3.0/dist/ophx-editor.iife.js"></script>

<div id="toolbar"></div>
<div id="editor"></div>
<script>
  const editor = new OphxEditor.OphxEditor({ element: '#editor', toolbar: '#toolbar' })
</script>
```

Через jsDelivr: `https://cdn.jsdelivr.net/npm/@phenix1024/editor@0.3.0/dist/...`. Версию в ссылке лучше фиксировать.

## API

### `new OphxEditor(options)`

| Опция | Тип | По умолчанию | Описание |
| --- | --- | --- | --- |
| `element` | `HTMLElement \| string` | — | Контейнер документа (обязательно). |
| `toolbar` | `HTMLElement \| string` | — | Контейнер встроенной панели инструментов. |
| `toolbarOptions` | `{ onInsertImage?(file) }` | — | Настройки панели. |
| `content` | `string \| JSON` | `'<p></p>'` | Начальное содержимое. |
| `placeholder` | `string` | `'Начните писать…'` | Подсказка в пустом документе. |
| `mode` | `'edit' \| 'fill' \| 'view'` | `'edit'` | Начальный режим, если нет сохранённого. |
| `editable` | `boolean` | `true` | Устаревший вариант: `false` равно `mode: 'view'`. |
| `editableStorageKey` | `string \| null` | `'ophx-editor-editable'` | Ключ `localStorage` для режима; `null` отключает хранение. |
| `onUpdate` | `({ editor }) => void` | — | Вызывается при каждом изменении документа. |
| `extensions` | `Extension[]` | `[]` | Дополнительные расширения Tiptap. |

### Методы и свойства

| | |
| --- | --- |
| `getHTML()`, `getJSON()`, `getText()` | Содержимое документа. |
| `setContent(content, { emitUpdate? })`, `clearContent()` | Замена содержимого. |
| `setMode(mode)`, `mode` | Режим: `'edit'`, `'fill'` или `'view'`. |
| `setEditable(bool)`, `isEditable` | Короткий вариант для `edit`/`view`. `isEditable` равно `true` в `edit` и `fill`. |
| `isEmpty` | Пустой ли документ. |
| `focus(pos?)`, `blur()` | Фокус: `'start'`, `'end'`, `'all'` или позиция. |
| `undo()`, `redo()`, `canUndo()`, `canRedo()` | История изменений. |
| `setSearchQuery(query)` | Подсветка найденного текста. |
| `loadOphx(file)` | Открыть `.ophx`, возвращает `OphxDocument`. |
| `saveOphx(options?)` | Создать `.ophx` и вернуть `Blob`. |
| `downloadOphx(options?)` | Скачать `.ophx`. |
| `getFields()`, `getMissingRequiredFields()` | Поля шаблона. |
| `destroy()` | Удалить редактор и панель. |
| `editor` | Исходный Tiptap `Editor`. |

Параметры сохранения (`OphxExportOptions`): `filename` (имя без `.ophx`), `title`, `styles` (`{ 'имя.css': 'css…' }`), `assets` (файлы изображений по имени), `bodyContentEditable`.

### Другие экспорты

- `mountToolbar(host, tiptapEditor, options?)` — смонтировать панель вручную. Возвращает функцию очистки.
- `exportOphx(html, options)`, `importOphx(file)`, `downloadBlob(blob, filename)` — работа с архивами без редактора.
- `convertUnderscoresToFields(html, prefix?)` — превращает `___` в поля шаблона.
- `isTemplateFillActive(tiptapEditor)`, `canEditStructure(tiptapEditor)` — для своей панели инструментов: включён ли режим заполнения и можно ли менять форматирование.
- Расширения Tiptap: `Label`, `CollapsibleHeading`, `Indentation`, `OphxInlineField`, `OphxBlockField`, `OphxReadonlyBlock`, `OphxReadonlyInline`, `OphxEditability`, `TemplateFill`, `TextSearch`, `WysiwymRules`.

## Формат `.ophx`

Обычный ZIP, все файлы лежат в корне. Внутри ровно один HTML, его имя совпадает с именем архива. Рядом лежат CSS и изображения:

```text
Договор.ophx
├── Договор.html
├── default.css
└── image-1.png
```

- Вставленные изображения (`data:`, `blob:`) упаковываются как `image-<n>.<ext>`. Внешние `http(s)` ссылки остаются ссылками.
- При открытии из HTML удаляются `<script>` и обработчики событий (`on*`).
- CSS из архива возвращается в `doc.styles` и к странице автоматически не применяется. Где его применять, решает приложение.

## Разработка

```sh
npm install
npm run dev        # демо на http://localhost:5173: шаблоны договоров и переключатель режимов
npm run typecheck
npm run build      # демо в dist-demo/, библиотека в dist/
```

## Лицензия

MIT
