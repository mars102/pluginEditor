import { getMarkRange, type Editor } from '@tiptap/core'
import type { Transaction } from '@tiptap/pm/state'
import { canEditStructure } from './extensions'

export interface ToolbarOptions {
  onInsertImage?: (file: File) => void
}

const BUTTONS: Array<{ action: string; label: string; title: string }> = [
  { action: 'bold', label: 'Ж', title: 'Жирный (⌘/Ctrl+B)' },
  { action: 'italic', label: 'К', title: 'Курсив (⌘/Ctrl+I)' },
  { action: 'underline', label: 'Ч', title: 'Подчёркнутый (⌘/Ctrl+U)' },
  { action: 'strike', label: 'З', title: 'Зачёркнутый' },
  {
    action: 'bullet',
    label: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="7" cy="6" r="1.3"/><circle cx="7" cy="12" r="1.3"/><circle cx="7" cy="18" r="1.3"/><path d="M11 6h8M11 12h8M11 18h8"/></svg>',
    title: 'Маркированный список',
  },
  {
    action: 'ordered',
    label: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M10 6h10M10 12h10M10 18h10"/><path d="M4 4.8 5.2 4v4.2M3.8 8.2h2.8M3.8 10.8c.2-.5.6-.8 1.2-.8.8 0 1.2.4 1.2 1 0 .4-.3.8-.7 1.2l-1.6 1.5h2.5M3.8 16.2c.2-.5.6-.8 1.2-.8.8 0 1.2.4 1.2.9 0 .5-.4.8-1 .8.7 0 1.1.3 1.1.9 0 .6-.5 1-1.3 1-.6 0-1-.2-1.3-.7"/></svg>',
    title: 'Нумерованный список',
  },
  {
    action: 'outdent',
    label: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 6h14M5 12h10M5 18h14"/><path d="M9 9l-4 3 4 3"/></svg>',
    title: 'Уменьшить отступ',
  },
  {
    action: 'indent',
    label: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 6h14M9 12h10M5 18h14"/><path d="M15 9l4 3-4 3"/></svg>',
    title: 'Увеличить отступ',
  },
  { action: 'link', label: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M10 13.5a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.7 1.7"/><path d="M14 10.5a4.5 4.5 0 0 0-6.4 0l-3 3A4.5 4.5 0 0 0 11 19.9l1.7-1.7"/></svg>', title: 'Добавить ссылку' },
  { action: 'image', label: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/></svg>', title: 'Вставить изображение' },
  { action: 'table', label: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 10h18M9 4v16M15 4v16"/></svg>', title: 'Вставить таблицу' },
  { action: 'label', label: 'Метка', title: 'Выделить текст меткой' },
  { action: 'toc', label: 'Содержание', title: 'Содержание документа' },
  { action: 'undo', label: '↶', title: 'Отменить (⌘/Ctrl+Z)' },
  { action: 'redo', label: '↷', title: 'Повторить (⌘/Ctrl+Shift+Z)' },
]

/** Mounts an optional accessible toolbar; consumers can provide their own UI instead. */
export function mountToolbar(host: HTMLElement, editor: Editor, options: ToolbarOptions = {}): () => void {
  host.classList.add('ophx-toolbar')
  host.replaceChildren()
  // Tools wrap onto full-width rows; the search box always ends the first row (see layoutSearch).
  const tools = document.createElement('div')
  tools.className = 'ophx-toolbar__tools'
  host.append(tools)

  const setPopupVisible = (node: HTMLElement, visible: boolean) => {
    node.style.display = visible ? '' : 'none'
    node.hidden = !visible
  }

  const closeAllPopups = () => {
    isMenuOpen = false
    setPopupVisible(formatMenu, false)
    formatButton.setAttribute('aria-expanded', 'false')
    setPopupVisible(toc, false)
    buttons.get('toc')?.setAttribute('aria-expanded', 'false')
  }

  const formatWrap = document.createElement('div')
  formatWrap.className = 'ophx-toolbar__style-wrap'

  const formatButton = document.createElement('button')
  formatButton.type = 'button'
  formatButton.className = 'ophx-toolbar__style'
  formatButton.setAttribute('aria-label', 'Стиль текста')
  formatButton.setAttribute('aria-haspopup', 'listbox')
  formatButton.setAttribute('aria-expanded', 'false')

  const formatLabel = document.createElement('span')
  formatLabel.className = 'ophx-toolbar__style-label'
  formatButton.append(formatLabel)

  const formatMenu = document.createElement('div')
  formatMenu.className = 'ophx-toolbar__style-menu'
  setPopupVisible(formatMenu, false)

  const formatOptions = [
    { value: 'p', label: 'Обычный текст', className: 'ophx-toolbar__style-preview--p' },
    { value: '1', label: 'Заголовок 1', className: 'ophx-toolbar__style-preview--h1' },
    { value: '2', label: 'Заголовок 2', className: 'ophx-toolbar__style-preview--h2' },
    { value: '3', label: 'Заголовок 3', className: 'ophx-toolbar__style-preview--h3' },
  ]

  const applySelectedStyle = (value: string) => {
    const level = Number(value)
    const chain = editor.chain().focus()
    if (value === 'p') chain.setParagraph().run()
    else chain.setHeading({ level: level as 1 | 2 | 3 }).run()
    closeMenu()
  }

  for (const option of formatOptions) {
    const item = document.createElement('button')
    item.type = 'button'
    item.className = 'ophx-toolbar__style-option'
    item.dataset.value = option.value
    item.setAttribute('role', 'option')
    item.setAttribute('aria-selected', 'false')
    item.innerHTML = `<span class="ophx-toolbar__style-preview ${option.className}">${option.label}</span>`
    item.addEventListener('mousedown', (event) => {
      event.preventDefault()
      event.stopPropagation()
    })
    item.addEventListener('click', () => applySelectedStyle(option.value))
    formatMenu.append(item)
  }

  let isMenuOpen = false

  const openMenu = () => {
    isMenuOpen = true
    setPopupVisible(formatMenu, true)
    formatButton.setAttribute('aria-expanded', 'true')
  }

  const closeMenu = () => {
    isMenuOpen = false
    setPopupVisible(formatMenu, false)
    formatButton.setAttribute('aria-expanded', 'false')
  }

  formatButton.addEventListener('click', (event) => {
    event.stopPropagation()
    if (isMenuOpen) closeMenu()
    else {
      setPopupVisible(toc, false)
      openMenu()
    }
  })

  formatButton.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu()
  })

  document.addEventListener('click', (event) => {
    const target = event.target as Node
    const clickedInsideFormat = formatWrap.contains(target)
    const clickedInsideToc = toc.contains(target)
    if (!clickedInsideFormat && !clickedInsideToc) closeAllPopups()
  })

  formatWrap.append(formatButton, formatMenu)
  tools.append(formatWrap)

  const buttons = new Map<string, HTMLButtonElement>()
  // Undo and redo share one wrapper so they always wrap onto a new row together.
  const historyGroup = document.createElement('div')
  historyGroup.className = 'ophx-toolbar__group'
  historyGroup.setAttribute('role', 'group')
  historyGroup.setAttribute('aria-label', 'История изменений')
  for (const item of BUTTONS) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'ophx-toolbar__button'
    button.dataset.action = item.action
    button.innerHTML = item.label
    button.title = item.title
    button.setAttribute('aria-label', item.title)
    button.addEventListener('mousedown', (event) => event.preventDefault())
    button.addEventListener('click', (event) => {
      if (item.action === 'toc') {
        event.stopPropagation()
        return
      }
      if (item.action === 'link') {
        openLinkPopover()
        return
      }
      if (item.action === 'table') {
        openTablePopover()
        return
      }
      if (item.action === 'label') {
        event.stopPropagation()
        openLabelEditor()
        return
      }
      const isHistory = item.action === 'undo' || item.action === 'redo'
      if (isHistory ? !editor.isEditable : !canEditStructure(editor)) return
      runAction(item.action, editor, imageInput, toc)
    })
    buttons.set(item.action, button)
    if (item.action === 'undo' || item.action === 'redo') {
      if (historyGroup.parentNode !== tools) tools.append(historyGroup)
      historyGroup.append(button)
    } else {
      tools.append(button)
    }
  }

  const search = document.createElement('input')
  search.type = 'search'
  search.className = 'ophx-toolbar__search'
  search.placeholder = 'Поиск…'
  search.setAttribute('aria-label', 'Поиск по тексту')
  search.addEventListener('input', () => editor.commands.setSearchQuery(search.value))
  search.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      search.value = ''
      editor.commands.setSearchQuery('')
      editor.commands.focus()
    }
  })
  tools.prepend(search)

  // Put the search box right after the last tool that still fits on the first row, so it fills
  // the rest of that row (same gap as between buttons, right edge flush) and later rows stay full.
  const SEARCH_MIN_WIDTH = 160
  const layoutSearch = () => {
    const items = Array.from(tools.children).filter((child): child is HTMLElement => child !== search && child instanceof HTMLElement)
    const gap = parseFloat(getComputedStyle(tools).columnGap) || 0
    const available = tools.clientWidth
    let used = 0
    let fitting = 0
    for (const item of items) {
      const next = used + item.offsetWidth + gap
      if (next + SEARCH_MIN_WIDTH > available) break
      used = next
      fitting += 1
    }
    items.forEach((item, index) => { item.style.order = index < fitting ? '0' : '2' })
    search.style.order = '1'
  }
  const toolbarResizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(layoutSearch)
  toolbarResizeObserver?.observe(tools)
  document.fonts?.ready.then(layoutSearch).catch(() => {})
  layoutSearch()

  const imageInput = document.createElement('input')
  imageInput.type = 'file'
  imageInput.accept = 'image/*'
  imageInput.hidden = true
  imageInput.addEventListener('change', () => {
    const file = imageInput.files?.[0]
    if (file) {
      if (options.onInsertImage) options.onInsertImage(file)
      else {
        const reader = new FileReader()
        reader.addEventListener('load', () => {
          if (typeof reader.result === 'string') editor.chain().focus().setImage({ src: reader.result, alt: file.name }).run()
        })
        reader.readAsDataURL(file)
      }
    }
    imageInput.value = ''
  })
  host.append(imageInput)

  const tablePopover = document.createElement('form')
  tablePopover.className = 'ophx-table-popover'
  tablePopover.setAttribute('aria-label', 'Создать таблицу')
  tablePopover.hidden = true
  tablePopover.innerHTML = `
    <label class="ophx-table-popover__label">Строки<input name="rows" type="number" min="1" max="30" value="3" required></label>
    <label class="ophx-table-popover__label">Столбцы<input name="cols" type="number" min="1" max="20" value="3" required></label>
    <label class="ophx-table-popover__header"><input name="header" type="checkbox" checked> Заголовок таблицы</label>
    <button class="ophx-table-popover__insert" type="submit">Вставить таблицу</button>
  `
  document.body.append(tablePopover)
  const tableButton = buttons.get('table')!
  const tableRowsInput = tablePopover.querySelector<HTMLInputElement>('input[name="rows"]')!
  const tableColsInput = tablePopover.querySelector<HTMLInputElement>('input[name="cols"]')!
  const tableHeaderInput = tablePopover.querySelector<HTMLInputElement>('input[name="header"]')!

  const positionTablePopover = () => {
    if (tablePopover.hidden) return
    const rect = tableButton.getBoundingClientRect()
    const width = tablePopover.offsetWidth
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
    tablePopover.style.left = `${left}px`
    tablePopover.style.top = `${Math.min(rect.bottom + 8, window.innerHeight - tablePopover.offsetHeight - 8)}px`
  }

  function closeTablePopover(): void {
    tablePopover.hidden = true
    tableButton.setAttribute('aria-expanded', 'false')
    window.removeEventListener('resize', positionTablePopover)
    document.removeEventListener('scroll', positionTablePopover, true)
  }

  function openTablePopover(): void {
    if (!canEditStructure(editor)) return
    if (!tablePopover.hidden) {
      closeTablePopover()
      return
    }
    tablePopover.hidden = false
    tableButton.setAttribute('aria-expanded', 'true')
    positionTablePopover()
    window.addEventListener('resize', positionTablePopover)
    document.addEventListener('scroll', positionTablePopover, true)
    tableRowsInput.focus()
    tableRowsInput.select()
  }

  tableButton.setAttribute('aria-haspopup', 'dialog')
  tableButton.setAttribute('aria-expanded', 'false')
  tablePopover.addEventListener('mousedown', (event) => event.stopPropagation())
  tablePopover.addEventListener('submit', (event) => {
    event.preventDefault()
    const rows = Math.max(1, Math.min(30, Number(tableRowsInput.value) || 1))
    const cols = Math.max(1, Math.min(20, Number(tableColsInput.value) || 1))
    tableRowsInput.value = String(rows)
    tableColsInput.value = String(cols)
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: tableHeaderInput.checked }).run()
    closeTablePopover()
  })
  tablePopover.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeTablePopover()
      tableButton.focus()
    }
  })
  const handleTableOutsideClick = (event: MouseEvent) => {
    const target = event.target as Node
    if (!tablePopover.contains(target) && !tableButton.contains(target)) closeTablePopover()
  }
  document.addEventListener('click', handleTableOutsideClick)

  const tableContextPopover = document.createElement('div')
  tableContextPopover.className = 'ophx-table-context'
  tableContextPopover.setAttribute('role', 'toolbar')
  tableContextPopover.setAttribute('aria-label', 'Действия с таблицей')
  tableContextPopover.hidden = true
  tableContextPopover.innerHTML = `
    <button type="button" data-command="addRow" aria-label="Добавить строку ниже" title="Добавить строку ниже"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v12H4zM4 10h16M10 4v12M12 20v-4M10 18h4"/></svg></button>
    <button type="button" data-command="deleteRow" aria-label="Удалить строку" title="Удалить строку"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v12H4zM4 10h16M10 4v12M10 20h4"/></svg></button>
    <span class="ophx-table-context__divider" aria-hidden="true"></span>
    <button type="button" data-command="addColumn" aria-label="Добавить столбец справа" title="Добавить столбец справа"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h12v16H4zM10 4v16M20 12h-4M18 10v4"/></svg></button>
    <button type="button" data-command="deleteColumn" aria-label="Удалить столбец" title="Удалить столбец"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h12v16H4zM10 4v16M18 10v4"/></svg></button>
  `
  document.body.append(tableContextPopover)

  const activeTableElement = (): HTMLTableElement | null => {
    const { $from } = editor.state.selection
    for (let depth = $from.depth; depth > 0; depth -= 1) {
      if ($from.node(depth).type.name !== 'table') continue
      const dom = editor.view.nodeDOM($from.before(depth))
      return dom instanceof HTMLTableElement ? dom : dom instanceof HTMLElement ? dom.querySelector('table') : null
    }
    return null
  }

  const positionTableContextPopover = () => {
    if (tableContextPopover.hidden) return
    const table = activeTableElement()
    if (!table) return
    const rect = table.getBoundingClientRect()
    const padding = 8
    const width = tableContextPopover.offsetWidth
    const height = tableContextPopover.offsetHeight
    const left = Math.max(padding, Math.min(rect.left, window.innerWidth - width - padding))
    const above = rect.top - height - 8 >= padding
    const top = above ? rect.top - height - 8 : Math.min(rect.bottom + 8, window.innerHeight - height - padding)
    tableContextPopover.style.left = `${left}px`
    tableContextPopover.style.top = `${Math.max(padding, top)}px`
  }

  const syncTableContextPopover = () => {
    if (!canEditStructure(editor) || !editor.isActive('table')) {
      tableContextPopover.hidden = true
      window.removeEventListener('resize', positionTableContextPopover)
      document.removeEventListener('scroll', positionTableContextPopover, true)
      return
    }
    tableContextPopover.hidden = false
    positionTableContextPopover()
    window.addEventListener('resize', positionTableContextPopover)
    document.addEventListener('scroll', positionTableContextPopover, true)
  }

  tableContextPopover.addEventListener('mousedown', (event) => event.preventDefault())
  tableContextPopover.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-command]')
    if (!button) return
    const command = button.dataset.command
    const chain = editor.chain().focus()
    if (command === 'addRow') chain.addRowAfter().run()
    else if (command === 'deleteRow') chain.deleteRow().run()
    else if (command === 'addColumn') chain.addColumnAfter().run()
    else if (command === 'deleteColumn') chain.deleteColumn().run()
  })
  const handleTableContextOutsideClick = (event: MouseEvent) => {
    if (tableContextPopover.hidden) return
    const target = event.target as Node
    const table = activeTableElement()
    if (!tableContextPopover.contains(target) && !table?.contains(target)) {
      tableContextPopover.hidden = true
    }
  }
  document.addEventListener('click', handleTableContextOutsideClick)

  const imagePopover = document.createElement('div')
  imagePopover.className = 'ophx-image-popover'
  imagePopover.setAttribute('role', 'dialog')
  imagePopover.setAttribute('aria-label', 'Размер и обтекание изображения')
  imagePopover.hidden = true
  imagePopover.innerHTML = `
    <span class="ophx-image-popover__arrow" aria-hidden="true"></span>
    <div class="ophx-image-popover__heading">Обтекание текстом</div>
    <div class="ophx-image-popover__choices" role="group" aria-label="Обтекание текстом">
      <button class="ophx-image-popover__choice" type="button" data-wrap="none" aria-label="Без обтекания" title="Без обтекания"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="8" height="7" rx="1"/><path d="M14 5h7M14 8h7M3 14h18M3 18h18"/></svg></button>
      <button class="ophx-image-popover__choice" type="button" data-wrap="left" aria-label="Изображение слева, текст справа" title="Изображение слева, текст справа"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="8" height="10" rx="1"/><path d="M14 5h7M14 8h7M14 11h7M3 18h18"/></svg></button>
      <button class="ophx-image-popover__choice" type="button" data-wrap="right" aria-label="Изображение справа, текст слева" title="Изображение справа, текст слева"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="13" y="4" width="8" height="10" rx="1"/><path d="M3 5h7M3 8h7M3 11h7M3 18h18"/></svg></button>
    </div>
    <div class="ophx-image-popover__heading">Выравнивание</div>
    <div class="ophx-image-popover__choices" role="group" aria-label="Выравнивание изображения">
      <button class="ophx-image-popover__choice" type="button" data-align="left" aria-label="Прижать влево" title="Прижать влево"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3v18M8 6h12v5H8zM8 15h12"/></svg></button>
      <button class="ophx-image-popover__choice" type="button" data-align="center" aria-label="По центру" title="По центру"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M4 6h16v5H4zM4 15h16"/></svg></button>
      <button class="ophx-image-popover__choice" type="button" data-align="right" aria-label="Прижать вправо" title="Прижать вправо"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 3v18M4 6h12v5H4zM4 15h12"/></svg></button>
    </div>
    <div class="ophx-image-popover__size" aria-live="polite"></div>
  `
  document.body.append(imagePopover)

  const imageSizeLabel = imagePopover.querySelector<HTMLElement>('.ophx-image-popover__size')!
  let selectedImagePosition: number | null = null

  const selectedImageElement = (): HTMLImageElement | null => {
    if (!editor.isActive('image')) return null
    const node = editor.view.nodeDOM(editor.state.selection.from)
    return node instanceof HTMLElement ? node.querySelector('img') : null
  }

  const positionImagePopover = () => {
    const image = selectedImageElement()
    if (imagePopover.hidden || !image) return
    const rect = image.getBoundingClientRect()
    const anchorX = rect.left + rect.width / 2
    const padding = 8
    const width = imagePopover.offsetWidth
    const height = imagePopover.offsetHeight
    const left = Math.max(padding, Math.min(anchorX - width / 2, window.innerWidth - width - padding))
    const fitsBelow = rect.bottom + height + 12 <= window.innerHeight - padding
    imagePopover.style.left = `${left}px`
    imagePopover.style.top = `${fitsBelow ? rect.bottom + 10 : Math.max(padding, rect.top - height - 10)}px`
    imagePopover.dataset.placement = fitsBelow ? 'bottom' : 'top'
    imagePopover.style.setProperty('--ophx-image-arrow-left', `${Math.max(14, Math.min(anchorX - left, width - 14))}px`)
  }

  function closeImagePopover(): void {
    imagePopover.hidden = true
    window.removeEventListener('resize', positionImagePopover)
    document.removeEventListener('scroll', positionImagePopover, true)
  }

  function openImagePopover(): void {
    if (!canEditStructure(editor)) return
    if (!imagePopover.hidden) return
    const image = selectedImageElement()
    if (!image) return

    selectedImagePosition = editor.state.selection.from
    imagePopover.hidden = false
    syncImagePopover()
    positionImagePopover()
    if (!image.complete) {
      image.addEventListener('load', () => {
        syncImagePopover()
        positionImagePopover()
      }, { once: true })
    }
    window.addEventListener('resize', positionImagePopover)
    document.addEventListener('scroll', positionImagePopover, true)
  }

  const updateSelectedImage = (attributes: { textWrap?: 'none' | 'left' | 'right'; alignment?: 'left' | 'center' | 'right' }) => {
    if (selectedImagePosition === null) return
    editor.chain().focus().setNodeSelection(selectedImagePosition).updateAttributes('image', attributes).run()
  }

  const syncImagePopover = () => {
    if (imagePopover.hidden || !editor.isActive('image')) return
    const attrs = editor.getAttributes('image')
    const image = selectedImageElement()
    if (image) imageSizeLabel.textContent = `${Math.round(image.getBoundingClientRect().width)} px · потяните за боковой маркер, чтобы изменить размер`
    for (const choice of imagePopover.querySelectorAll<HTMLButtonElement>('[data-wrap]')) {
      const selected = choice.dataset.wrap === (attrs.textWrap ?? 'none')
      choice.classList.toggle('is-selected', selected)
      choice.setAttribute('aria-pressed', String(selected))
    }
    for (const choice of imagePopover.querySelectorAll<HTMLButtonElement>('[data-align]')) {
      const selected = choice.dataset.align === (attrs.alignment ?? 'left')
      choice.classList.toggle('is-selected', selected)
      choice.setAttribute('aria-pressed', String(selected))
    }
  }

  imagePopover.addEventListener('mousedown', (event) => event.stopPropagation())
  imagePopover.addEventListener('click', (event) => {
    const choice = (event.target as HTMLElement).closest<HTMLButtonElement>('.ophx-image-popover__choice')
    if (!choice) return
    if (choice.dataset.wrap === 'none' || choice.dataset.wrap === 'left' || choice.dataset.wrap === 'right') {
      updateSelectedImage({ textWrap: choice.dataset.wrap })
    }
    if (choice.dataset.align === 'left' || choice.dataset.align === 'center' || choice.dataset.align === 'right') {
      updateSelectedImage({ alignment: choice.dataset.align, textWrap: 'none' })
    }
  })
  imagePopover.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeImagePopover()
    }
  })
  const handleImageOutsideClick = (event: MouseEvent) => {
    const target = event.target as Node
    const targetImageNode = (event.target as HTMLElement).closest?.('.ophx-image-node')
    const clickedEditorImage = Boolean(targetImageNode && editor.view.dom.contains(targetImageNode))
    if (!imagePopover.contains(target) && !clickedEditorImage) closeImagePopover()
  }
  document.addEventListener('click', handleImageOutsideClick)

  const toc = document.createElement('nav')
  toc.className = 'ophx-toc'
  toc.setAttribute('aria-label', 'Содержание документа')
  setPopupVisible(toc, false)
  host.append(toc)

  const tocButton = buttons.get('toc')
  if (tocButton) {
    tocButton.setAttribute('aria-haspopup', 'true')
    tocButton.setAttribute('aria-expanded', 'false')
    tocButton.addEventListener('click', () => {
      const isHidden = toc.hidden || toc.style.display === 'none'
      if (!isHidden) closeAllPopups()
      else {
        closeMenu()
        setPopupVisible(toc, true)
        tocButton.setAttribute('aria-expanded', 'true')
      }
    })
  }

  const linkPopover = document.createElement('form')
  linkPopover.className = 'ophx-link-popover'
  linkPopover.setAttribute('role', 'dialog')
  linkPopover.setAttribute('aria-label', 'Добавить ссылку')
  linkPopover.hidden = true
  linkPopover.innerHTML = `
    <span class="ophx-link-popover__arrow" aria-hidden="true"></span>
    <label class="ophx-link-popover__label" for="ophx-link-url">Адрес ссылки</label>
    <div class="ophx-link-popover__row">
      <input class="ophx-link-popover__input" id="ophx-link-url" type="url" placeholder="https://example.com" autocomplete="url">
    </div>
    <div class="ophx-link-popover__actions">
      <button class="ophx-link-popover__go" type="button">Перейти</button>
      <button class="ophx-link-popover__remove" type="button">Удалить ссылку</button>
      <button class="ophx-link-popover__submit" type="submit">ОК</button>
    </div>
  `
  document.body.append(linkPopover)

  const linkInput = linkPopover.querySelector<HTMLInputElement>('.ophx-link-popover__input')!
  const goLinkButton = linkPopover.querySelector<HTMLButtonElement>('.ophx-link-popover__go')!
  const removeLinkButton = linkPopover.querySelector<HTMLButtonElement>('.ophx-link-popover__remove')!
  const linkButton = buttons.get('link')!
  let linkRange: { from: number; to: number } | null = null

  const positionLinkPopover = () => {
    if (linkPopover.hidden || !linkRange) return
    try {
      const start = editor.view.coordsAtPos(linkRange.from)
      const end = editor.view.coordsAtPos(linkRange.to)
      const anchorX = (start.left + end.right) / 2
      const viewportPadding = 8
      const width = linkPopover.offsetWidth
      const height = linkPopover.offsetHeight
      const left = Math.max(viewportPadding, Math.min(anchorX - width / 2, window.innerWidth - width - viewportPadding))
      const fitsBelow = end.bottom + height + 14 <= window.innerHeight - viewportPadding
      const top = fitsBelow
        ? end.bottom + 12
        : Math.max(viewportPadding, start.top - height - 12)

      linkPopover.style.left = `${left}px`
      linkPopover.style.top = `${top}px`
      linkPopover.dataset.placement = fitsBelow ? 'bottom' : 'top'
      linkPopover.style.setProperty('--ophx-link-arrow-left', `${Math.max(14, Math.min(anchorX - left, width - 14))}px`)
    } catch {
      closeLinkPopover()
    }
  }

  function closeLinkPopover(): void {
    linkPopover.hidden = true
    linkButton.setAttribute('aria-expanded', 'false')
    window.removeEventListener('resize', positionLinkPopover)
    document.removeEventListener('scroll', positionLinkPopover, true)
  }

  function openLinkPopover(toggle = true): void {
    if (!canEditStructure(editor)) return
    if (!linkPopover.hidden && toggle) {
      closeLinkPopover()
      return
    }

    if (editor.state.selection.empty && editor.isActive('link')) {
      editor.chain().extendMarkRange('link').run()
    }
    const selection = editor.state.selection
    if (selection.empty) return

    linkRange = { from: selection.from, to: selection.to }
    linkInput.value = editor.getAttributes('link').href as string ?? ''
    removeLinkButton.hidden = !editor.isActive('link')
    goLinkButton.hidden = !linkInput.value
    linkPopover.hidden = false
    linkButton.setAttribute('aria-expanded', 'true')
    positionLinkPopover()
    window.addEventListener('resize', positionLinkPopover)
    document.addEventListener('scroll', positionLinkPopover, true)
    linkInput.focus()
    linkInput.select()
  }

  linkButton.setAttribute('aria-haspopup', 'dialog')
  linkButton.setAttribute('aria-expanded', 'false')
  const linkHelp = '⌘/Ctrl+клик — открыть ссылку; клик — выделить для редактирования через кнопку «Ссылка»'
  const handleLinkPointerOver = (event: PointerEvent) => {
    const target = event.target as HTMLElement
    const anchor = target.closest<HTMLAnchorElement>('a[href]')
    if (anchor && editor.view.dom.contains(anchor)) anchor.title = linkHelp
  }
  const handleEditorLinkClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement
    const anchor = target.closest<HTMLAnchorElement>('a[href]')
    if (!anchor || !editor.view.dom.contains(anchor)) return

    event.preventDefault()
    event.stopPropagation()
    if (event.metaKey || event.ctrlKey) {
      openLinkInNewTab(anchor.href)
      return
    }

    const position = editor.view.posAtCoords({ left: event.clientX, top: event.clientY })
    if (position) {
      editor.chain().focus().setTextSelection(position.pos).extendMarkRange('link').run()
      openLinkPopover(false)
    }
  }
  editor.view.dom.addEventListener('pointerover', handleLinkPointerOver)
  editor.view.dom.addEventListener('click', handleEditorLinkClick)
  linkPopover.addEventListener('mousedown', (event) => event.stopPropagation())
  linkPopover.addEventListener('submit', (event) => {
    event.preventDefault()
    if (!linkRange) return
    const href = linkInput.value.trim()
    if (!href) {
      linkInput.focus()
      return
    }
    editor.chain().focus().setTextSelection(linkRange).setLink({ href }).run()
    closeLinkPopover()
  })
  goLinkButton.addEventListener('click', () => openLinkInNewTab(linkInput.value))
  linkInput.addEventListener('input', () => {
    goLinkButton.hidden = !linkInput.value.trim()
  })
  removeLinkButton.addEventListener('click', () => {
    if (!linkRange) return
    editor.chain().focus().setTextSelection(linkRange).extendMarkRange('link').unsetLink().run()
    closeLinkPopover()
  })
  linkPopover.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeLinkPopover()
      linkButton.focus()
    }
  })
  const handleLinkOutsideClick = (event: MouseEvent) => {
    const target = event.target as Node
    if (!linkPopover.contains(target) && !linkButton.contains(target)) closeLinkPopover()
  }
  document.addEventListener('click', handleLinkOutsideClick)

  const LABEL_PRESETS = ['важно', 'идея']
  const labelPopover = document.createElement('form')
  labelPopover.className = 'ophx-link-popover ophx-label-popover'
  labelPopover.setAttribute('role', 'dialog')
  labelPopover.hidden = true
  labelPopover.innerHTML = `
    <span class="ophx-link-popover__arrow" aria-hidden="true"></span>
    <div class="ophx-label-popover__view">
      <span class="ophx-link-popover__label">Метка</span>
      <div class="ophx-label-popover__name"><mark class="ophx-label-popover__chip"></mark></div>
      <div class="ophx-link-popover__actions ophx-label-popover__view-actions">
        <button class="ophx-link-popover__remove" type="button" data-label-remove>Удалить метку</button>
        <button class="ophx-link-popover__submit" type="button" data-label-edit>Изменить</button>
      </div>
    </div>
    <div class="ophx-label-popover__edit">
      <label class="ophx-link-popover__label" for="ophx-label-name">Название метки</label>
      <div class="ophx-link-popover__row">
        <input class="ophx-link-popover__input" id="ophx-label-name" type="text" placeholder="Например, важно" autocomplete="off" maxlength="60">
      </div>
      <div class="ophx-label-popover__presets" role="group" aria-label="Быстрый выбор метки"></div>
      <div class="ophx-link-popover__actions">
        <button class="ophx-link-popover__remove" type="button" data-label-remove>Удалить метку</button>
        <button class="ophx-link-popover__submit" type="submit">ОК</button>
      </div>
    </div>
  `
  document.body.append(labelPopover)

  const labelInput = labelPopover.querySelector<HTMLInputElement>('#ophx-label-name')!
  const labelChip = labelPopover.querySelector<HTMLElement>('.ophx-label-popover__chip')!
  const labelPresets = labelPopover.querySelector<HTMLElement>('.ophx-label-popover__presets')!
  const labelEditButton = labelPopover.querySelector<HTMLButtonElement>('[data-label-edit]')!
  const labelRemoveButtons = labelPopover.querySelectorAll<HTMLButtonElement>('[data-label-remove]')
  const labelViewActions = labelPopover.querySelector<HTMLElement>('.ophx-label-popover__view-actions')!
  const labelButton = buttons.get('label')!
  let labelRange: { from: number; to: number } | null = null
  let labelMode: 'view' | 'edit' = 'edit'
  let labelIsExisting = false

  const positionLabelPopover = () => {
    if (labelPopover.hidden || !labelRange) return
    if (!positionPopoverAtRange(editor, labelPopover, labelRange)) closeLabelPopover()
  }

  function closeLabelPopover(): void {
    labelPopover.hidden = true
    labelButton.setAttribute('aria-expanded', 'false')
    window.removeEventListener('resize', positionLabelPopover)
    document.removeEventListener('scroll', positionLabelPopover, true)
  }

  function documentLabels(): string[] {
    const names = new Set(LABEL_PRESETS)
    editor.state.doc.descendants((node) => {
      for (const mark of node.marks) {
        if (mark.type.name === 'label' && mark.attrs.label) names.add(String(mark.attrs.label))
      }
    })
    return [...names]
  }

  function renderLabelPresets(current: string): void {
    labelPresets.replaceChildren()
    for (const name of documentLabels()) {
      const preset = document.createElement('button')
      preset.type = 'button'
      preset.className = 'ophx-label-popover__preset'
      preset.classList.toggle('is-selected', name === current)
      const swatch = document.createElement('mark')
      swatch.dataset.label = name
      swatch.textContent = name
      preset.append(swatch)
      preset.addEventListener('click', () => applyLabel(name))
      labelPresets.append(preset)
    }
  }

  function showLabelPopover(range: { from: number; to: number }, name: string, mode: 'view' | 'edit'): void {
    labelRange = range
    labelMode = mode
    labelPopover.dataset.mode = mode
    labelPopover.setAttribute('aria-label', mode === 'view' ? `Метка «${name}»` : 'Установить метку')
    labelChip.textContent = name
    labelChip.dataset.label = name
    labelViewActions.hidden = !canEditStructure(editor)
    labelRemoveButtons.forEach((button) => { button.hidden = !labelIsExisting })
    labelInput.value = name
    renderLabelPresets(name)
    labelPopover.hidden = false
    labelButton.setAttribute('aria-expanded', String(mode === 'edit'))
    positionLabelPopover()
    window.addEventListener('resize', positionLabelPopover)
    document.addEventListener('scroll', positionLabelPopover, true)
    if (mode === 'edit') {
      labelInput.focus()
      labelInput.select()
    }
  }

  function openLabelEditor(): void {
    if (!canEditStructure(editor)) return
    if (!labelPopover.hidden && labelMode === 'edit') {
      closeLabelPopover()
      return
    }
    if (editor.state.selection.empty && editor.isActive('label')) {
      editor.chain().extendMarkRange('label').run()
    }
    const { from, to, empty } = editor.state.selection
    if (empty) return
    labelIsExisting = editor.isActive('label')
    const current = labelIsExisting ? String(editor.getAttributes('label').label ?? '') : ''
    showLabelPopover({ from, to }, current, 'edit')
  }

  function applyLabel(name: string): void {
    const label = name.trim()
    if (!labelRange) return
    if (!label) {
      labelInput.focus()
      return
    }
    editor.chain().focus().setTextSelection(labelRange).setMark('label', { label }).run()
    closeLabelPopover()
  }

  labelButton.setAttribute('aria-haspopup', 'dialog')
  labelButton.setAttribute('aria-expanded', 'false')

  const findLabelAt = (event: MouseEvent) => {
    const target = event.target as HTMLElement
    const markElement = target.closest<HTMLElement>('mark')
    if (!markElement || !editor.view.dom.contains(markElement) || target.closest('a[href]')) return null
    const position = editor.view.posAtCoords({ left: event.clientX, top: event.clientY })
    const labelType = editor.schema.marks.label
    if (!position || !labelType) return null
    const $pos = editor.state.doc.resolve(position.pos)
    const range = getMarkRange($pos, labelType)
      ?? (position.pos > 0 ? getMarkRange(editor.state.doc.resolve(position.pos - 1), labelType) : undefined)
    if (!range) return null
    let name = markElement.dataset.label ?? ''
    editor.state.doc.nodesBetween(range.from, range.to, (node) => {
      const mark = node.marks.find((item) => item.type === labelType)
      if (mark) name = String(mark.attrs.label ?? name)
    })
    return { range, name }
  }

  const handleLabelPointerOver = (event: PointerEvent) => {
    const markElement = (event.target as HTMLElement).closest<HTMLElement>('mark[data-label]')
    if (markElement && editor.view.dom.contains(markElement)) markElement.title = `Метка: ${markElement.dataset.label}`
  }
  const handleEditorLabelClick = (event: MouseEvent) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey) return
    const found = findLabelAt(event)
    if (!found) return
    if (!editor.state.selection.empty && canEditStructure(editor)) return
    event.stopPropagation()
    labelIsExisting = true
    showLabelPopover(found.range, found.name, 'view')
  }
  editor.view.dom.addEventListener('pointerover', handleLabelPointerOver)
  editor.view.dom.addEventListener('click', handleEditorLabelClick)

  labelPopover.addEventListener('mousedown', (event) => event.stopPropagation())
  labelPopover.addEventListener('submit', (event) => {
    event.preventDefault()
    applyLabel(labelInput.value)
  })
  labelEditButton.addEventListener('click', () => {
    if (!labelRange || !canEditStructure(editor)) return
    showLabelPopover(labelRange, labelChip.textContent ?? '', 'edit')
  })
  labelRemoveButtons.forEach((button) => button.addEventListener('click', () => {
    if (!labelRange) return
    editor.chain().focus().setTextSelection(labelRange).unsetMark('label').run()
    closeLabelPopover()
  }))
  labelPopover.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeLabelPopover()
      editor.commands.focus()
    }
  })
  const handleLabelOutsideClick = (event: MouseEvent) => {
    const target = event.target as Node
    if (!labelPopover.contains(target) && !labelButton.contains(target)) closeLabelPopover()
  }
  document.addEventListener('click', handleLabelOutsideClick)

  const refresh = () => {
    const editable = canEditStructure(editor)
    formatButton.disabled = !editable
    for (const [action, button] of buttons) {
      if (action !== 'toc') button.disabled = !editable
    }
    // Undo/redo stay available while filling a template.
    buttons.get('undo')!.disabled = !editor.isEditable || !editor.can().undo()
    buttons.get('redo')!.disabled = !editor.isEditable || !editor.can().redo()
    syncTableContextPopover()
    if (!editable || !editor.isActive('image')) closeImagePopover()
    else if (imagePopover.hidden) openImagePopover()
    else {
      syncImagePopover()
      positionImagePopover()
    }
    buttons.get('bold')!.classList.toggle('is-active', editor.isActive('bold'))
    buttons.get('italic')!.classList.toggle('is-active', editor.isActive('italic'))
    buttons.get('underline')!.classList.toggle('is-active', editor.isActive('underline'))
    buttons.get('strike')!.classList.toggle('is-active', editor.isActive('strike'))
    buttons.get('label')!.classList.toggle('is-active', editor.isActive('label'))
    if (!editable) closeLinkPopover()
    if (!editable && labelMode === 'edit') closeLabelPopover()
    else if (!labelPopover.hidden) positionLabelPopover()
    const heading = editor.getAttributes('heading').level as number | undefined
    const styleValue = heading ? String(heading) : editor.isActive('paragraph') ? 'p' : 'p'
    const styleLabel = heading ? `Заголовок ${heading}` : 'Обычный текст'
    formatLabel.textContent = styleLabel

    for (const option of formatMenu.querySelectorAll<HTMLButtonElement>('.ophx-toolbar__style-option')) {
      const selected = option.dataset.value === styleValue
      option.setAttribute('aria-selected', String(selected))
      option.classList.toggle('is-selected', selected)
    }

    toc.replaceChildren()
    editor.state.doc.descendants((node, position) => {
      if (node.type.name !== 'heading') return
      const item = document.createElement('button')
      item.type = 'button'
      item.className = 'ophx-toc__item'
      item.style.paddingInlineStart = `${Math.max(0, Number(node.attrs.level) - 1) * 12}px`
      item.textContent = node.textContent || 'Без названия'
      item.addEventListener('mousedown', (event) => event.preventDefault())
      item.addEventListener('click', () => {
        editor.commands.setTextSelection(position + 1)
        editor.commands.focus()
        editor.commands.scrollIntoView()
      })
      toc.append(item)
    })
  }

  const handleTransaction = ({ transaction }: { transaction: Transaction }) => {
    refresh()
    if (!transaction.docChanged) return
    const insertedImagePosition = findInsertedImagePosition(transaction.before, transaction.doc)
    if (insertedImagePosition !== null) editor.commands.setNodeSelection(insertedImagePosition)
  }
  const handleSelectionUpdate = () => refresh()
  editor.on('transaction', handleTransaction)
  editor.on('selectionUpdate', handleSelectionUpdate)
  editor.view.dom.addEventListener('ophx:editablechange', refresh)
  refresh()
  return () => {
    editor.off('transaction', handleTransaction)
    editor.off('selectionUpdate', handleSelectionUpdate)
    editor.view.dom.removeEventListener('ophx:editablechange', refresh)
    document.removeEventListener('click', handleTableOutsideClick)
    closeTablePopover()
    tablePopover.remove()
    document.removeEventListener('click', handleTableContextOutsideClick)
    window.removeEventListener('resize', positionTableContextPopover)
    document.removeEventListener('scroll', positionTableContextPopover, true)
    tableContextPopover.remove()
    document.removeEventListener('click', handleImageOutsideClick)
    closeImagePopover()
    imagePopover.remove()
    editor.view.dom.removeEventListener('pointerover', handleLinkPointerOver)
    editor.view.dom.removeEventListener('click', handleEditorLinkClick)
    document.removeEventListener('click', handleLinkOutsideClick)
    closeLinkPopover()
    linkPopover.remove()
    editor.view.dom.removeEventListener('pointerover', handleLabelPointerOver)
    editor.view.dom.removeEventListener('click', handleEditorLabelClick)
    document.removeEventListener('click', handleLabelOutsideClick)
    closeLabelPopover()
    labelPopover.remove()
    toolbarResizeObserver?.disconnect()
    host.replaceChildren()
    host.classList.remove('ophx-toolbar')
  }
}

/** Places a fixed popover under (or above) a document range. Returns false if the range is gone. */
function positionPopoverAtRange(editor: Editor, popover: HTMLElement, range: { from: number; to: number }): boolean {
  try {
    const start = editor.view.coordsAtPos(range.from)
    const end = editor.view.coordsAtPos(range.to)
    const anchorX = (start.left + end.right) / 2
    const viewportPadding = 8
    const width = popover.offsetWidth
    const height = popover.offsetHeight
    const left = Math.max(viewportPadding, Math.min(anchorX - width / 2, window.innerWidth - width - viewportPadding))
    const fitsBelow = end.bottom + height + 14 <= window.innerHeight - viewportPadding
    const top = fitsBelow ? end.bottom + 12 : Math.max(viewportPadding, start.top - height - 12)
    popover.style.left = `${left}px`
    popover.style.top = `${top}px`
    popover.dataset.placement = fitsBelow ? 'bottom' : 'top'
    popover.style.setProperty('--ophx-link-arrow-left', `${Math.max(14, Math.min(anchorX - left, width - 14))}px`)
    return true
  } catch {
    return false
  }
}

function openLinkInNewTab(value: string): void {
  try {
    const url = new URL(value.trim(), window.location.href)
    if (['http:', 'https:', 'mailto:'].includes(url.protocol)) {
      window.open(url.href, '_blank', 'noopener,noreferrer')
    }
  } catch {
    // Ignore empty or malformed URLs.
  }
}

function findInsertedImagePosition(previousDoc: Transaction['before'], currentDoc: Transaction['doc']): number | null {
  const previousImages = new Map<string, number>()
  previousDoc.descendants((node) => {
    if (node.type.name !== 'image') return
    const src = String(node.attrs.src ?? '')
    previousImages.set(src, (previousImages.get(src) ?? 0) + 1)
  })

  let insertedPosition: number | null = null
  currentDoc.descendants((node, position) => {
    if (node.type.name !== 'image' || insertedPosition !== null) return
    const src = String(node.attrs.src ?? '')
    const previousCount = previousImages.get(src) ?? 0
    if (previousCount > 0) previousImages.set(src, previousCount - 1)
    else insertedPosition = position
  })
  return insertedPosition
}

function runAction(action: string, editor: Editor, imageInput: HTMLInputElement, toc: HTMLElement): void {
  const chain = editor.chain().focus()
  switch (action) {
    case 'bold': chain.toggleBold().run(); break
    case 'italic': chain.toggleItalic().run(); break
    case 'underline': chain.toggleUnderline().run(); break
    case 'strike': chain.toggleStrike().run(); break
    case 'bullet': chain.toggleBulletList().run(); break
    case 'ordered': chain.toggleOrderedList().run(); break
    case 'indent': adjustIndent(editor, 1); break
    case 'outdent': adjustIndent(editor, -1); break
    case 'image': {
      imageInput.click()
      break
    }
    case 'toc': {
      toc.hidden = !toc.hidden
      break
    }
    case 'undo': chain.undo().run(); break
    case 'redo': chain.redo().run(); break
  }
}

function adjustIndent(editor: Editor, delta: number): void {
  const { $from } = editor.state.selection
  if ($from.parent.type.name === 'listItem') {
    const chain = editor.chain().focus()
    if (delta > 0) chain.sinkListItem('listItem').run()
    else chain.liftListItem('listItem').run()
    return
  }
  const type = $from.parent.type.name
  if (type !== 'paragraph' && type !== 'heading') return
  const current = Number(editor.getAttributes(type).indent ?? 0)
  editor.chain().focus().updateAttributes(type, { indent: Math.max(0, Math.min(8, current + delta)) }).run()
}
