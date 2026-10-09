import { describe, it, expect, vi } from 'vitest'
import { readImageAsDataUrl, imageErrorText, MAX_IMAGE_MB } from './imageData'

const file = (bytes, name, type) => new File([new Uint8Array(bytes)], name, { type })

describe('readImageAsDataUrl', () => {
  it('reads a small picture into a data URI', async () => {
    const out = await readImageAsDataUrl(file(10, 'a.png', 'image/png'))
    expect(out).toMatch(/^data:image\/png;base64,/)
  })

  it.each(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])('accepts %s', async type => {
    await expect(readImageAsDataUrl(file(10, 'a', type))).resolves.toMatch(/^data:/)
  })

  it('refuses anything that is not a picture', async () => {
    await expect(readImageAsDataUrl(file(10, 'notes.pdf', 'application/pdf')))
      .rejects.toMatchObject({ kind: 'notSupported' })
  })

  it('refuses SVG, which can carry script', async () => {
    await expect(readImageAsDataUrl(file(10, 'a.svg', 'image/svg+xml')))
      .rejects.toMatchObject({ kind: 'notSupported' })
  })

  it('refuses a missing file instead of throwing', async () => {
    await expect(readImageAsDataUrl(undefined)).rejects.toMatchObject({ kind: 'notSupported' })
  })

  it('refuses a picture over the limit, before reading it', async () => {
    const big = file(MAX_IMAGE_MB * 1024 * 1024 + 1, 'big.jpg', 'image/jpeg')
    const read = vi.spyOn(FileReader.prototype, 'readAsDataURL')
    await expect(readImageAsDataUrl(big)).rejects.toMatchObject({ kind: 'tooLarge' })
    expect(read).not.toHaveBeenCalled()
    read.mockRestore()
  })

  it('accepts a picture exactly at the limit', async () => {
    const edge = file(MAX_IMAGE_MB * 1024 * 1024, 'edge.jpg', 'image/jpeg')
    await expect(readImageAsDataUrl(edge)).resolves.toMatch(/^data:/)
  })

  it('reports a failed read as readFailed', async () => {
    const spy = vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function () {
      setTimeout(() => this.onerror?.(new Event('error')), 0)
    })
    await expect(readImageAsDataUrl(file(10, 'a.png', 'image/png'))).rejects.toMatchObject({ kind: 'readFailed' })
    spy.mockRestore()
  })
})

describe('imageErrorText', () => {
  const t = (key, vars) => `${key}${vars ? JSON.stringify(vars) : ''}`

  it('names the limit when the picture is too large', () => {
    expect(imageErrorText({ kind: 'tooLarge' }, t)).toBe(`common.imageTooLarge{"max":${MAX_IMAGE_MB}}`)
  })
  it('says what is accepted for the wrong type', () => {
    expect(imageErrorText({ kind: 'notSupported' }, t)).toBe('common.imageNotSupported')
  })
  it('falls back to a read failure for anything else', () => {
    expect(imageErrorText(new Error('boom'), t)).toBe('common.imageReadFailed')
  })
})
