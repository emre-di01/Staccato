import { marked } from 'marked'
import DOMPurify from 'dompurify'

export function safeMarkdown(text) {
  return DOMPurify.sanitize(marked.parse(text ?? ''))
}
