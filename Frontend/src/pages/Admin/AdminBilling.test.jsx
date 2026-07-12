import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, waitFor } from '../../test/test-utils'
import { AdminBilling } from './AdminBilling'
import { getBillingStatus } from '../../api/billing'

vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

vi.mock('../../api/billing', () => ({
  getBillingStatus: vi.fn(),
  startCheckout: vi.fn(),
}))

const PLANS = [
  { key: 'basic', name: 'Basic' },
  { key: 'premium', name: 'Premium' },
]

describe('AdminBilling', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the current plan and status chip from getBillingStatus', async () => {
    getBillingStatus.mockResolvedValue({
      plan: 'basic', status: 'active', on_trial: false, has_subscription: true,
      stripe_enabled: true, plans: PLANS,
    })
    renderWithRouter(<AdminBilling />)

    await waitFor(() => expect(screen.getByText('basic')).toBeInTheDocument())
    expect(screen.getByText('Active')).toBeInTheDocument()
    // The plan the school is on shows a disabled "Current plan" button.
    expect(screen.getByRole('button', { name: 'Current plan' })).toBeDisabled()
    // The other plan is subscribable.
    expect(screen.getByRole('button', { name: 'Subscribe' })).toBeEnabled()
  })

  it('disables subscribe buttons and shows the note when stripe is not enabled', async () => {
    getBillingStatus.mockResolvedValue({
      plan: 'free', status: 'trial', on_trial: true, has_subscription: false,
      stripe_enabled: false, plans: PLANS,
    })
    renderWithRouter(<AdminBilling />)

    await waitFor(() =>
      expect(screen.getByText(/Online billing isn't set up on this server yet/)).toBeInTheDocument())

    const subscribeButtons = screen.getAllByRole('button', { name: 'Subscribe' })
    expect(subscribeButtons).toHaveLength(2)
    subscribeButtons.forEach(btn => expect(btn).toBeDisabled())
  })
})
