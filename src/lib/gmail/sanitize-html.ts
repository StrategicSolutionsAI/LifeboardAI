/**
 * Sanitize HTML email content for safe rendering.
 *
 * Strips dangerous tags (<script>, <style>, <iframe>, <object>, <embed>, <form>)
 * and removes on* event handler attributes.
 *
 * The sanitized HTML should be rendered inside a sandboxed iframe:
 *   <iframe srcDoc={sanitizedHtml} sandbox="" />
 */
export function sanitizeEmailHtml(html: string): string {
  if (!html) return ''

  let sanitized = html

  // Remove dangerous tags and their content
  const dangerousTags = ['script', 'style', 'iframe', 'object', 'embed', 'form', 'applet']
  for (const tag of dangerousTags) {
    // Remove opening + content + closing tag
    sanitized = sanitized.replace(
      new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi'),
      '',
    )
    // Remove self-closing variants
    sanitized = sanitized.replace(
      new RegExp(`<${tag}[^>]*\\/?>`, 'gi'),
      '',
    )
  }

  // Remove on* event handler attributes (onclick, onload, onerror, etc.)
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')

  // Remove javascript: protocol in href/src attributes
  sanitized = sanitized.replace(
    /(href|src)\s*=\s*["']?\s*javascript\s*:/gi,
    '$1="',
  )

  return sanitized
}
