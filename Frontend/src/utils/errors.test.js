import { describe, it, expect } from 'vitest'
import { errorMessage } from './errors'

const FALLBACK = 'Could not save.'

describe('errorMessage', () => {
  it('prefers the reason the server gave', () => {
    expect(errorMessage({ response: { data: { detail: 'Not allowed.' } } }, FALLBACK)).toBe('Not allowed.')
    expect(errorMessage({ response: { data: { error: 'No active term.' } } }, FALLBACK)).toBe('No active term.')
    expect(errorMessage({ response: { data: { amount: ['Must be positive.'] } } }, FALLBACK)).toBe('Must be positive.')
    expect(errorMessage({ response: { data: 'Too many requests.' } }, FALLBACK)).toBe('Too many requests.')
  })

  it('never shows an HTML error page as the message', () => {
    const debugPage = '<!DOCTYPE html><html><body>OperationalError at /imboni/staff/ ... django.contrib.admin ...</body></html>'
    const err = { message: 'Request failed with status code 500', response: { status: 500, data: debugPage } }
    expect(errorMessage(err, FALLBACK)).toBe(FALLBACK)
  })

  it("uses the caller's words rather than axios's for a server reply with no reason", () => {
    const err = { message: 'Request failed with status code 502', response: { status: 502, data: '' } }
    expect(errorMessage(err, FALLBACK)).toBe(FALLBACK)
  })

  it('explains a request that never reached the server', () => {
    expect(errorMessage({ message: 'Network Error' }, FALLBACK)).toMatch(/Cannot reach the server/)
  })

  it('keeps the message of an ordinary thrown error', () => {
    expect(errorMessage(new Error('Pick a class first.'), FALLBACK)).toBe('Pick a class first.')
  })
})
