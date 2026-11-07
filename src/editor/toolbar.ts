import type { Editor } from '@tiptap/core'
import type { Transaction } from '@tiptap/pm/state'

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
  { action: 'link', label: 'Ссылка', title: 'Добавить ссылку' },
  { action: 'image', label: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/></svg>', title: 'Вставить изображение' },
  { action: 'table', label: 'Таблица', title: 'Вставить таблицу' },
  { action: 'collapse', label: 'Свернуть', title: 'Свернуть/развернуть раздел' },
  { action: 'label', label: 'Метка', title: 'Выделить текст меткой' },
  { action: 'toc', label: 'Содержание', title: 'Содержание документа' },
  { action: 'undo', label: '↶', title: 'Отменить (⌘/Ctrl+Z)' },
  { action: 'redo', label: '↷', title: 'Повторить (⌘/Ctrl+Shift+Z)' },
]

/** Mounts an optional accessible toolbar; consumers can provide their own UI instead. */
export function mountToolbar(host: HTMLElement, editor: Editor, options: ToolbarOptions = {}): () => void {
  host.classList.add('ophx-toolbar')
  host.replaceChildren()

  const setPopupVisible = (node: HTMLElement, visible: boolean) => {
    node.style.display = visible ? '' : 'none'
    node.hidden = !visible
  }

  const closeAllPopups = () => {
    isMenuOpen = false
    setPopupVisible(formatMenu, false)
    formatButton.setAttribute('aria-expanded', 'false')
    setPopupVisible(toc, false)
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
  host.append(formatWrap)

  const buttons = new Map<string, HTMLButtonElement>()
  for (const item of BUTTONS) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'ophx-toolbar__button'
    button.dataset.action = item.action
    button.innerHTML = item.label
    button.title = item.title
    button.setAttribute('aria-label', item.title)
    button.addEventListener('mousedown', (event) => event.preventDefault())
    button.addEventListener('click', () => {
      if (item.action === 'toc') return
      if (item.action === 'link') {
        openLinkPopover()
        return
      }
      runAction(item.action, editor, imageInput, toc)
    })
    buttons.set(item.action, button)
    host.append(button)
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
  host.append(search)

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
    tocButton.addEventListener('click', () => {
      const isHidden = toc.hidden || toc.style.display === 'none'
      if (!isHidden) closeAllPopups()
      else {
        closeMenu()
        setPopupVisible(toc, true)
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

  const refresh = () => {
    buttons.get('undo')!.disabled = !editor.can().undo()
    buttons.get('redo')!.disabled = !editor.can().redo()
    if (!editor.isActive('image')) closeImagePopover()
    else if (imagePopover.hidden) openImagePopover()
    else {
      syncImagePopover()
      positionImagePopover()
    }
    buttons.get('bold')!.classList.toggle('is-active', editor.isActive('bold'))
    buttons.get('italic')!.classList.toggle('is-active', editor.isActive('italic'))
    buttons.get('underline')!.classList.toggle('is-active', editor.isActive('underline'))
    buttons.get('strike')!.classList.toggle('is-active', editor.isActive('strike'))
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
  refresh()
  return () => {
    editor.off('transaction', handleTransaction)
    editor.off('selectionUpdate', handleSelectionUpdate)
    document.removeEventListener('click', handleImageOutsideClick)
    closeImagePopover()
    imagePopover.remove()
    editor.view.dom.removeEventListener('pointerover', handleLinkPointerOver)
    editor.view.dom.removeEventListener('click', handleEditorLinkClick)
    document.removeEventListener('click', handleLinkOutsideClick)
    closeLinkPopover()
    linkPopover.remove()
    host.replaceChildren()
    host.classList.remove('ophx-toolbar')
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
    case 'table': chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); break
    case 'collapse': {
      if (!editor.isActive('heading')) return
      const collapsed = Boolean(editor.getAttributes('heading').collapsed)
      chain.updateAttributes('heading', { collapsed: !collapsed }).run()
      break
    }
    case 'label': {
      const label = window.prompt('Название метки', 'важно')
      if (label?.trim()) chain.setMark('label', { label: label.trim() }).run()
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
