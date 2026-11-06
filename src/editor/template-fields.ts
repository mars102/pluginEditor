export interface UnderscoreFieldConversion {
  html: string
  count: number
  ids: string[]
}

/** Replaces each run of two or more underscores in editable text with an empty v2 field. */
export function convertUnderscoresToFields(html: string, prefix = 'f'): UnderscoreFieldConversion {
  if (!/^[A-Za-z0-9._-]+$/.test(prefix)) throw new Error('Префикс идентификаторов полей содержит недопустимые символы')
  const document = new DOMParser().parseFromString(html, 'text/html')
  const usedIds = new Set(
    Array.from(document.querySelectorAll('[data-ophx-field]'))
      .map((element) => element.getAttribute('data-ophx-field') ?? '')
      .filter(Boolean),
  )
  const walker = document.createTreeWalker(document.body, 4)
  const textNodes: Text[] = []
  while (walker.nextNode()) {
    const textNode = walker.currentNode as Text
    const parent = textNode.parentElement
    if (!parent || parent.closest('code, pre, script, style, [contenteditable="false"], [data-ophx-field]')) continue
    if (/_{2,}/.test(textNode.data)) textNodes.push(textNode)
  }

  const ids: string[] = []
  let sequence = 1
  for (const textNode of textNodes) {
    const fragment = document.createDocumentFragment()
    let previousIndex = 0
    const matcher = /_{2,}/g
    for (const match of textNode.data.matchAll(matcher)) {
      if (match.index === undefined) continue
      if (match.index > previousIndex) fragment.append(document.createTextNode(textNode.data.slice(previousIndex, match.index)))
      let id = `${prefix}${sequence++}`
      while (usedIds.has(id)) id = `${prefix}${sequence++}`
      usedIds.add(id)
      ids.push(id)

      const field = document.createElement('span')
      field.className = 'ophx-field'
      field.setAttribute('contenteditable', 'true')
      field.setAttribute('data-ophx-field', id)
      fragment.append(field)
      previousIndex = match.index + match[0].length
    }
    if (previousIndex < textNode.data.length) fragment.append(document.createTextNode(textNode.data.slice(previousIndex)))
    textNode.replaceWith(fragment)
  }

  return { html: document.body.innerHTML, count: ids.length, ids }
}
