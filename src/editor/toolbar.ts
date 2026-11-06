import type { Editor } from '@tiptap/core'

export interface ToolbarOptions {
  onInsertImage?: (file: File) => void
}

const BUTTONS: Array<{ action: string; label: string; title: string }> = [
  { action: 'bold', label: 'B', title: 'Жирный (⌘/Ctrl+B)' },
  { action: 'italic', label: 'I', title: 'Курсив (⌘/Ctrl+I)' },
  { action: 'underline', label: 'U', title: 'Подчёркнутый (⌘/Ctrl+U)' },
  { action: 'strike', label: 'S̶', title: 'Зачёркнутый' },
  { action: 'bullet', label: '• Список', title: 'Маркированный список' },
  { action: 'ordered', label: '1. Список', title: 'Нумерованный список' },
  { action: 'outdent', label: '← Отступ', title: 'Уменьшить отступ' },
  { action: 'indent', label: 'Отступ →', title: 'Увеличить отступ' },
  { action: 'link', label: 'Ссылка', title: 'Добавить ссылку' },
  { action: 'image', label: 'Изображение', title: 'Вставить изображение' },
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

  const format = document.createElement('select')
  format.className = 'ophx-toolbar__style'
  format.setAttribute('aria-label', 'Стиль текста')
  format.innerHTML = '<option value="p">Обычный текст</option><option value="1">Заголовок 1</option><option value="2">Заголовок 2</option><option value="3">Заголовок 3</option>'
  format.addEventListener('change', () => {
    const level = Number(format.value)
    const chain = editor.chain().focus()
    if (format.value === 'p') chain.setParagraph().run()
    else chain.setHeading({ level: level as 1 | 2 | 3 }).run()
  })
  host.append(format)

  const buttons = new Map<string, HTMLButtonElement>()
  for (const item of BUTTONS) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'ophx-toolbar__button'
    button.dataset.action = item.action
    button.textContent = item.label
    button.title = item.title
    button.setAttribute('aria-label', item.title)
    button.addEventListener('mousedown', (event) => event.preventDefault())
    button.addEventListener('click', () => runAction(item.action, editor, imageInput, toc))
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

  const toc = document.createElement('nav')
  toc.className = 'ophx-toc'
  toc.setAttribute('aria-label', 'Содержание документа')
  toc.hidden = true
  host.append(toc)

  const refresh = () => {
    buttons.get('undo')!.disabled = !editor.can().undo()
    buttons.get('redo')!.disabled = !editor.can().redo()
    buttons.get('bold')!.classList.toggle('is-active', editor.isActive('bold'))
    buttons.get('italic')!.classList.toggle('is-active', editor.isActive('italic'))
    buttons.get('underline')!.classList.toggle('is-active', editor.isActive('underline'))
    buttons.get('strike')!.classList.toggle('is-active', editor.isActive('strike'))
    const heading = editor.getAttributes('heading').level as number | undefined
    format.value = heading ? String(heading) : editor.isActive('paragraph') ? 'p' : 'p'

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

  editor.on('transaction', refresh)
  editor.on('selectionUpdate', refresh)
  refresh()
  return () => {
    editor.off('transaction', refresh)
    editor.off('selectionUpdate', refresh)
    host.replaceChildren()
    host.classList.remove('ophx-toolbar')
  }
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
    case 'link': {
      const current = editor.getAttributes('link').href as string | undefined
      const href = window.prompt('Адрес ссылки', current ?? 'https://')
      if (href === null) return
      if (!href.trim()) chain.extendMarkRange('link').unsetLink().run()
      else chain.extendMarkRange('link').setLink({ href: href.trim() }).run()
      break
    }
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
