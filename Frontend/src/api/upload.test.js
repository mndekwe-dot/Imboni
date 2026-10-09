import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./client', () => ({
  default: { post: vi.fn().mockResolvedValue({ ok: true }), patch: vi.fn().mockResolvedValue({ ok: true }) },
}))

import client from './client'
import { sendBody, fileNameIn } from './upload'
import { getTransfers, resetTransfers } from '../utils/transfers'

const file = name => new File(['x'], name, { type: 'image/png' })

describe('sendBody', () => {
  beforeEach(() => { vi.clearAllMocks(); resetTransfers() })

  it('sends a plain JSON body exactly as before: same arguments, no tray entry', async () => {
    await sendBody('post', '/u/', { title: 'HW' })
    expect(client.post).toHaveBeenCalledWith('/u/', { title: 'HW' })
    expect(getTransfers()).toHaveLength(0)
  })

  it('shows a multipart body that carries a file as an upload, named after the file', async () => {
    const form = new FormData()
    form.append('title', 'Notes')
    form.append('file', file('notes.pdf'))

    await sendBody('post', '/u/', form)

    expect(getTransfers()).toMatchObject([{ direction: 'upload', name: 'notes.pdf', status: 'done' }])
    const config = client.post.mock.calls[0][2]
    expect(typeof config.onUploadProgress).toBe('function')
  })

  it('does not show a multipart body with no file in it', async () => {
    const form = new FormData()
    form.append('title', 'No file here')
    await sendBody('patch', '/u/', form)
    expect(getTransfers()).toHaveLength(0)
  })

  it('merges a caller\'s own config with the progress handler', async () => {
    const form = new FormData()
    form.append('file', file('a.png'))
    await sendBody('post', '/u/', form, { timeout: 5000 })
    expect(client.post.mock.calls[0][2]).toMatchObject({ timeout: 5000 })
  })

  it('a failed upload shows as failed and still rejects', async () => {
    client.post.mockRejectedValueOnce(new Error('413'))
    const form = new FormData()
    form.append('file', file('big.png'))
    await expect(sendBody('post', '/u/', form)).rejects.toThrow('413')
    expect(getTransfers()[0].status).toBe('error')
  })
})

describe('fileNameIn', () => {
  it('finds the file wherever it sits in the form', () => {
    const form = new FormData()
    form.append('a', '1')
    form.append('doc', file('x.pdf'))
    expect(fileNameIn(form)).toBe('x.pdf')
  })
  it('is empty for anything that is not a form', () => {
    expect(fileNameIn({ file: file('x') })).toBe('')
    expect(fileNameIn(null)).toBe('')
  })
})
