import { useState, useEffect } from 'react'
import { NavLink } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import logo from '../../assets/images/imboni-logo.webp'
import { useSchoolBranding } from '../../hooks/useSchoolBranding'
import { useBrandedTab } from '../../hooks/useBrandedTab'
import { useLibraryFeature } from '../../hooks/useLibraryFeature'
import { useSchoolModules } from '../../hooks/useSchoolModules'
import { ROLE_HOME, readStoredUser } from '../../utils/roles'
import { useLocation } from 'react-router'
import { useNavBadges } from '../../hooks/useNavBadges'
import { useTransitionNavigate } from '../../hooks/useTransitionNavigate'
import { CommandPalette } from './CommandPalette'

/* Every page mounts its own <Sidebar> — 64 of them — so component state alone
   meant collapsing it and then clicking any nav item sprang it back open. The
   choice is a preference, so it lives outside the component tree. */
const COLLAPSED_KEY = 'imboni:sidebar-collapsed'

function readCollapsed() {
    try { return localStorage.getItem(COLLAPSED_KEY) === '1' } catch { return false }
}

/* True on a phone-width screen. The bottom tabs render only then (rather than
   always, hidden by CSS) so the same links are never in the page twice for a
   screen reader, or in every test that looks a nav link up by name. */
function usePhone() {
  const query = '(max-width: 768px)'
  const [phone, setPhone] = useState(() => (
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      && window.matchMedia(query).matches
  ))
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined
    const mq = window.matchMedia(query)
    const on = () => setPhone(mq.matches)
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])
  return phone
}

export function Sidebar({ navItems, secondaryItems }) {
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const transitionClick = useTransitionNavigate()
  /* A nav item may declare `feature: 'library'`, and it appears only for a
     school whose plan includes it. The filter lives HERE rather than in each
     portal's nav file because those files are plain arrays imported by ten
     pages apiece -- making one of them conditional would mean making all ten
     pages ask. `enabled` is null until the answer arrives, and a link is not
     shown on a maybe. */
  const { enabled: libraryEnabled } = useLibraryFeature()
  /* `feature: 'matron'` / `'boarding'` are parts an operator can switch off for a
     school (a day school has no use for them). Those are hidden only on an
     explicit `false`, never on a maybe: a failed check must not take a part of
     the product away from a school that is using it. */
  const { modules } = useSchoolModules()
  const visible = items => items.filter(item => {
    if (item.feature === 'library') return libraryEnabled === true
    if (item.feature) return modules?.[item.feature] !== false
    return true
  })
  const [mobileOpen, setMobileOpen] = useState(false)
  const isPhone = usePhone()
  const badges = useNavBadges(navItems)
  const { logout } = useAuth()
  const { schoolName, logo: schoolLogo } = useSchoolBranding()
  useBrandedTab()
  const { t } = useTranslation()

  const location = useLocation()
  /* A person who holds more than one role (a teacher who is also the assistant
     DOS) gets a link to each portal they can open, except the one they are in.
     The links come from the roles on the account, never from the URL. */
  const me = readStoredUser()
  const portals = me?.extra_roles?.length ? [me.role, ...me.extra_roles] : []
  const switchItems = portals
    .filter(r => ROLE_HOME[r] && !(location.pathname === ROLE_HOME[r] || location.pathname.startsWith(`${ROLE_HOME[r]}/`)))
    .map(r => ({ to: ROLE_HOME[r], icon: 'swap_horiz', label: t('sidebar.switchTo', { role: t(`roles.${r}`) }) }))

  // Remember the choice. localStorage throws in some privacy modes, and a
  // sidebar that will not remember its width is not worth failing a render over.
  useEffect(() => {
    try { localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0') } catch { /* ignore */ }
  }, [collapsed])

  // Listen for the mobile-menu-btn in DashboardHeader to open us
  useEffect(() => {
    const open = () => setMobileOpen(true)
    document.addEventListener('imboni:open-sidebar', open)
    return () => document.removeEventListener('imboni:open-sidebar', open)
  }, [])

  const sidebarClass = [
    'sidebar',
    collapsed ? 'collapsed' : '',
    mobileOpen ? 'active' : '',
  ].filter(Boolean).join(' ')

  /* One row of the nav. The label is always rendered — collapsed it becomes the
     hover tooltip rather than being removed, so the rail is never a set of
     unlabelled icons and screen readers keep a real accessible name. */
  const row = (item) => (
    <>
      <span className="material-symbols-rounded" aria-hidden="true">{item.icon}</span>
      <span className="sidebar-nav-label">{item.label ?? t(item.labelKey)}</span>
      {badges[item.badge] > 0 && (
        <span className="sidebar-badge" title={t('sidebar.waiting', { count: badges[item.badge] })}>
          <span aria-hidden="true">{badges[item.badge] > 99 ? '99+' : badges[item.badge]}</span>
          <span className="sr-only">{t('sidebar.waiting', { count: badges[item.badge] })}</span>
        </span>
      )}
    </>
  )

  return (
    <>
      {mobileOpen && (
        <div
          className="sidebar-overlay active"
          aria-hidden="true"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Ctrl+K: the same links as below, searchable. */}
      <CommandPalette items={[...visible(navItems), ...switchItems, ...visible(secondaryItems)]} />

      <aside className={sidebarClass}>
        <header className="sidebar-logo">
          {/* The school's own mark and name when it has set them, the Imboni
              ones otherwise. A school that has not uploaded a logo is the
              normal case, not a broken one, so both halves fall back
              independently: a school can have a name and no logo. */}
          <div className="logo-wrapper">
            <div className="sidebar-logo-icon">
              <img src={schoolLogo || logo}
                   alt={schoolName || t('sidebar.logoAlt')} />
            </div>
            <div className="sidebar-logo-text">
              <span className="sidebar-brand-name" title={schoolName || 'Imboni'}>
                {schoolName || 'Imboni'}
              </span>
              <span className="sidebar-brand-tagline">{t('sidebar.tagline')}</span>
            </div>
          </div>

          {/* Mobile: close sidebar */}
          <button
            className="toggle menu-toggle"
            aria-label={t('sidebar.closeMenu')}
            onClick={() => setMobileOpen(false)}
          >
            <span className="material-symbols-rounded" aria-hidden="true">close</span>
          </button>
        </header>

        {/* Desktop collapse/expand. A sibling of the header, not a child of it:
            inside it, the button sat on top of the brand tagline. On the panel
            edge it can never collide with anything. */}
        <button
          className="sidebar-toggle"
          aria-label={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed(c => !c)}
        >
          <span className="material-symbols-rounded" aria-hidden="true">chevron_left</span>
        </button>

        <nav className="sidebar-nav" aria-label={t('sidebar.mainNavigation')}>
          {/* No heading on the first group: the main nav is self-evidently the
              main nav, and the eyebrow was just a line of noise at the top. */}
          <ul className="nav-list primary-nav" aria-label={t('sidebar.mainNavigation')}>
            {visible(navItems).map((item) => (
              <li key={item.to || item.labelKey}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    'sidebar-nav-item' + (isActive ? ' active' : '')
                  }
                  onClick={transitionClick(item.to, () => setMobileOpen(false))}
                >
                  {row(item)}
                </NavLink>
              </li>
            ))}
          </ul>

          {/* Heading and list in one block. They used to be siblings with the
              `margin-top: auto` on the list alone, so the list sank to the
              bottom of the rail and left its own heading stranded near the top
              with an empty gap between them. */}
          <div className="sidebar-account-group">
          <p className="sidebar-nav-group" id="sidebar-group-account">{t('sidebar.groupAccount')}</p>
          <ul className="nav-list secondary-nav" aria-labelledby="sidebar-group-account">
            {[...switchItems, ...visible(secondaryItems)].map((item) => (
              <li key={item.to || item.action || item.labelKey}>
                {item.action === 'logout' ? (
                  <button
                    className="sidebar-nav-item"
                    onClick={() => { setMobileOpen(false); logout() }}
                  >
                    {row(item)}
                  </button>
                ) : (
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      'sidebar-nav-item' + (isActive ? ' active' : '')
                    }
                    onClick={transitionClick(item.to, () => setMobileOpen(false))}
                  >
                    {row(item)}
                  </NavLink>
                )}
              </li>
            ))}
          </ul>
          </div>
        </nav>
      </aside>

      {/* On a phone the drawer is two taps away from every page. The four most
          used pages stay one thumb-reach below, the rest behind "More", which
          opens the same drawer. */}
      {isPhone && (
        <nav className="bottom-tabs" aria-label={t('sidebar.quickNavigation')}>
          {visible(navItems).filter(i => i.to).slice(0, 4).map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => 'bottom-tab' + (isActive ? ' active' : '')}
              onClick={transitionClick(item.to, () => setMobileOpen(false))}
            >
              <span className="material-symbols-rounded" aria-hidden="true">{item.icon}</span>
              <span className="bottom-tab-label">{item.label ?? t(item.labelKey)}</span>
              {badges[item.badge] > 0 && <span className="bottom-tab-dot" aria-hidden="true" />}
            </NavLink>
          ))}
          <button type="button" className="bottom-tab" onClick={() => setMobileOpen(true)}>
            <span className="material-symbols-rounded" aria-hidden="true">menu</span>
            <span className="bottom-tab-label">{t('sidebar.more')}</span>
          </button>
        </nav>
      )}
    </>
  )
}
