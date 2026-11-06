import { Extension, Mark, Node } from '@tiptap/core'
import Heading from '@tiptap/extension-heading'
import { Plugin, PluginKey } from '@tiptap/pm/state'
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
