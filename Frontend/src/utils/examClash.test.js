import { describe, it, expect, vi, afterEach } from 'vitest'
import { saveWithClashCheck, clashLines } from './examClash'

const t = (key, vars = {}) => `${key}${vars.details ? `|${vars.details}` : ''}${vars.with ? `:${vars.with}` : ''}`
const clash = { response: { status: 409, data: { conflicts: [{ type: 'class', with: ['Physics'] }] } } }

afterEach(() => vi.restoreAllMocks())

describe('saveWithClashCheck', () => {
    it('sends once when nothing clashes', async () => {
        const send = vi.fn().mockResolvedValue('saved')
        expect(await saveWithClashCheck(send, t)).toBe('saved')
        expect(send).toHaveBeenCalledTimes(1)
    })

    it('asks, and re-sends acknowledged when the user agrees', async () => {
        const send = vi.fn().mockRejectedValueOnce(clash).mockResolvedValueOnce('forced')
        const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)

        expect(await saveWithClashCheck(send, t)).toBe('forced')
        expect(send).toHaveBeenLastCalledWith({ acknowledge_conflicts: true })
        expect(confirm.mock.calls[0][0]).toContain('dos.examSchedule.clash.class:Physics')
    })

    it('does not save when the user declines', async () => {
        const send = vi.fn().mockRejectedValue(clash)
        vi.spyOn(window, 'confirm').mockReturnValue(false)
        expect(await saveWithClashCheck(send, t)).toBeNull()
        expect(send).toHaveBeenCalledTimes(1)
    })

    it('rethrows any other failure', async () => {
        const boom = { response: { status: 500 } }
        await expect(saveWithClashCheck(vi.fn().mockRejectedValue(boom), t)).rejects.toBe(boom)
    })
})

describe('clashLines', () => {
    it('gives one line per problem', () => {
        expect(clashLines([{ type: 'class', with: ['A'] }, { type: 'venue', with: ['B'] }], t).split('\n')).toHaveLength(2)
    })
})
