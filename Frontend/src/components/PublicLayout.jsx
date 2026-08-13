import { Link } from 'react-router'
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
    const year = new Date().getFullYear()

    return (
        <div className="pub-page">
            <nav className="pub-nav">
                <Link to="/" className="pub-nav-brand">
                    <div className="pub-nav-logo">
                        <img src={logo} alt="Imboni" />
                    </div>
                    <span className="pub-nav-name">Imboni <span>Education</span></span>
                </Link>

                <div className="pub-nav-right">
                    <div className="pub-nav-links">
                        <Link to="/pricing">Pricing</Link>
                        <Link to="/about">About</Link>
                        <Link to="/contact">Contact</Link>
                        <Link to="/signup">Sign up your school</Link>
                    </div>
                    <Link to="/login" className="pub-nav-signin">
                        <span className="material-symbols-rounded">login</span>
                        Sign In
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
                        <span className="pub-footer-heading">Imboni Education</span>
                        <p className="pub-footer-desc">
                            School management for Rwandan secondary schools. One system
                            for students, parents, teachers and boarding staff.
                        </p>
                    </div>

                    <div className="pub-footer-col">
                        <span className="pub-footer-heading">Product</span>
                        <Link to="/pricing">Pricing</Link>
                        <Link to="/signup">Sign up your school</Link>
                        <Link to="/apply">Apply to join</Link>
                        <Link to="/login">Sign in</Link>
                    </div>

                    <div className="pub-footer-col">
                        <span className="pub-footer-heading">Company</span>
                        <Link to="/about">About us</Link>
                        <Link to="/contact">Contact</Link>
                    </div>

                    <div className="pub-footer-col">
                        <span className="pub-footer-heading">Legal</span>
                        <Link to="/privacy">Privacy policy</Link>
                        <Link to="/terms">Terms of service</Link>
                    </div>
                </div>

                <div className="pub-footer-base">
                    <span>&copy; {year} Imboni Education. Musanze, Rwanda.</span>
                    <span>info@imboni.edu.rw</span>
                </div>
            </footer>
        </div>
    )
}
