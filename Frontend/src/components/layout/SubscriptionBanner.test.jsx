import { describe, it, expect } from 'vitest'
import { renderWithRouter, screen, act } from '../../test/test-utils'
import { SubscriptionBanner } from './SubscriptionBanner'
import { setSubscriptionStatus } from '../../api/subscriptionState'

describe('SubscriptionBanner', () => {
    it('shows nothing for a school in good standing', () => {
        renderWithRouter(<SubscriptionBanner />)
        // The test wrapper supplies a toast region, so look for the banner
        // itself rather than an empty container.
        expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('tells a read-only school what it can and cannot do', () => {
        act(() => { setSubscriptionStatus('read_only') })
        renderWithRouter(<SubscriptionBanner />)

        expect(screen.getByText(/This school is read-only/i)).toBeInTheDocument()
        // The distinction that matters to a teacher: reading still works.
        expect(screen.getByText(/open and export everything/i)).toBeInTheDocument()
    })

    it('warns a past-due school without claiming it is locked', () => {
        act(() => { setSubscriptionStatus('past_due') })
        renderWithRouter(<SubscriptionBanner />)

        expect(screen.getByText(/Payment overdue/i)).toBeInTheDocument()
        expect(screen.queryByText(/read-only/i)).not.toBeInTheDocument()
    })

    it('appears when a later response reports a change, without a reload', () => {
        renderWithRouter(<SubscriptionBanner />)
        expect(screen.queryByText(/read-only/i)).not.toBeInTheDocument()

        act(() => { setSubscriptionStatus('read_only') })
        expect(screen.getByText(/This school is read-only/i)).toBeInTheDocument()
    })

    it('clears itself when a reactivated school stops sending the header', () => {
        act(() => { setSubscriptionStatus('read_only') })
        renderWithRouter(<SubscriptionBanner />)
        expect(screen.getByText(/This school is read-only/i)).toBeInTheDocument()

        // An absent header means "nothing to say" -- the banner must go away on
        // its own, or a reactivated school keeps being told it is restricted.
        act(() => { setSubscriptionStatus(undefined) })
        expect(screen.queryByText(/This school is read-only/i)).not.toBeInTheDocument()
    })
})
