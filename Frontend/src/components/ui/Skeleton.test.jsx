import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SkeletonText, SkeletonList, SkeletonTable, SkeletonStats, SkeletonCard } from './Skeleton'

describe('Skeleton', () => {
    it('renders the requested number of lines', () => {
        const { container } = render(<SkeletonText lines={5} />)
        expect(container.querySelectorAll('.skel-line')).toHaveLength(5)
    })

    it('renders a row per list item, each with an avatar', () => {
        const { container } = render(<SkeletonList items={3} />)
        expect(container.querySelectorAll('.skel-row')).toHaveLength(3)
        expect(container.querySelectorAll('.skel-avatar')).toHaveLength(3)
    })

    it('renders rows x cols cells', () => {
        const { container } = render(<SkeletonTable rows={4} cols={3} />)
        expect(container.querySelectorAll('tr')).toHaveLength(4)
        expect(container.querySelectorAll('td')).toHaveLength(12)
    })

    it('renders one card per stat', () => {
        const { container } = render(<SkeletonStats count={4} />)
        expect(container.querySelectorAll('.skel-stat')).toHaveLength(4)
    })

    // The shapes replaced a visible "Loading…". Without a live region a screen
    // reader would be told nothing at all while waiting.
    it('announces the wait to assistive technology', () => {
        render(<SkeletonCard />)
        expect(screen.getByRole('status')).toHaveTextContent(/loading/i)
    })

    it('accepts a more specific announcement', () => {
        render(<SkeletonTable label="Loading students" />)
        expect(screen.getByRole('status')).toHaveTextContent('Loading students')
    })

    // Decorative shapes must not be read out one by one.
    it('hides the shapes themselves from assistive technology', () => {
        const { container } = render(<SkeletonText lines={3} />)
        container.querySelectorAll('.skel').forEach(el =>
            expect(el).toHaveAttribute('aria-hidden', 'true'))
    })
})
