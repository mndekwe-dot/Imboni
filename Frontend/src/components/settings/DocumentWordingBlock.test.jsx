import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor } from '../../test/test-utils'

vi.mock('../../api/dos', () => ({
    updateSchoolSettings: vi.fn(),
}))

import { updateSchoolSettings } from '../../api/dos'
import { DocumentWordingBlock } from './DocumentWordingBlock'

describe('DocumentWordingBlock', () => {
    beforeEach(() => vi.clearAllMocks())

    it('shows what the school already set and the standard wording as a hint', () => {
        renderWithRouter(<DocumentWordingBlock initial={{ motto: 'Learn to lead' }} />)
        expect(screen.getByLabelText('Motto or line under the school name')).toHaveValue('Learn to lead')
        expect(screen.getByLabelText('Right signature label')).toHaveAttribute('placeholder', 'The School HeadMaster')
    })

    it('saves the edited wording', async () => {
        updateSchoolSettings.mockResolvedValue({})
        renderWithRouter(<DocumentWordingBlock initial={{}} />)
        fireEvent.change(screen.getByLabelText('Right signature label'), { target: { value: 'Head Teacher' } })
        fireEvent.click(screen.getByRole('button', { name: 'Save wording' }))
        await waitFor(() => expect(updateSchoolSettings).toHaveBeenCalledWith({ document_text: { report_signatory_right: 'Head Teacher' } }))
        expect(await screen.findByText('Wording saved.')).toBeInTheDocument()
    })
})
