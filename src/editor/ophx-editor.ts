import { Editor, type Content, type EditorOptions } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import { downloadBlob, exportOphx, importOphx, type OphxDocument, type OphxExportOptions } from './ophx-archive'
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
  /** Initial mode when nothing is stored yet. Defaults to true. */
  editable?: boolean
  /**
   * localStorage key used to remember the edit/view mode across reloads.
   * Defaults to 'ophx-editor-editable'. Pass null to disable persistence.
   */
  editableStorageKey?: string | null
  onUpdate?: EditorOptions['onUpdate']
  extensions?: NonNullable<EditorOptions['extensions']>
}

export interface OphxSetContentOptions {
  /** Emit Tiptap's update event after replacing the document. Defaults to false. */
  emitUpdate?: boolean
}

const DEFAULT_EDITABLE_STORAGE_KEY = 'ophx-editor-editable'

/** A framework-neutral Tiptap editor wrapper. UI is intentionally optional. */
export class OphxEditor {
  readonly editor: Editor
  private archiveDefaults: Pick<OphxExportOptions, 'filename' | 'title' | 'styles' | 'bodyContentEditable'> | null = null
  private readonly editableStorageKey: string | null

  constructor(options: OphxEditorOptions) {
    this.editableStorageKey = options.editableStorageKey === undefined
      ? DEFAULT_EDITABLE_STORAGE_KEY
      : options.editableStorageKey
    this.editor = new Editor({
      element: options.element,
      content: options.content ?? '<p></p>',
      editable: this.readStoredEditable() ?? options.editable ?? true,
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
        handleDOMEvents: {
          mousedown: (view, event) => {
            if (view.editable) return false
            const target = event.target instanceof Element ? event.target : null
            if (!target) return false

            if (target.closest('.ophx-image-node, img')) {
              event.preventDefault()
              return true
            }

            const table = target.closest('table')
            const textContent = target.closest('p, span, a, strong, em, code')
            if (table && (!textContent || event.metaKey || event.ctrlKey)) {
              event.preventDefault()
              return true
            }
            return false
          },
        },
      },
      onUpdate: options.onUpdate,
    })
    this.syncEditableControls()
  }

  getHTML(): string {
    return this.editor.getHTML()
  }

  getJSON() {
    return this.editor.getJSON()
  }

  getText(): string {
    return this.editor.getText()
  }

  get isEmpty(): boolean {
    return this.editor.isEmpty
  }

  get isEditable(): boolean {
    return this.editor.isEditable
  }

  setContent(content: Content, options: OphxSetContentOptions = {}): void {
    this.archiveDefaults = null
    this.editor.commands.setContent(content, { emitUpdate: options.emitUpdate ?? false })
  }

  clearContent(options: OphxSetContentOptions = {}): void {
    this.setContent('<p></p>', options)
  }

  focus(position?: 'start' | 'end' | 'all' | number): this {
    this.editor.commands.focus(position)
    return this
  }

  blur(): this {
    this.editor.commands.blur()
    return this
  }

  setEditable(editable: boolean): this {
    this.editor.setEditable(editable, false)
    this.writeStoredEditable(editable)
    this.syncEditableControls()
    return this
  }

  private readStoredEditable(): boolean | null {
    if (!this.editableStorageKey) return null
    try {
      const value = localStorage.getItem(this.editableStorageKey)
      return value === 'true' ? true : value === 'false' ? false : null
    } catch {
      return null
    }
  }

  private writeStoredEditable(editable: boolean): void {
    if (!this.editableStorageKey) return
    try {
      localStorage.setItem(this.editableStorageKey, String(editable))
    } catch {
      // Storage may be unavailable (private mode, blocked site data).
    }
  }

  undo(): boolean {
    return this.editor.commands.undo()
  }

  redo(): boolean {
    return this.editor.commands.redo()
  }

  canUndo(): boolean {
    return this.editor.can().undo()
  }

  canRedo(): boolean {
    return this.editor.can().redo()
  }

  private syncEditableControls(): void {
    const editable = this.editor.isEditable
    this.editor.view.dom
      .querySelectorAll<HTMLButtonElement>('.ophx-heading__toggle, .ophx-image-node__resize-handle')
      .forEach((button) => { button.disabled = !editable })
    this.editor.view.dom.dispatchEvent(new Event('ophx:editablechange'))
  }

  /** Parse and load an .ophx archive; the archive's metadata becomes the default for saveOphx(). */
  async loadOphx(file: Blob): Promise<OphxDocument> {
    const document = await importOphx(file)
    this.editor.commands.setContent(document.html, { emitUpdate: false })
    this.archiveDefaults = {
      filename: document.filename,
      title: document.title,
      styles: document.styles,
      bodyContentEditable: document.bodyContentEditable,
    }
    return document
  }

  /** Create an .ophx archive Blob; callers can persist it or pass it to downloadBlob(). */
  saveOphx(options: OphxExportOptions = {}): Promise<Blob> {
    return exportOphx(this.getHTML(), { ...this.archiveDefaults, ...options })
  }

  /** Trigger a browser download of the current document as an .ophx archive. */
  async downloadOphx(options: OphxExportOptions = {}): Promise<void> {
    const filename = options.filename ?? this.archiveDefaults?.filename ?? options.title ?? this.archiveDefaults?.title ?? 'Документ'
    const blob = await this.saveOphx(options)
    downloadBlob(blob, `${filename.replace(/\.ophx$/i, '')}.ophx`)
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
