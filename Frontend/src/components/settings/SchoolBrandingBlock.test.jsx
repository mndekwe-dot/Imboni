import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor } from '../../test/test-utils'

vi.mock('../../api/branding', () => ({
    getSchoolBranding: vi.fn().mockResolvedValue({ school_name: 'Green Hills', logo: null }),
    setSchoolLogo: vi.fn(),
    removeSchoolLogo: vi.fn(),
}))

import { getSchoolBranding, setSchoolLogo, removeSchoolLogo } from '../../api/branding'
import { __resetBrandingCache } from '../../hooks/useSchoolBranding'
import { SchoolBrandingBlock } from './SchoolBrandingBlock'

const file = (type, size = 1000) => {
    const f = new File(['x'], 'logo.png', { type })
    Object.defineProperty(f, 'size', { value: size })
    return f
}
const choose = f => fireEvent.change(screen.getByLabelText('School logo', { selector: 'input' }), { target: { files: [f] } })

describe('SchoolBrandingBlock', () => {
    beforeEach(() => {
        __resetBrandingCache()
        vi.clearAllMocks()
        getSchoolBranding.mockResolvedValue({ school_name: 'Green Hills', logo: null })
    })

    it('uploads a valid image and then re-reads the branding', async () => {
        setSchoolLogo.mockResolvedValue({})
        renderWithRouter(<SchoolBrandingBlock />)
        await waitFor(() => expect(getSchoolBranding).toHaveBeenCalledTimes(1))
        getSchoolBranding.mockResolvedValue({ school_name: 'Green Hills', logo: 'https://x/logo.png' })

        choose(file('image/png'))

        await waitFor(() => expect(setSchoolLogo).toHaveBeenCalled())
        await waitFor(() => expect(getSchoolBranding).toHaveBeenCalledTimes(2))
        expect(await screen.findByRole('button', { name: 'Replace logo' })).toBeInTheDocument()
    })

    it('refuses a wrong type or an oversized image without calling the server', async () => {
        renderWithRouter(<SchoolBrandingBlock />)
        choose(file('image/gif'))
        choose(file('image/png', 3 * 1024 * 1024))
        await screen.findByText('The logo must be a JPG or PNG image.')
        await screen.findByText('That image is over 2 MB. Choose a smaller one.')
        expect(setSchoolLogo).not.toHaveBeenCalled()
    })

    it('can take the logo off again', async () => {
        getSchoolBranding.mockResolvedValue({ school_name: 'Green Hills', logo: 'https://x/logo.png' })
        removeSchoolLogo.mockResolvedValue({})
        renderWithRouter(<SchoolBrandingBlock />)
        fireEvent.click(await screen.findByRole('button', { name: 'Remove' }))
        await waitFor(() => expect(removeSchoolLogo).toHaveBeenCalled())
    })
})
