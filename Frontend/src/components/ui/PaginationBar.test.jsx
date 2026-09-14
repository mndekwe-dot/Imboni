import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import i18n from '../../i18n'
import { PaginationBar } from './PaginationBar'

describe('PaginationBar', () => {
    afterEach(() => i18n.changeLanguage('en'))

    it('renders nothing when everything fits on one page', () => {
        const { container } = render(
            <PaginationBar page={1} totalPages={1} totalCount={4} label="items" onPage={() => {}} />)
        expect(container).toBeEmptyDOMElement()
    })

    it('shows the count and position, and pages through', () => {
        const onPage = vi.fn()
        render(<PaginationBar page={2} totalPages={3} totalCount={25} label="results" onPage={onPage} />)
        expect(screen.getByText('25 results (Page 2 of 3)')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
        fireEvent.click(screen.getByRole('button', { name: 'Previous page' }))
        fireEvent.click(screen.getByRole('button', { name: 'Last page' }))
        fireEvent.click(screen.getByRole('button', { name: 'First page' }))
        expect(onPage.mock.calls.map(c => c[0])).toEqual([3, 1, 3, 1])
    })

    it('disables the buttons that would go past either end', () => {
        render(<PaginationBar page={1} totalPages={2} totalCount={12} label="items" onPage={() => {}} />)
        expect(screen.getByRole('button', { name: 'First page' })).toBeDisabled()
        expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
        expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled()
    })

    it('uses a pluralised summary when the caller passes one', () => {
        render(<PaginationBar page={1} totalPages={2} totalCount={12} summary="12 announcements" onPage={() => {}} />)
        expect(screen.getByText('12 announcements (Page 1 of 2)')).toBeInTheDocument()
    })

    it('follows the interface language', async () => {
        await i18n.changeLanguage('fr')
        render(<PaginationBar page={1} totalPages={2} totalCount={12} summary="12 annonces" onPage={() => {}} />)
        expect(screen.getByText('12 annonces (Page 1 sur 2)')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Page suivante' })).toBeInTheDocument()
    })
})
