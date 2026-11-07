import { Editor, type Content, type EditorOptions } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import {
  CollapsibleHeading,
  Indentation,
  Label,
  OphxImage,
  OphxBlockField,
  OphxEditability,
  OphxInlineField,
  OphxReadonlyBlock,
  OphxReadonlyInline,
  TextSearch,
  WysiwymRules,
  isValidOphxFieldId,
} from './extensions'

export interface OphxFieldValue {
  id: string
  label: string | null
  required: boolean
  value: string
}

export interface OphxEditorOptions {
  element: HTMLElement
  content?: Content
  placeholder?: string
  editable?: boolean
  onUpdate?: EditorOptions['onUpdate']
  extensions?: NonNullable<EditorOptions['extensions']>
}

/** A framework-neutral Tiptap editor wrapper. UI is intentionally optional. */
export class OphxEditor {
  readonly editor: Editor

  constructor(options: OphxEditorOptions) {
    this.editor = new Editor({
      element: options.element,
      content: options.content ?? '<p></p>',
      editable: options.editable ?? true,
      extensions: [
        StarterKit.configure({ heading: false, underline: false, link: false }),
        CollapsibleHeading.configure({ levels: [1, 2, 3, 4, 5, 6] }),
        Underline,
        Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true }),
        OphxImage.configure({ allowBase64: true, inline: false }),
        Table.configure({ resizable: true }),
        TableRow,
        TableHeader,
        TableCell,
        OphxInlineField,
        OphxBlockField,
        OphxReadonlyBlock,
        OphxReadonlyInline,
        Label,
        Indentation,
        OphxEditability,
        TextSearch,
        WysiwymRules,
        Placeholder.configure({ placeholder: options.placeholder ?? 'Начните писать…' }),
        ...(options.extensions ?? []),
      ],
      editorProps: {
        attributes: {
          class: 'ophx-editor-surface',
          spellcheck: 'true',
          lang: 'ru',
          'aria-label': 'Редактор документа',
        },
      },
      onUpdate: options.onUpdate,
    })
  }

  getHTML(): string {
    return this.editor.getHTML()
  }

  getJSON() {
    return this.editor.getJSON()
  }

  setContent(content: Content): void {
    this.editor.commands.setContent(content, { emitUpdate: false })
  }

  setSearchQuery(query: string): void {
    this.editor.commands.setSearchQuery(query)
  }

  getFields(): OphxFieldValue[] {
    const candidates = Array.from(this.editor.view.dom.querySelectorAll<HTMLElement>('[data-ophx-field]'))
      .filter((element) => {
        const id = element.getAttribute('data-ophx-field') ?? ''
        return element.classList.contains('ophx-field') &&
          element.getAttribute('contenteditable') === 'true' &&
          isValidOphxFieldId(id)
      })
    const idCounts = new Map<string, number>()
    for (const element of candidates) {
      const id = element.getAttribute('data-ophx-field')!
      idCounts.set(id, (idCounts.get(id) ?? 0) + 1)
    }
    return candidates
      .filter((element) => idCounts.get(element.getAttribute('data-ophx-field')!) === 1)
      .map((element) => ({
        id: element.getAttribute('data-ophx-field')!,
        label: element.getAttribute('data-ophx-label'),
        required: element.getAttribute('data-ophx-required') === 'true',
        value: element.textContent ?? '',
      }))
  }

  getMissingRequiredFields(): OphxFieldValue[] {
    return this.getFields().filter((field) => field.required && !field.value.trim())
  }

  destroy(): void {
    this.editor.destroy()
  }
}
