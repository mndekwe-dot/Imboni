import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
    SkeletonRows, SkeletonToolbar, SkeletonStatStrip, SkeletonDataTable, SkeletonPage,
} from './Skeleton'

describe('SkeletonRows', () => {
    const inTable = ui => render(<table><tbody>{ui}</tbody></table>)

    it('renders rows x cols cells for a page\'s own table body', () => {
        const { container } = inTable(<SkeletonRows rows={4} cols={3} />)
        expect(container.querySelectorAll('tr')).toHaveLength(4)
        expect(container.querySelectorAll('tr:first-child td')).toHaveLength(3)
    })

    it('announces the wait once for the whole table, not once per row', () => {
        inTable(<SkeletonRows rows={5} cols={4} label="Loading students…" />)
        expect(screen.getAllByRole('status')).toHaveLength(1)
        expect(screen.getByRole('status')).toHaveTextContent('Loading students…')
    })

    it('can stay silent when something larger is already announcing', () => {
        inTable(<SkeletonRows rows={3} cols={2} quiet />)
        expect(screen.queryByRole('status')).toBeNull()
    })

    it('gives the first column a round avatar when it is a person', () => {
        const { container } = inTable(<SkeletonRows rows={2} cols={3} avatarFirst />)
        expect(container.querySelectorAll('td:first-child .skel-avatar')).toHaveLength(2)
    })

    it('hides the shapes from assistive tech', () => {
        const { container } = inTable(<SkeletonRows rows={2} cols={2} />)
        container.querySelectorAll('.skel').forEach(el => {
            expect(el.closest('[aria-hidden="true"]')).not.toBeNull()
        })
    })
})

describe('SkeletonToolbar', () => {
    it('is a search box and two filter pills, hidden from assistive tech', () => {
        const { container } = render(<SkeletonToolbar />)
        expect(container.querySelector('.skel-search')).toBeInTheDocument()
        expect(container.querySelectorAll('.skel-pill')).toHaveLength(2)
        expect(container.firstChild).toHaveAttribute('aria-hidden', 'true')
    })
})

describe('SkeletonStatStrip', () => {
    it('uses the real stat grid and tile, so it matches the page by construction', () => {
        const { container } = render(<SkeletonStatStrip count={4} />)
        expect(container.querySelector('.portal-stat-grid')).toBeInTheDocument()
        const tiles = container.querySelectorAll('.portal-stat-card.is-loading')
        expect(tiles).toHaveLength(4)
        expect(tiles[0].querySelector('.portal-stat-icon')).toBeInTheDocument()
        expect(tiles[0].querySelector('.skel-stat-value')).toBeInTheDocument()
    })

    it('announces once', () => {
        render(<SkeletonStatStrip count={3} />)
        expect(screen.getAllByRole('status')).toHaveLength(1)
    })
})

describe('SkeletonDataTable', () => {
    it('draws inside the real DataTable frame with a header row and body rows', () => {
        const { container } = render(<SkeletonDataTable rows={5} cols={4} />)
        expect(container.querySelector('.dt-container .dt-header')).toBeInTheDocument()
        expect(container.querySelectorAll('thead th')).toHaveLength(4)
        expect(container.querySelectorAll('tbody tr')).toHaveLength(5)
        expect(container.querySelector('.dt-footer')).toBeInTheDocument()
    })
})

describe('SkeletonPage', () => {
    it('dashboard: a stat strip and two panels', () => {
        const { container } = render(<SkeletonPage variant="dashboard" />)
        expect(container.querySelectorAll('.portal-stat-card')).toHaveLength(4)
        expect(container.querySelectorAll('.cards-grid .skel-card')).toHaveLength(2)
    })

    it('table: a stat strip, a toolbar and a table', () => {
        const { container } = render(<SkeletonPage variant="table" />)
        expect(container.querySelectorAll('.portal-stat-card')).toHaveLength(4)
        expect(container.querySelector('.toolbar-card .skel-search')).toBeInTheDocument()
        expect(container.querySelector('.dt-container')).toBeInTheDocument()
    })

    it('settings: stacked panels and no stat strip', () => {
        const { container } = render(<SkeletonPage variant="settings" stats={0} />)
        expect(container.querySelector('.portal-stat-card')).toBeNull()
        expect(container.querySelectorAll('.skel-card').length).toBeGreaterThanOrEqual(3)
    })

    it('takes the number of stat tiles the page really has, including none', () => {
        expect(render(<SkeletonPage variant="table" stats={3} />).container.querySelectorAll('.portal-stat-card')).toHaveLength(3)
        expect(render(<SkeletonPage variant="table" stats={0} />).container.querySelector('.portal-stat-grid')).toBeNull()
    })

    it.each(['dashboard', 'table', 'settings'])('%s announces loading exactly once', variant => {
        const { container } = render(<SkeletonPage variant={variant} stats={variant === 'settings' ? 0 : 4} />)
        expect(container.querySelectorAll('[role="status"]')).toHaveLength(1)
    })

    it('uses the label it is given for that one announcement', () => {
        render(<SkeletonPage variant="table" label="Loading students…" />)
        expect(screen.getByRole('status')).toHaveTextContent('Loading students…')
    })
})
