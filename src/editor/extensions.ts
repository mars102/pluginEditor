import { Extension, Mark, Node, type Editor } from '@tiptap/core'
import Heading from '@tiptap/extension-heading'
import Image from '@tiptap/extension-image'
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { Step } from '@tiptap/pm/transform'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export const Label = Mark.create({
  name: 'label',
  inclusive: false,
  addAttributes() {
    return {
      label: {
        default: 'highlight',
        parseHTML: (element: HTMLElement) => element.dataset.label ?? 'highlight',
        renderHTML: (attributes: { label?: string }) => ({ 'data-label': attributes.label }),
      },
    }
  },
  parseHTML() {
    return [{ tag: 'mark[data-label]' }, { tag: 'mark' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['mark', HTMLAttributes, 0]
  },
})

function fieldAttributes() {
  return {
    fieldId: {
      default: '',
      parseHTML: (element: HTMLElement) => element.getAttribute('data-ophx-field') ?? '',
      renderHTML: (attributes: { fieldId?: string }) => ({ 'data-ophx-field': attributes.fieldId ?? '' }),
    },
    fieldLabel: {
      default: null,
      parseHTML: (element: HTMLElement) => element.getAttribute('data-ophx-label'),
      renderHTML: (attributes: { fieldLabel?: string | null }) =>
        attributes.fieldLabel ? { 'data-ophx-label': attributes.fieldLabel } : {},
    },
    required: {
      default: false,
      parseHTML: (element: HTMLElement) => element.getAttribute('data-ophx-required') === 'true',
      renderHTML: (attributes: { required?: boolean }) =>
        attributes.required ? { 'data-ophx-required': 'true' } : {},
    },
  }
}

const FIELD_ID_PATTERN = /^[A-Za-z0-9._-]+$/

const IMAGE_WIDTH_MIN = 50
const IMAGE_WIDTH_MAX = 1200
type ImageTextWrap = 'none' | 'left' | 'right'
type ImageAlignment = 'left' | 'center' | 'right'

function parseImageWidth(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) return null
  const width = Number(value)
  return Number.isInteger(width) && width >= IMAGE_WIDTH_MIN && width <= IMAGE_WIDTH_MAX ? width : null
}

/** Image node with portable width and text-wrapping attributes. */
export const OphxImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element: HTMLElement) => parseImageWidth(element.getAttribute('width')),
        renderHTML: (attributes: { width?: number | null }) => {
          const width = attributes.width
          return Number.isInteger(width) && Number(width) >= IMAGE_WIDTH_MIN && Number(width) <= IMAGE_WIDTH_MAX
            ? { width: String(width) }
            : {}
        },
      },
      textWrap: {
        default: 'none' as ImageTextWrap,
        parseHTML: (element: HTMLElement): ImageTextWrap => {
          const value = element.getAttribute('data-ophx-wrap')
          return value === 'left' || value === 'right' ? value : 'none'
        },
        renderHTML: (attributes: { textWrap?: ImageTextWrap }) => ({
          'data-ophx-wrap': attributes.textWrap === 'left' || attributes.textWrap === 'right'
            ? attributes.textWrap
            : 'none',
        }),
      },
      alignment: {
        default: 'left' as ImageAlignment,
        parseHTML: (element: HTMLElement): ImageAlignment => {
          const value = element.getAttribute('data-ophx-align')
          return value === 'center' || value === 'right' ? value : 'left'
        },
        renderHTML: (attributes: { alignment?: ImageAlignment }) => ({
          'data-ophx-align': attributes.alignment === 'center' || attributes.alignment === 'right'
            ? attributes.alignment
            : 'left',
        }),
      },
    }
  },
  addNodeView() {
    return ({ node, getPos, editor }) => {
      let currentNode = node
      let dragStartX = 0
      let dragStartWidth = 0
      let lastWidth = 0

      const wrapper = document.createElement('div')
      wrapper.className = 'ophx-image-node'
      wrapper.contentEditable = 'false'

      const image = document.createElement('img')
      const resizeHandle = document.createElement('button')
      resizeHandle.type = 'button'
      resizeHandle.className = 'ophx-image-node__resize-handle'
      resizeHandle.setAttribute('role', 'slider')
      resizeHandle.setAttribute('aria-label', 'Изменить размер изображения перетаскиванием')
      resizeHandle.setAttribute('aria-valuemin', String(IMAGE_WIDTH_MIN))
      resizeHandle.setAttribute('aria-valuemax', String(IMAGE_WIDTH_MAX))
      resizeHandle.title = 'Потяните влево или вправо, чтобы изменить размер'
      resizeHandle.innerHTML = '<svg viewBox="0 0 12 28" aria-hidden="true"><path d="M4 3v22M8 3v22"/></svg>'
      wrapper.append(image, resizeHandle)

      const renderNode = () => {
        const src = String(currentNode.attrs.src ?? '')
        if (image.getAttribute('src') !== src) image.setAttribute('src', src)
        image.alt = currentNode.attrs.alt ?? ''
        if (currentNode.attrs.title) image.title = currentNode.attrs.title
        else image.removeAttribute('title')
        if (currentNode.attrs.width) image.width = Number(currentNode.attrs.width)
        else image.removeAttribute('width')
        const displayedWidth = Number(currentNode.attrs.width) || Math.round(image.getBoundingClientRect().width)
        resizeHandle.setAttribute('aria-valuenow', String(displayedWidth))
        resizeHandle.setAttribute('aria-valuetext', `${displayedWidth} пикселей`)
        wrapper.dataset.ophxWrap = currentNode.attrs.textWrap ?? 'none'
        wrapper.dataset.ophxAlign = currentNode.attrs.alignment ?? 'left'
      }

      const updateWidth = (width: number) => {
        if (!canEditStructure(editor)) return
        const position = typeof getPos === 'function' ? getPos() : undefined
        if (typeof position !== 'number') return
        const existing = editor.state.doc.nodeAt(position)
        if (!existing || existing.type.name !== 'image') return
        const editorStyle = getComputedStyle(editor.view.dom)
        const horizontalPadding = Number.parseFloat(editorStyle.paddingLeft) + Number.parseFloat(editorStyle.paddingRight)
        const availableWidth = Math.max(IMAGE_WIDTH_MIN, editor.view.dom.clientWidth - horizontalPadding)
        const constrainedWidth = Math.min(width, IMAGE_WIDTH_MAX, Math.floor(availableWidth))
        editor.view.dispatch(editor.state.tr.setNodeMarkup(position, undefined, { ...existing.attrs, width: constrainedWidth }))
      }

      const onPointerMove = (event: PointerEvent) => {
        if (!resizeHandle.hasPointerCapture(event.pointerId)) return
        const width = Math.max(50, Math.round((dragStartWidth + event.clientX - dragStartX) / 5) * 5)
        if (width === lastWidth) return
        lastWidth = width
        updateWidth(width)
      }
      const stopDragging = (event: PointerEvent) => {
        if (resizeHandle.hasPointerCapture(event.pointerId)) resizeHandle.releasePointerCapture(event.pointerId)
      }
      resizeHandle.addEventListener('pointerdown', (event) => {
        if (!canEditStructure(editor)) return
        event.preventDefault()
        event.stopPropagation()
        dragStartX = event.clientX
        dragStartWidth = image.getBoundingClientRect().width
        lastWidth = Math.round(dragStartWidth)
        resizeHandle.setPointerCapture(event.pointerId)
      })
      resizeHandle.addEventListener('pointermove', onPointerMove)
      resizeHandle.addEventListener('pointerup', stopDragging)
      resizeHandle.addEventListener('pointercancel', stopDragging)
      resizeHandle.addEventListener('keydown', (event) => {
        if (!canEditStructure(editor)) return
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
        event.preventDefault()
        const currentWidth = Number(currentNode.attrs.width) || Math.round(image.getBoundingClientRect().width)
        const delta = event.key === 'ArrowRight' ? 10 : -10
        updateWidth(Math.max(IMAGE_WIDTH_MIN, currentWidth + delta))
      })
      image.addEventListener('load', () => {
        if (currentNode.attrs.width) return
        const width = Math.round(image.getBoundingClientRect().width)
        resizeHandle.setAttribute('aria-valuenow', String(width))
        resizeHandle.setAttribute('aria-valuetext', `${width} пикселей`)
      })
      renderNode()

      return {
        dom: wrapper,
        update(updatedNode) {
          if (updatedNode.type !== currentNode.type) return false
          currentNode = updatedNode
          renderNode()
          return true
        },
        stopEvent(event) {
          return resizeHandle.contains(event.target as globalThis.Node)
        },
        ignoreMutation() {
          return true
        },
      }
    }
  },
})

/** Inline template field: its textual value stays editable inside the editor. */
export const OphxInlineField = Node.create({
  name: 'ophxInlineField',
  priority: 1000,
  group: 'inline',
  inline: true,
  content: 'text*',
  defining: true,
  addAttributes: fieldAttributes,
  parseHTML() {
    return [{ tag: 'span.ophx-field[contenteditable="true"][data-ophx-field]', priority: 1000 }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', { ...HTMLAttributes, class: 'ophx-field', contenteditable: 'true' }, 0]
  },
})

/** Block template field, accepting the v2 <p> and <div> wrapper forms. */
export const OphxBlockField = Node.create({
  name: 'ophxBlockField',
  priority: 1000,
  group: 'block',
  content: 'text*',
  defining: true,
  addAttributes() {
    return {
      ...fieldAttributes(),
      tagName: {
        default: 'div',
        parseHTML: (element: HTMLElement) => element.tagName.toLowerCase(),
        renderHTML: () => ({}),
      },
    }
  },
  parseHTML() {
    return [
      { tag: 'p.ophx-field[contenteditable="true"][data-ophx-field]', priority: 1000 },
      { tag: 'div.ophx-field[contenteditable="true"][data-ophx-field]', priority: 1000 },
    ]
  },
  renderHTML({ node, HTMLAttributes }) {
    const tagName = node.attrs.tagName === 'p' ? 'p' : 'div'
    return [tagName, { ...HTMLAttributes, class: 'ophx-field', contenteditable: 'true' }, 0]
  },
})

/** Preserves a readonly inline span while allowing editable field descendants. */
export const OphxReadonlyInline = Mark.create({
  name: 'ophxReadonlyInline',
  inclusive: false,
  addAttributes() {
    return {
      className: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('class'),
        renderHTML: (attributes: { className?: string | null }) =>
          attributes.className ? { class: attributes.className } : {},
      },
    }
  },
  parseHTML() {
    return [{ tag: 'span[contenteditable="false"]', priority: 100 }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', { ...HTMLAttributes, contenteditable: 'false' }, 0]
  },
})

/** A readonly block container can still contain nested editable template fields. */
export const OphxReadonlyBlock = Node.create({
  name: 'ophxReadonlyBlock',
  priority: 1000,
  group: 'block',
  content: 'block*',
  defining: true,
  isolating: true,
  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('id'),
        renderHTML: (attributes: { id?: string | null }) => attributes.id ? { id: attributes.id } : {},
      },
      className: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('class'),
        renderHTML: (attributes: { className?: string | null }) =>
          attributes.className ? { class: attributes.className } : {},
      },
      title: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('title'),
        renderHTML: (attributes: { title?: string | null }) => attributes.title ? { title: attributes.title } : {},
      },
    }
  },
  parseHTML() {
    return [{ tag: 'div[contenteditable="false"]', priority: 1000 }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', { ...HTMLAttributes, contenteditable: 'false' }, 0]
  },
})

const collapseKey = new PluginKey('ophxHeadingCollapse')

export const CollapsibleHeading = Heading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      collapsed: {
        default: false,
        parseHTML: (element: HTMLElement) => element.dataset.collapsed === 'true',
        renderHTML: (attributes: { collapsed?: boolean }) =>
          attributes.collapsed ? { 'data-collapsed': 'true' } : {},
      },
    }
  },
  addNodeView() {
    return ({ node, getPos, editor }) => {
      let currentNode = node
      const heading = document.createElement(`h${node.attrs.level}`)
      heading.className = 'ophx-heading'

      const toggle = document.createElement('button')
      toggle.type = 'button'
      toggle.className = 'ophx-heading__toggle'
      toggle.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m5.5 3.5 4.5 4.5-4.5 4.5"/></svg>'

      const content = document.createElement('span')
      content.className = 'ophx-heading__content'
      heading.append(content, toggle)

      const updateToggle = () => {
        const collapsed = Boolean(currentNode.attrs.collapsed)
        toggle.setAttribute('aria-expanded', String(!collapsed))
        toggle.setAttribute('aria-label', collapsed ? 'Развернуть раздел' : 'Свернуть раздел')
        toggle.title = collapsed ? 'Развернуть раздел' : 'Свернуть раздел'
        heading.dataset.collapsed = String(collapsed)
      }

      const toggleCollapsed = (event: MouseEvent) => {
        event.preventDefault()
        event.stopPropagation()
        if (!editor.isEditable) return
        const position = typeof getPos === 'function' ? getPos() : undefined
        if (typeof position !== 'number') return
        const liveNode = editor.state.doc.nodeAt(position)
        if (!liveNode || liveNode.type.name !== 'heading') return
        editor.view.dispatch(editor.state.tr.setNodeMarkup(position, undefined, {
          ...liveNode.attrs,
          collapsed: !liveNode.attrs.collapsed,
        }).setMeta(TEMPLATE_FILL_ALLOW_META, true))
      }

      toggle.addEventListener('mousedown', (event) => event.preventDefault())
      toggle.addEventListener('click', toggleCollapsed)
      updateToggle()

      return {
        dom: heading,
        contentDOM: content,
        update(updatedNode) {
          if (updatedNode.type !== currentNode.type || updatedNode.attrs.level !== currentNode.attrs.level) return false
          currentNode = updatedNode
          updateToggle()
          return true
        },
        stopEvent(event) {
          return toggle.contains(event.target as globalThis.Node)
        },
      }
    }
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: collapseKey,
        props: {
          decorations(state) {
            const hidden: Decoration[] = []
            let collapsedLevel: number | null = null
            state.doc.forEach((node, position) => {
              if (node.type.name === 'heading') {
                const level = Number(node.attrs.level)
                if (collapsedLevel !== null && level <= collapsedLevel) collapsedLevel = null
                if (collapsedLevel !== null) {
                  hidden.push(Decoration.node(position, position + node.nodeSize, { class: 'ophx-collapsed-content' }))
                }
                if (node.attrs.collapsed) collapsedLevel = level
              } else if (collapsedLevel !== null) {
                hidden.push(Decoration.node(position, position + node.nodeSize, { class: 'ophx-collapsed-content' }))
              }
            })
            return DecorationSet.create(state.doc, hidden)
          },
        },
      }),
    ]
  },
})

const searchKey = new PluginKey<DecorationSet>('ophxTextSearch')
type SearchStorage = { query: string }

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    ophxSearch: {
      setSearchQuery: (query: string) => ReturnType
    }
  }
}

export const TextSearch = Extension.create< SearchStorage >({
  name: 'ophxSearch',
  addStorage() {
    return { query: '' }
  },
  addCommands() {
    return {
      setSearchQuery:
        (query: string) =>
        ({ tr, dispatch }) => {
          this.storage.query = query
          dispatch?.(tr.setMeta(searchKey, query))
          return true
        },
    }
  },
  addProseMirrorPlugins() {
    const extension = this
    return [
      new Plugin<DecorationSet>({
        key: searchKey,
        state: {
          init: (_, state) => createSearchDecorations(state.doc, extension.storage.query),
          apply: (transaction, decorations, _oldState, newState) => {
            const query = transaction.getMeta(searchKey) as string | undefined
            if (query !== undefined) extension.storage.query = query
            if (!transaction.docChanged && query === undefined) return decorations
            return createSearchDecorations(newState.doc, extension.storage.query)
          },
        },
        props: {
          decorations(state) {
            return searchKey.getState(state)
          },
        },
      }),
    ]
  },
})

function createSearchDecorations(doc: Parameters<typeof DecorationSet.create>[0], query: string) {
  if (!query.trim()) return DecorationSet.empty
  const decorations: Decoration[] = []
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const matcher = new RegExp(escaped, 'gi')
  doc.descendants((node, position) => {
    if (!node.isText || !node.text) return
    matcher.lastIndex = 0
    for (const match of node.text.matchAll(matcher)) {
      if (match.index === undefined) continue
      decorations.push(
        Decoration.inline(position + match.index, position + match.index + match[0].length, {
          class: 'ophx-search-match',
        }),
      )
    }
  })
  return DecorationSet.create(doc, decorations)
}

export const WysiwymRules = Extension.create({
  name: 'ophxWysiwymRules',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleTextInput(view, from, _to, text) {
            if (text !== ' ') return false
            return /\s/.test(view.state.doc.textBetween(Math.max(0, from - 1), from))
          },
          handleKeyDown(view, event) {
            if (event.key !== 'Enter' || event.shiftKey) return false
            const { $from } = view.state.selection
            if (!$from.parent.isTextblock || $from.parent.content.size !== 0 || $from.depth === 0) return false
            const index = $from.index($from.depth - 1)
            const parent = $from.node($from.depth - 1)
            const adjacent = [parent.maybeChild(index - 1), parent.maybeChild(index + 1)]
            const hasNeighboringBlank = adjacent.some((node) => node?.isTextblock && node.content.size === 0)
            return hasNeighboringBlank
          },
        },
      }),
    ]
  },
})

export const Indentation = Extension.create({
  name: 'ophxIndentation',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element: HTMLElement) => Number(element.dataset.indent ?? 0),
            renderHTML: (attributes: { indent?: number }) =>
              attributes.indent ? { 'data-indent': String(attributes.indent) } : {},
          },
        },
      },
    ]
  },
})

/** Retains v2 contenteditable overrides on schema nodes and marks. */
export const OphxEditability = Extension.create({
  name: 'ophxEditability',
  addGlobalAttributes() {
    return [
      {
        types: [
          'paragraph', 'heading', 'blockquote', 'codeBlock', 'bulletList', 'orderedList',
          'listItem', 'horizontalRule', 'image', 'table', 'tableRow', 'tableHeader', 'tableCell',
          'bold', 'italic', 'underline', 'strike', 'link', 'label',
        ],
        attributes: {
          contenteditable: {
            default: null,
            parseHTML: (element: HTMLElement) => {
              const value = element.getAttribute('contenteditable')
              return value === 'true' || value === 'false' ? value : null
            },
            renderHTML: (attributes: { contenteditable?: 'true' | 'false' | null }) =>
              attributes.contenteditable ? { contenteditable: attributes.contenteditable } : {},
          },
        },
      },
    ]
  },
})

export function isValidOphxFieldId(value: string): boolean {
  return FIELD_ID_PATTERN.test(value)
}

const FIELD_NODE_TYPES = new Set(['ophxInlineField', 'ophxBlockField'])
/** Transactions carrying this meta are allowed in template fill mode (UI-only changes such as collapsing). */
export const TEMPLATE_FILL_ALLOW_META = 'ophxTemplateFillAllow'
export const templateFillKey = new PluginKey('ophxTemplateFill')

export interface TemplateFillStorage {
  /** When true only the text inside template fields (.ophx-field) can change. */
  enabled: boolean
  /** Temporarily lets programmatic changes (setContent, loadOphx) through. */
  bypass: boolean
}

declare module '@tiptap/core' {
  interface Storage {
    ophxTemplateFill: TemplateFillStorage
  }
}

/** True while the editor is in template fill mode. */
export function isTemplateFillActive(editor: Editor): boolean {
  return Boolean(editor.storage.ophxTemplateFill?.enabled)
}

/** True when formatting and structure (not only field values) may be edited. */
export function canEditStructure(editor: Editor): boolean {
  return editor.isEditable && !isTemplateFillActive(editor)
}

function fieldRangeAt(doc: ProseMirrorNode, position: number): { from: number; to: number } | null {
  const $pos = doc.resolve(position)
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    if (FIELD_NODE_TYPES.has($pos.node(depth).type.name)) return { from: $pos.start(depth), to: $pos.end(depth) }
  }
  return null
}

function stepStaysInsideField(doc: ProseMirrorNode, step: Step): boolean {
  const { from, to } = step as unknown as { from?: unknown; to?: unknown }
  if (typeof from !== 'number' || typeof to !== 'number') return false
  const field = fieldRangeAt(doc, from)
  return Boolean(field && from >= field.from && to <= field.to)
}

function fieldPositions(doc: ProseMirrorNode): Array<{ from: number; to: number }> {
  const fields: Array<{ from: number; to: number }> = []
  doc.descendants((node, position) => {
    if (FIELD_NODE_TYPES.has(node.type.name)) {
      fields.push({ from: position + 1, to: position + node.nodeSize - 1 })
      return false
    }
    return true
  })
  return fields
}

function moveToField(editor: Editor, direction: 1 | -1): boolean {
  const fields = fieldPositions(editor.state.doc)
  if (!fields.length) return true
  const { from } = editor.state.selection
  const currentIndex = fields.findIndex((field) => from >= field.from && from <= field.to)
  let target: { from: number; to: number } | undefined
  if (direction === 1) {
    target = currentIndex >= 0 ? fields[currentIndex + 1] : fields.find((field) => field.from > from)
    target ??= fields[0]
  } else {
    target = currentIndex >= 0 ? fields[currentIndex - 1] : [...fields].reverse().find((field) => field.to < from)
    target ??= fields[fields.length - 1]
  }
  const { tr } = editor.state
  editor.view.dispatch(tr.setSelection(TextSelection.create(tr.doc, target.from, target.to)).scrollIntoView())
  editor.view.focus()
  return true
}

/**
 * Template fill mode: the document stays focusable and searchable, but every change outside
 * template fields is rejected. Tab / Shift+Tab move between fields.
 */
export const TemplateFill = Extension.create<Record<string, never>, TemplateFillStorage>({
  name: 'ophxTemplateFill',
  priority: 1100,
  addStorage() {
    return { enabled: false, bypass: false }
  },
  addKeyboardShortcuts() {
    return {
      Tab: () => this.storage.enabled && moveToField(this.editor, 1),
      'Shift-Tab': () => this.storage.enabled && moveToField(this.editor, -1),
      Enter: () => this.storage.enabled,
      'Shift-Enter': () => this.storage.enabled,
    }
  },
  addProseMirrorPlugins() {
    const storage = this.storage
    return [
      new Plugin({
        key: templateFillKey,
        filterTransaction(transaction) {
          if (!storage.enabled || storage.bypass || !transaction.docChanged) return true
          if (transaction.getMeta(TEMPLATE_FILL_ALLOW_META)) return true
          return transaction.steps.every((step, index) => stepStaysInsideField(transaction.docs[index], step))
        },
        props: {
          attributes: (): Record<string, string> => (storage.enabled ? { 'data-ophx-mode': 'fill' } : {}),
        },
      }),
    ]
  },
})
