import './demo.css'
import { mountToolbar, OphxEditor, type OphxEditorMode } from './index'
import { DEMO_TEMPLATES } from './demo-templates'

const app = document.querySelector<HTMLDivElement>('#app')!
const DEFAULT_DOCUMENT_CSS = `body{font-family:Arial,sans-serif;line-height:1.7;color:#24262d;max-width:900px;margin:48px auto;padding:0 24px}h1,h2,h3{line-height:1.25;color:#191b23}img{max-width:100%;height:auto}img[data-ophx-wrap="left"]{float:left;margin:4px 16px 12px 0}img[data-ophx-wrap="right"]{float:right;margin:4px 0 12px 16px}img[data-ophx-wrap="none"][data-ophx-align="center"]{display:block;margin-left:auto;margin-right:auto}img[data-ophx-wrap="none"][data-ophx-align="right"]{display:block;margin-left:auto;margin-right:0}table{width:100%;border-collapse:collapse}th,td{border:1px solid #dfe1e8;padding:8px}mark{background:#fff1a8}`
app.innerHTML = `
  <div class="workspace">
    <header class="topbar">
      <a class="brand" href="#" aria-label="Ophx Editor home"><span class="brand-mark">o</span><span>ophx<span class="brand-muted">/editor</span></span></a>
      <div class="document-name"><span class="status-dot"></span><span id="document-title">Новый документ</span><span class="saved-label" id="saved-label">Сохранено локально</span></div>
      <div class="top-actions">
        <button class="quiet-button" id="open-document" type="button">Загрузить .ophx</button>
        <div class="mode-switch" role="radiogroup" aria-label="Режим документа">
          <button type="button" role="radio" data-mode="edit" title="Править весь документ">Редактирование</button>
          <button type="button" role="radio" data-mode="fill" title="Менять только поля шаблона">Заполнение</button>
          <button type="button" role="radio" data-mode="view" title="Только чтение">Просмотр</button>
        </div>
        <button class="primary-button" id="save-document" type="button"><span>↓</span> Сохранить .ophx</button>
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
        <div class="rail-card template-card">
          <div class="rail-label">ШАБЛОНЫ ДОГОВОРОВ</div>
          <div class="template-list" id="template-list"></div>
          <div class="field-progress" id="field-progress" hidden>
            <div class="field-progress__bar"><span id="field-progress-fill"></span></div>
            <span id="field-progress-text"></span>
          </div>
          <p>Шаблон открывается в режиме «Заполнение»: меняются только поля, <kbd>Tab</kbd> — к следующему полю. В режиме «Редактирование» можно править сам договор.</p>
        </div>
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

const modeButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.mode-switch [data-mode]'))
const MODE_STATUS: Record<OphxEditorMode, string> = {
  edit: 'Режим редактирования: правится весь документ',
  fill: 'Режим заполнения: меняются только поля, Tab — следующее поле',
  view: 'Режим просмотра включён',
}
const syncModeSwitch = () => {
  for (const button of modeButtons) {
    const active = button.dataset.mode === editor.mode
    button.classList.toggle('is-active', active)
    button.setAttribute('aria-checked', String(active))
  }
}
const setMode = (mode: OphxEditorMode) => {
  editor.setMode(mode)
  syncModeSwitch()
  document.querySelector('#status-message')!.textContent = MODE_STATUS[mode]
}
for (const button of modeButtons) {
  button.addEventListener('click', () => setMode(button.dataset.mode as OphxEditorMode))
}
syncModeSwitch()

const templateList = document.querySelector<HTMLElement>('#template-list')!
for (const template of DEMO_TEMPLATES) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'template-item'
  button.innerHTML = `<span class="template-item__icon">§</span><span><strong></strong><small></small></span>`
  button.querySelector('strong')!.textContent = template.title
  button.querySelector('small')!.textContent = template.description
  button.addEventListener('click', () => {
    if (editor.getText().trim() && !window.confirm(`Открыть «${template.title}»? Текущий документ будет заменён.`)) return
    editor.setContent(template.html)
    title.textContent = template.title
    archiveFilename = safeFilename(template.title)
    // Saved archives reopen as templates, in fill mode.
    bodyContentEditable = 'false'
    localStorage.setItem('ophx-editor-content', editor.getHTML())
    setMode('fill')
    updateCounts()
  })
  templateList.append(button)
}

const title = document.querySelector<HTMLElement>('#document-title')!
const fileInput = document.querySelector<HTMLInputElement>('#file-input')!
document.querySelector('#open-document')!.addEventListener('click', () => fileInput.click())
fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0]
  if (!file) return
  try {
    const ophxDocument = await editor.loadOphx(file)
    syncModeSwitch()
    localStorage.setItem('ophx-editor-content', editor.getHTML())
    updateCounts()
    documentStyles = ophxDocument.styles
    bodyContentEditable = ophxDocument.bodyContentEditable
    archiveFilename = safeFilename(ophxDocument.filename)
    title.textContent = ophxDocument.title
    document.querySelector('#saved-label')!.textContent = 'Сохранено локально'
    document.querySelector('#status-message')!.textContent = 'Архив .ophx открыт'
  } catch (error) {
    window.alert(error instanceof Error ? error.message : 'Не удалось открыть файл .ophx')
  }
  fileInput.value = ''
})

document.querySelector('#save-document')!.addEventListener('click', async () => {
  await editor.downloadOphx({
    filename: archiveFilename,
    title: title.textContent ?? 'Документ',
    styles: documentStyles,
    bodyContentEditable,
  })
  document.querySelector('#status-message')!.textContent = 'Архив .ophx экспортирован'
})

editor.editor.on('transaction', updateCounts)
updateCounts()

function updateCounts(): void {
  const words = editor.editor.getText().trim().split(/\s+/).filter(Boolean).length
  document.querySelector('#word-count')!.textContent = `${words} ${words === 1 ? 'слово' : 'слов'}`
  updateFieldProgress()
}

function updateFieldProgress(): void {
  const progress = document.querySelector<HTMLElement>('#field-progress')
  if (!progress) return
  const fields = editor.getFields()
  progress.hidden = fields.length === 0
  if (!fields.length) return
  const filled = fields.filter((field) => field.value.trim()).length
  const missing = editor.getMissingRequiredFields().length
  document.querySelector<HTMLElement>('#field-progress-fill')!.style.width = `${Math.round((filled / fields.length) * 100)}%`
  document.querySelector('#field-progress-text')!.textContent = missing
    ? `Заполнено ${filled} из ${fields.length} · обязательных осталось ${missing}`
    : `Заполнено ${filled} из ${fields.length} · все обязательные готовы`
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

