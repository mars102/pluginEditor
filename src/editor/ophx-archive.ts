import JSZip from 'jszip'

export interface OphxDocument {
  /** Sanitized body HTML ready for the Tiptap schema. */
  html: string
  title: string
  /** Basename of the required root-level HTML entry, without extension. */
  filename: string
  /** Local stylesheet files keyed by their exact archive filename. */
  styles: Record<string, string>
  /** Convenience alias for the first stylesheet, if present. */
  css: string
  bodyContentEditable?: 'true' | 'false'
}

export interface OphxExportOptions {
  /** Basename used for both the outer .ophx file and the root-level HTML file. */
  filename?: string
  title?: string
  /** Flat stylesheet filenames mapped to CSS source. */
  styles?: Record<string, string>
  /** Files for already-referenced local image names, keyed by exact archive filename. */
  assets?: Record<string, Blob | Uint8Array | ArrayBuffer>
  bodyContentEditable?: 'true' | 'false'
}

const MIME_BY_EXTENSION: Record<string, string> = {
  avif: 'image/avif',
  bmp: 'image/bmp',
  gif: 'image/gif',
  ico: 'image/x-icon',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  webp: 'image/webp',
}

/** Creates a v2 .ophx ZIP using only flat, UTF-8-named STORE/DEFLATE entries. */
export async function exportOphx(html: string, options: OphxExportOptions = {}): Promise<Blob> {
  const zip = new JSZip()
  const document = new DOMParser().parseFromString(html, 'text/html')
  validateTemplateFields(document)
  const documentName = safeDocumentName(options.filename ?? options.title ?? 'Документ')
  const title = options.title ?? document.title ?? documentName
  const assets = options.assets ?? {}
  const mediaNames = new Set(Object.keys(assets).map(decodeArchiveName))
  let mediaIndex = 0

  for (const image of Array.from(document.querySelectorAll('img[src]'))) {
    const source = image.getAttribute('src')?.trim()
    if (!source || /^https?:\/\//i.test(source) || /^data:(?!image\/)/i.test(source)) continue

    if (/^data:image\//i.test(source) || /^blob:/i.test(source)) {
      try {
        const response = await fetch(source)
        if (!response.ok) throw new Error(`Не удалось прочитать изображение: ${source}`)
        const blob = await response.blob()
        if (!blob.type.startsWith('image/')) throw new Error('Вложение с data/blob URL не является изображением')
        let filename = `image-${++mediaIndex}.${extensionFor(blob.type, source)}`
        while (mediaNames.has(filename)) filename = `image-${++mediaIndex}.${extensionFor(blob.type, source)}`
        zip.file(filename, blob)
        mediaNames.add(filename)
        image.setAttribute('src', encodeURIComponent(filename))
      } catch (error) {
        throw new Error('Не удалось добавить изображение в архив ophx', { cause: error })
      }
      continue
    }

    const filename = decodeArchiveName(source)
    if (!isFlatFilename(filename)) {
      throw new Error(`Путь изображения должен быть простым именем файла: ${source}`)
    }
    const asset = assets[filename]
    if (!asset && !mediaNames.has(filename)) {
      throw new Error(`Для локального изображения «${filename}» не передан файл media`)
    }
    if (asset) zip.file(filename, asset)
    image.setAttribute('src', encodeURIComponent(filename))
  }

  const styles = normalizeStyles(options.styles ?? {})
  for (const [filename, source] of Object.entries(styles)) zip.file(filename, source)

  const styleLinks = Object.keys(styles)
    .map((filename) => `<link rel="stylesheet" href="${escapeHtml(encodeURIComponent(filename))}">`)
    .join('')
  const language = document.documentElement.lang || 'ru'
  const bodyEditable = options.bodyContentEditable
    ? ` contenteditable="${options.bodyContentEditable}"`
    : ''
  const serializedHtml = `<!doctype html>\n<html lang="${escapeHtml(language)}"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>${styleLinks}</head><body${bodyEditable}>${document.body.innerHTML}</body></html>`

  zip.file(`${documentName}.html`, serializedHtml)
  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/zip',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
}

/** Reads only current v2 archives; legacy non-ZIP/XML formats are rejected. */
export async function importOphx(file: Blob): Promise<OphxDocument> {
  await assertZipSignature(file)
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(file)
  } catch (error) {
    throw new Error('Не удалось прочитать ZIP-архив .ophx (шифрование и неподдерживаемые ZIP-режимы не поддерживаются)', { cause: error })
  }

  if (Object.values(zip.files).some((entry) => entry.dir || /[\\/]/.test(entry.name))) {
    throw new Error('В текущей версии .ophx все файлы должны находиться плоским списком в корне архива')
  }
  const rootFiles = Object.values(zip.files).filter((entry) => !entry.dir)
  const htmlFiles = rootFiles.filter((entry) => entry.name.toLowerCase().endsWith('.html'))
  if (htmlFiles.length !== 1) {
    if (htmlFiles.length === 0 && rootFiles.some((entry) => entry.name.toLowerCase().endsWith('.xml'))) {
      throw new Error('Обнаружен устаревший XML-вариант ophx; поддерживается только версия v2 с HTML5 внутри ZIP')
    }
    throw new Error(`В архиве должен быть ровно один HTML-файл в корне; найдено: ${htmlFiles.length}`)
  }

  const htmlFile = htmlFiles[0]
  const documentName = htmlFile.name.slice(0, -'.html'.length)
  const outerFilename = 'name' in file && typeof file.name === 'string' ? file.name : ''
  if (/\.ophx$/i.test(outerFilename) && outerFilename.replace(/\.ophx$/i, '') !== documentName) {
    throw new Error(`Имя HTML-файла «${htmlFile.name}» должно совпадать с именем архива «${outerFilename}»`)
  }
  const source = await htmlFile.async('string')
  if (!/^\s*<!doctype\s+html\b/i.test(source)) {
    throw new Error('Основной файл .ophx должен начинаться с <!doctype html>')
  }
  const document = new DOMParser().parseFromString(source, 'text/html')
  const charset = document.querySelector('head meta[charset]')?.getAttribute('charset')?.toLowerCase()
  if (charset !== 'utf-8') throw new Error('В <head> документа требуется <meta charset="utf-8">')
  const styles: Record<string, string> = {}

  for (const link of Array.from(document.querySelectorAll('head link[rel~="stylesheet"][href]'))) {
    const href = link.getAttribute('href')?.trim()
    if (!href) continue
    if (isExternalUrl(href)) throw new Error(`CSS должен быть встроенным плоским файлом архива: ${href}`)
    const filename = decodeArchiveName(href)
    if (!isFlatFilename(filename) || !filename.toLowerCase().endsWith('.css')) {
      throw new Error(`Ссылка на стиль должна указывать на плоский .css-файл: ${href}`)
    }
    const styleFile = zip.file(filename)
    if (!styleFile) throw new Error(`Файл стиля «${filename}» отсутствует в архиве`)
    styles[filename] = await styleFile.async('string')
  }

  for (const image of Array.from(document.querySelectorAll('img[src]'))) {
    const sourceRef = image.getAttribute('src')?.trim()
    if (!sourceRef || isExternalUrl(sourceRef)) continue
    const filename = decodeArchiveName(sourceRef)
    if (!isFlatFilename(filename)) throw new Error(`Ссылка на изображение должна быть простым именем файла: ${sourceRef}`)
    const imageFile = zip.file(filename)
    if (!imageFile) throw new Error(`Файл изображения «${filename}» отсутствует в архиве`)
    const base64 = await imageFile.async('base64')
    const extension = filename.split('.').pop()?.toLowerCase() ?? ''
    const mime = MIME_BY_EXTENSION[extension] ?? (extension ? `image/${extension}` : 'application/octet-stream')
    image.setAttribute('src', `data:${mime};base64,${base64}`)
  }

  const bodyContentEditable = document.body.getAttribute('contenteditable')
  if (bodyContentEditable === 'false') {
    for (const child of Array.from(document.body.children)) {
      if (!child.hasAttribute('contenteditable')) child.setAttribute('contenteditable', 'false')
    }
  }
  sanitizeDocument(document)

  const styleEntries = Object.entries(styles)
  return {
    html: document.body.innerHTML,
    title: document.title || documentName,
    filename: documentName,
    styles,
    css: styleEntries[0]?.[1] ?? '',
    bodyContentEditable: bodyContentEditable === 'true' || bodyContentEditable === 'false'
      ? bodyContentEditable
      : undefined,
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = window.document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function normalizeStyles(styles: Record<string, string>): Record<string, string> {
  const normalized: Record<string, string> = {}
  for (const [rawName, source] of Object.entries(styles)) {
    const filename = decodeArchiveName(rawName)
    if (!isFlatFilename(filename) || !filename.toLowerCase().endsWith('.css')) {
      throw new Error(`Имя файла стиля должно быть плоским и оканчиваться на .css: ${rawName}`)
    }
    if (Object.hasOwn(normalized, filename)) throw new Error(`Повторяется имя файла стиля: ${filename}`)
    normalized[filename] = source
  }
  return normalized
}

function validateTemplateFields(document: Document): void {
  const candidates = Array.from(document.querySelectorAll('[data-ophx-field], .ophx-field'))
  const ids = new Set<string>()
  for (const element of candidates) {
    const id = element.getAttribute('data-ophx-field') ?? ''
    const tagName = element.tagName.toLowerCase()
    if (!element.classList.contains('ophx-field') || element.getAttribute('contenteditable') !== 'true') {
      throw new Error('Каждое поле должно иметь класс ophx-field и contenteditable="true"')
    }
    if (!['span', 'div', 'p'].includes(tagName) || !/^[A-Za-z0-9._-]+$/.test(id)) {
      throw new Error(`Некорректная обёртка или идентификатор поля: ${id || '(пусто)'}`)
    }
    if (ids.has(id)) throw new Error(`Идентификатор поля должен быть уникальным: ${id}`)
    if (element.parentElement?.closest('[data-ophx-field]')) {
      throw new Error(`Поля не могут быть вложенными: ${id}`)
    }
    ids.add(id)
  }
}

function safeDocumentName(value: string): string {
  const name = value.trim().replace(/\.(?:ophx|html)$/i, '')
  if (!name) return 'Документ'
  if (!isFlatFilename(name) || /[\u0000-\u001f]/.test(name)) {
    throw new Error('Имя .ophx должно быть простым именем файла без каталогов')
  }
  return name
}

function isFlatFilename(value: string): boolean {
  return Boolean(value) && value !== '.' && value !== '..' && !/[\\/]/.test(value)
}

function decodeArchiveName(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    throw new Error(`Некорректное percent-экранирование в имени ресурса: ${value}`)
  }
}

function isExternalUrl(value: string): boolean {
  return /^(?:data:|https?:\/\/)/i.test(value)
}

async function assertZipSignature(file: Blob): Promise<void> {
  if (file.size < 2) throw new Error('Файл не является ZIP-архивом .ophx (возможен устаревший формат)')
  const signature = new Uint8Array(await file.slice(0, 4).arrayBuffer())
  if (signature[0] !== 0x50 || signature[1] !== 0x4b) {
    throw new Error('Неподдерживаемый устаревший ophx: ожидается ZIP-архив версии v2')
  }
}

function extensionFor(mime: string, source: string): string {
  const fromMime = Object.entries(MIME_BY_EXTENSION).find(([, value]) => value === mime)?.[0]
  if (fromMime) return fromMime
  const suffix = source.match(/\.([a-z0-9]+)(?:[?#]|$)/i)?.[1]?.toLowerCase()
  return suffix && /^[a-z0-9]{1,6}$/.test(suffix) ? suffix : 'bin'
}

function sanitizeDocument(document: Document): void {
  document.querySelectorAll('script, iframe, object, embed, style, link').forEach((element) => element.remove())
  document.querySelectorAll('*').forEach((element) => {
    for (const attribute of Array.from(element.attributes)) {
      if (/^on/i.test(attribute.name)) element.removeAttribute(attribute.name)
      if (/^(href|src|xlink:href)$/i.test(attribute.name) && /^\s*(javascript|vbscript):/i.test(attribute.value)) {
        element.removeAttribute(attribute.name)
      }
      if (/^(src|xlink:href)$/i.test(attribute.name) && /^\s*data:(?!image\/)/i.test(attribute.value)) {
        element.removeAttribute(attribute.name)
      }
    }
  })
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return entities[character]
  })
}
