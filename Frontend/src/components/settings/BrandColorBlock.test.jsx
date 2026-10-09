import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor } from '../../test/test-utils'

vi.mock('../../api/branding', () => ({
    getSchoolBranding: vi.fn(),
}))
vi.mock('../../api/dos', () => ({
    updateSchoolSettings: vi.fn(),
}))

import { getSchoolBranding } from '../../api/branding'
import { updateSchoolSettings } from '../../api/dos'
import { __resetBrandingCache } from '../../hooks/useSchoolBranding'
import { BrandColorBlock } from './BrandColorBlock'

const hex = () => screen.getByLabelText('Colour code')

describe('BrandColorBlock', () => {
    beforeEach(() => {
        __resetBrandingCache()
        vi.clearAllMocks()
        getSchoolBranding.mockResolvedValue({ school_name: 'Green Hills', logo: null, brand_color: '' })
    })

    it('saves a readable colour and re-reads the branding', async () => {
        updateSchoolSettings.mockResolvedValue({})
        renderWithRouter(<BrandColorBlock />)
        fireEvent.change(hex(), { target: { value: '#7c2d12' } })
        expect(await screen.findByText(/Readable/)).toBeInTheDocument()
        getSchoolBranding.mockResolvedValue({ school_name: 'Green Hills', logo: null, brand_color: '#7c2d12' })

        fireEvent.click(screen.getByRole('button', { name: 'Save colour' }))

        await waitFor(() => expect(updateSchoolSettings).toHaveBeenCalledWith({ brand_color: '#7c2d12' }))
        expect(await screen.findByRole('button', { name: 'Use the Imboni blue' })).toBeInTheDocument()
    })

    it('says why a too-light colour is refused and will not save it', async () => {
        renderWithRouter(<BrandColorBlock />)
        fireEvent.change(hex(), { target: { value: '#ffeb3b' } })
        expect(await screen.findByText(/Too light/)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Save colour' })).toBeDisabled()
        expect(updateSchoolSettings).not.toHaveBeenCalled()
    })

    it('goes back to the product blue', async () => {
        getSchoolBranding.mockResolvedValue({ school_name: 'Green Hills', logo: null, brand_color: '#7c2d12' })
        updateSchoolSettings.mockResolvedValue({})
        renderWithRouter(<BrandColorBlock />)
        fireEvent.click(await screen.findByRole('button', { name: 'Use the Imboni blue' }))
        await waitFor(() => expect(updateSchoolSettings).toHaveBeenCalledWith({ brand_color: '' }))
    })
})
