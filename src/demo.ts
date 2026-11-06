import './demo.css'
import { downloadBlob, exportOphx, importOphx, mountToolbar, OphxEditor } from './index'

const app = document.querySelector<HTMLDivElement>('#app')!
const DEFAULT_DOCUMENT_CSS = `body{font-family:Arial,sans-serif;line-height:1.7;color:#24262d;max-width:900px;margin:48px auto;padding:0 24px}h1,h2,h3{line-height:1.25;color:#191b23}img{max-width:100%;height:auto}table{width:100%;border-collapse:collapse}th,td{border:1px solid #dfe1e8;padding:8px}mark{background:#fff1a8}`
app.innerHTML = `
  <div class="workspace">
    <header class="topbar">
      <a class="brand" href="#" aria-label="Ophx Editor home"><span class="brand-mark">o</span><span>ophx<span class="brand-muted">/editor</span></span></a>
      <div class="document-name"><span class="status-dot"></span><span id="document-title">Новый документ</span><span class="saved-label" id="saved-label">Сохранено локально</span></div>
      <div class="top-actions">
        <button class="quiet-button" id="open-document" type="button">Открыть .ophx</button>
        <button class="primary-button" id="save-document" type="button"><span>↓</span> Экспорт .ophx</button>
        <input id="file-input" type="file" accept=".ophx,.zip,application/zip" hidden>
      </div>
    </header>
    <main class="main-layout">
      <section class="document-panel" aria-label="Рабочая область документа">
        <div class="document-meta"><span>РАБОЧАЯ ОБЛАСТЬ</span><span id="word-count">0 слов</span></div>
        <div class="editor-card"><div id="toolbar"></div><div id="editor"></div></div>
        <div class="hint-row"><span>Подсказка: начните строку с <kbd>#</kbd> для заголовка или <kbd>-</kbd> для списка</span><span>WYSIWYM · автосохранение</span></div>
      </section>
      <aside class="right-rail">
        <div class="rail-heading"><div><span class="eyebrow">РАБОЧАЯ СРЕДА</span><h2>Документ</h2></div><span class="sparkle">✳</span></div>
        <div class="rail-card">
          <div class="rail-label">ФОРМАТ</div>
          <div class="format-preview"><span class="file-icon">⌁</span><div><strong>OPHX document</strong><small>HTML · CSS · media</small></div></div>
          <p>Один переносимый архив со структурой, стилями и вложениями.</p>
        </div>
        <div class="rail-card shortcut-card">
          <div class="rail-label">БЫСТРЫЕ КОМАНДЫ</div>
          <div class="shortcut"><span>Жирный</span><kbd>⌘ B</kbd></div>
          <div class="shortcut"><span>Курсив</span><kbd>⌘ I</kbd></div>
          <div class="shortcut"><span>Отменить</span><kbd>⌘ Z</kbd></div>
          <div class="shortcut"><span>Список</span><kbd>- + пробел</kbd></div>
        </div>
        <div class="rail-note"><span>✦</span><p><strong>Пишите по смыслу.</strong><br>Форматирование появляется по мере ввода, не мешая потоку мысли.</p></div>
      </aside>
    </main>
    <footer class="statusbar"><span><i></i> Локальная версия</span><span id="status-message">Все изменения сохранены</span><span>RU · Проверка орфографии браузера</span></footer>
  </div>
`

const savedContent = localStorage.getItem('ophx-editor-content')
let documentStyles: Record<string, string> = { 'default.css': DEFAULT_DOCUMENT_CSS }
let bodyContentEditable: 'true' | 'false' | undefined
let archiveFilename = 'Новый-документ'
const editor = new OphxEditor({
  element: document.querySelector<HTMLElement>('#editor')!,
  content: savedContent ?? `<h1>Добро пожаловать в ophx</h1><p>Это переносимый WYSIWYM-редактор. Пишите текст — привычные маркеры автоматически превращаются в структуру документа.</p><h2>Начните с идеи</h2><p>Выделите фрагмент, чтобы оформить его как <strong>жирный</strong>, <em>курсив</em> или добавить ссылку. Заголовки формируют содержание, а списки и таблицы помогают структурировать мысли.</p><ul><li><p>Введите <strong>#</strong> и пробел в начале строки для заголовка</p></li><li><p>Введите <strong>-</strong> или <strong>1.</strong> для списка</p></li></ul><h2>Всё в одном архиве</h2><p>Экспортируйте документ в .ophx: внутри будут HTML, CSS и медиафайлы.</p>`,
  onUpdate: ({ editor: current }) => {
    localStorage.setItem('ophx-editor-content', current.getHTML())
    updateCounts()
    document.querySelector('#saved-label')!.textContent = 'Сохранено локально'
    document.querySelector('#status-message')!.textContent = 'Все изменения сохранены'
  },
})

const toolbar = document.querySelector<HTMLElement>('#toolbar')!
mountToolbar(toolbar, editor.editor, {
  onInsertImage: (file) => insertImage(file),
})

const title = document.querySelector<HTMLElement>('#document-title')!
const fileInput = document.querySelector<HTMLInputElement>('#file-input')!
document.querySelector('#open-document')!.addEventListener('click', () => fileInput.click())
fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0]
  if (!file) return
  try {
    const ophxDocument = await importOphx(file)
    editor.setContent(ophxDocument.html)
    documentStyles = ophxDocument.styles
    bodyContentEditable = ophxDocument.bodyContentEditable
    archiveFilename = safeFilename(ophxDocument.filename)
    title.textContent = ophxDocument.title
    document.querySelector('#status-message')!.textContent = 'Архив .ophx открыт'
  } catch (error) {
    window.alert(error instanceof Error ? error.message : 'Не удалось открыть файл .ophx')
  }
  fileInput.value = ''
})

document.querySelector('#save-document')!.addEventListener('click', async () => {
  const blob = await exportOphx(editor.getHTML(), {
    filename: archiveFilename,
    title: title.textContent ?? 'Документ',
    styles: documentStyles,
    bodyContentEditable,
  })
  downloadBlob(blob, `${archiveFilename}.ophx`)
  document.querySelector('#status-message')!.textContent = 'Архив .ophx экспортирован'
})

editor.editor.on('transaction', updateCounts)
updateCounts()

function updateCounts(): void {
  const words = editor.editor.getText().trim().split(/\s+/).filter(Boolean).length
  document.querySelector('#word-count')!.textContent = `${words} ${words === 1 ? 'слово' : 'слов'}`
}

function safeFilename(value: string): string {
  return value.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-') || 'document'
}

function insertImage(file: File): void {
  const reader = new FileReader()
  reader.addEventListener('load', () => {
    if (typeof reader.result === 'string') editor.editor.chain().focus().setImage({ src: reader.result, alt: file.name }).run()
  })
  reader.readAsDataURL(file)
}

