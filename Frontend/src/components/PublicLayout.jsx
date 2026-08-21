import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from './ui/LanguageSwitcher'
import logo from '../assets/images/imboni-logo.png'
import '../styles/public-pages.css'

/**
 * Chrome for the logged-out marketing pages (pricing, about, contact, legal).
 *
 * The landing page keeps its own bespoke nav and footer because its links are
 * in-page anchors (#features, #portals) that only exist there. Everything else
 * shares this, so a visitor who lands on /pricing from a search result still
 * gets a way back into the site and a route to signing up.
 */
export function PublicLayout({ title, subtitle, children }) {
    const { t } = useTranslation()
    const year = new Date().getFullYear()

    return (
        <div className="pub-page">
            <nav className="pub-nav">
                <Link to="/" className="pub-nav-brand">
                    <div className="pub-nav-logo">
                        <img src={logo} alt="Imboni" />
                    </div>
                    <span className="pub-nav-name">Imboni <span>{t('publicNav.education')}</span></span>
                </Link>

                <div className="pub-nav-right">
                    <div className="pub-nav-links">
                        <Link to="/pricing">{t('publicNav.pricing')}</Link>
                        <Link to="/about">{t('publicNav.about')}</Link>
                        <Link to="/contact">{t('publicNav.contact')}</Link>
                        <Link to="/signup">{t('publicNav.signUpSchool')}</Link>
                    </div>
                    <LanguageSwitcher compact />
                    <Link to="/login" className="pub-nav-signin">
                        <span className="material-symbols-rounded">login</span>
                        {t('publicNav.signIn')}
                    </Link>
                </div>
            </nav>

            <header className="pub-header">
                <h1 className="pub-header-title">{title}</h1>
                {subtitle && <p className="pub-header-sub">{subtitle}</p>}
            </header>

            <main className="pub-main">{children}</main>

            <footer className="pub-footer">
                <div className="pub-footer-inner">
                    <div className="pub-footer-col">
                        <span className="pub-footer-heading">{t('publicLayout.brandName')}</span>
                        <p className="pub-footer-desc">{t('publicLayout.footerDesc')}</p>
                    </div>

                    <div className="pub-footer-col">
                        <span className="pub-footer-heading">{t('publicLayout.colProduct')}</span>
                        <Link to="/pricing">{t('publicNav.pricing')}</Link>
                        <Link to="/signup">{t('publicNav.signUpSchool')}</Link>
                        <Link to="/apply">{t('publicNav.applyToJoin')}</Link>
                        <Link to="/login">{t('publicNav.signInPlain')}</Link>
                        <Link to="/find-school">{t('publicNav.findSchool')}</Link>
                    </div>

                    <div className="pub-footer-col">
                        <span className="pub-footer-heading">{t('publicLayout.colCompany')}</span>
                        <Link to="/about">{t('publicNav.aboutUs')}</Link>
                        <Link to="/contact">{t('publicNav.contact')}</Link>
                    </div>

                    <div className="pub-footer-col">
                        <span className="pub-footer-heading">{t('publicLayout.colLegal')}</span>
                        <Link to="/privacy">{t('publicNav.privacyPolicy')}</Link>
                        <Link to="/terms">{t('publicNav.termsOfService')}</Link>
                    </div>
                </div>

                <div className="pub-footer-base">
                    <span>{t('publicLayout.copyright', { year })}</span>
                    <span>info@imboni.edu.rw</span>
                    <LanguageSwitcher compact />
                </div>
            </footer>
        </div>
    )
}
