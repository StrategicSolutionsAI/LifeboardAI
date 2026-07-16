import { decodeHtmlEntities, parseGmailMessageSummary } from '../message-parser'

describe('decodeHtmlEntities', () => {
  // Regression: Gmail snippets rendered literally as "today&#39;s" in the inbox list
  it('decodes numeric entities', () => {
    expect(decodeHtmlEntities('today&#39;s new startups')).toBe("today's new startups")
    expect(decodeHtmlEntities('you haven&#x27;t replied')).toBe("you haven't replied")
  })

  it('decodes common named entities', () => {
    expect(decodeHtmlEntities('Sale &amp; more&hellip;')).toBe('Sale & more…')
    expect(decodeHtmlEntities('&quot;quoted&quot; &lt;tag&gt;')).toBe('"quoted" <tag>')
  })

  it('leaves unknown entities and plain text untouched', () => {
    expect(decodeHtmlEntities('AT&T plain &unknown; text')).toBe('AT&T plain &unknown; text')
  })

  it('does not double-decode escaped entities', () => {
    expect(decodeHtmlEntities('&amp;#39;')).toBe('&#39;')
  })
})

describe('parseGmailMessageSummary', () => {
  it('returns a decoded snippet', () => {
    const parsed = parseGmailMessageSummary({
      id: 'm1',
      threadId: 't1',
      snippet: 'Don&#39;t miss today&#39;s deals',
      labelIds: ['UNREAD'],
      payload: { headers: [{ name: 'Subject', value: 'Deals' }] },
    })

    expect(parsed.snippet).toBe("Don't miss today's deals")
    expect(parsed.isUnread).toBe(true)
  })
})
