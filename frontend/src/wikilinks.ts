function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character)
}

export function wikilinkMarkup(title: string) {
  return `[[${escapeHtml(title.trim())}]]`
}

export function hasWikilink(content: string, title: string) {
  return content.toLocaleLowerCase().includes(wikilinkMarkup(title).toLocaleLowerCase())
}

export function appendWikilink(content: string, title: string) {
  if (hasWikilink(content, title)) return content
  const route = `<p>${wikilinkMarkup(title)}</p>`
  return content.trim() ? `${content}<p></p>${route}` : route
}
