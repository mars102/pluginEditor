import { Editor, type Content, type EditorOptions } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import { mountToolbar, type ToolbarOptions } from './toolbar'
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
  TemplateFill,
  TextSearch,
  WysiwymRules,
  templateFillKey,
  isValidOphxFieldId,
} from './extensions'

export interface OphxFieldValue {
  id: string
  label: string | null
  required: boolean
  value: string
}

export interface OphxEditorOptions {
  /** Container for the document: an element or a CSS selector. */
  element: HTMLElement | string
  /**
   * Built-in toolbar container (element or CSS selector). When set, the toolbar is mounted
   * automatically and removed by destroy().
   */
  toolbar?: HTMLElement | string
  /** Options for the built-in toolbar, e.g. a custom image upload handler. */
  toolbarOptions?: ToolbarOptions
  content?: Content
  placeholder?: string
  /**
   * Initial mode when nothing is stored yet: 'edit' (default), 'fill' (only template fields
   * are editable) or 'view' (read-only).
   */
  mode?: OphxEditorMode
  /** Legacy shortcut: false is the same as mode: 'view'. Ignored when `mode` is set. */
  editable?: boolean
  /**
   * localStorage key used to remember the mode across reloads.
   * Defaults to 'ophx-editor-editable'. Pass null to disable persistence.
   */
  editableStorageKey?: string | null
  onUpdate?: EditorOptions['onUpdate']
  extensions?: NonNullable<EditorOptions['extensions']>
}

/** edit: full editing; fill: only template fields (.ophx-field) can change; view: read-only. */
export type OphxEditorMode = 'edit' | 'fill' | 'view'

export interface OphxSetContentOptions {
  /** Emit Tiptap's update event after replacing the document. Defaults to false. */
  emitUpdate?: boolean
}

function resolveElement(target: HTMLElement | string, option: string): HTMLElement {
  if (typeof target !== 'string') return target
  const element = document.querySelector<HTMLElement>(target)
  if (!element) throw new Error(`OphxEditor: элемент для опции "${option}" не найден по селектору "${target}"`)
  return element
}

const DEFAULT_EDITABLE_STORAGE_KEY = 'ophx-editor-editable'

/** A framework-neutral Tiptap editor wrapper. UI is intentionally optional. */
export class OphxEditor {
  readonly editor: Editor
  private archiveDefaults: Pick<OphxExportOptions, 'filename' | 'title' | 'styles' | 'bodyContentEditable'> | null = null
  private readonly editableStorageKey: string | null
  private unmountToolbar: (() => void) | null = null

  constructor(options: OphxEditorOptions) {
    this.editableStorageKey = options.editableStorageKey === undefined
      ? DEFAULT_EDITABLE_STORAGE_KEY
      : options.editableStorageKey
    const initialMode: OphxEditorMode = this.readStoredMode()
      ?? options.mode
      ?? (options.editable === false ? 'view' : 'edit')
    this.editor = new Editor({
      element: resolveElement(options.element, 'element'),
      content: options.content ?? '<p></p>',
      editable: initialMode !== 'view',
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
        TemplateFill,
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
      // Passing `onUpdate: undefined` would replace Tiptap's default handler and crash on the first edit.
      ...(options.onUpdate ? { onUpdate: options.onUpdate } : {}),
    })
    this.applyMode(initialMode)
    if (options.toolbar) {
      this.unmountToolbar = mountToolbar(resolveElement(options.toolbar, 'toolbar'), this.editor, options.toolbarOptions)
    }
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

  /** True in 'edit' and 'fill' modes (the document accepts input), false in 'view'. */
  get isEditable(): boolean {
    return this.editor.isEditable
  }

  /** Current mode: 'edit', 'fill' or 'view'. */
  get mode(): OphxEditorMode {
    if (!this.editor.isEditable) return 'view'
    return this.editor.storage.ophxTemplateFill.enabled ? 'fill' : 'edit'
  }

  setContent(content: Content, options: OphxSetContentOptions = {}): void {
    this.archiveDefaults = null
    this.replaceDocument(content, options.emitUpdate ?? false)
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

  /** Shortcut for setMode(editable ? 'edit' : 'view'). */
  setEditable(editable: boolean): this {
    return this.setMode(editable ? 'edit' : 'view')
  }

  /** Switch between full editing, template filling and read-only view. The mode is remembered. */
  setMode(mode: OphxEditorMode): this {
    this.applyMode(mode)
    this.writeStoredMode(mode)
    return this
  }

  private applyMode(mode: OphxEditorMode): void {
    this.editor.storage.ophxTemplateFill.enabled = mode === 'fill'
    this.editor.setEditable(mode !== 'view', false)
    // Re-render editor attributes (data-ophx-mode) and notify listeners such as the toolbar.
    this.editor.view.dispatch(this.editor.state.tr.setMeta(templateFillKey, mode))
    this.syncEditableControls()
  }

  /** Replace the whole document, even in fill mode where user edits outside fields are blocked. */
  private replaceDocument(content: Content, emitUpdate: boolean): void {
    const storage = this.editor.storage.ophxTemplateFill
    storage.bypass = true
    try {
      this.editor.commands.setContent(content, { emitUpdate })
    } finally {
      storage.bypass = false
    }
  }

  private readStoredMode(): OphxEditorMode | null {
    if (!this.editableStorageKey) return null
    try {
      const value = localStorage.getItem(this.editableStorageKey)
      if (value === 'edit' || value === 'fill' || value === 'view') return value
      // Values written by versions before 0.3.0.
      return value === 'true' ? 'edit' : value === 'false' ? 'view' : null
    } catch {
      return null
    }
  }

  private writeStoredMode(mode: OphxEditorMode): void {
    if (!this.editableStorageKey) return
    try {
      localStorage.setItem(this.editableStorageKey, mode)
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
    const structureEditable = editable && !this.editor.storage.ophxTemplateFill.enabled
    this.editor.view.dom
      .querySelectorAll<HTMLButtonElement>('.ophx-heading__toggle')
      .forEach((button) => { button.disabled = !editable })
    this.editor.view.dom
      .querySelectorAll<HTMLButtonElement>('.ophx-image-node__resize-handle')
      .forEach((button) => { button.disabled = !structureEditable })
    this.editor.view.dom.dispatchEvent(new Event('ophx:editablechange'))
  }

  /**
   * Parse and load an .ophx archive; the archive's metadata becomes the default for saveOphx().
   * A template archive (<body contenteditable="false">) switches the editor to 'fill' mode.
   */
  async loadOphx(file: Blob): Promise<OphxDocument> {
    const document = await importOphx(file)
    this.replaceDocument(document.html, false)
    if (document.bodyContentEditable === 'false' && this.mode === 'edit') this.setMode('fill')
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
    this.unmountToolbar?.()
    this.unmountToolbar = null
    this.editor.destroy()
  }
}
