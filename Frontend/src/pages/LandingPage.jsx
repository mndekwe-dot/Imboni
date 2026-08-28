import '../styles/landing.css'
import { LanguageSwitcher } from '../components/ui/LanguageSwitcher'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import logo from '../assets/images/imboni-logo.png'

// These tables are evaluated once at module load, before a language is known,
// so they hold translation keys and the component resolves them at render.
const portals = [
    {
        titleKey: 'portal.student',
        descKey: 'landing.portals.studentDesc',
        icon: 'school',
        color: '#0d9488',
        bg: 'rgba(13,148,136,0.1)',
        border: 'rgba(13,148,136,0.25)',
        gradient: 'linear-gradient(135deg, #0d9488, #0891b2)',
        features: ['timetable', 'results', 'assignments', 'attendance'],
    },
    {
        titleKey: 'portal.teacher',
        descKey: 'landing.portals.teacherDesc',
        icon: 'person_book',
        color: '#0891b2',
        bg: 'rgba(8,145,178,0.09)',
        border: 'rgba(8,145,178,0.22)',
        gradient: 'linear-gradient(135deg, #0891b2, #0369a1)',
        features: ['classes', 'results', 'attendance', 'assignments'],
    },
    {
        titleKey: 'portal.parent',
        descKey: 'landing.portals.parentDesc',
        icon: 'family_restroom',
        color: '#7c3aed',
        bg: 'rgba(124,58,237,0.09)',
        border: 'rgba(124,58,237,0.22)',
        gradient: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
        features: ['academicResults', 'attendance', 'behaviour', 'messages'],
    },
    {
        titleKey: 'portal.dos',
        descKey: 'landing.portals.dosDesc',
        icon: 'manage_accounts',
        color: '#003d7a',
        bg: 'rgba(0,61,122,0.09)',
        border: 'rgba(0,61,122,0.22)',
        gradient: 'linear-gradient(135deg, #003d7a, #005a8f)',
        features: ['analytics', 'timetables', 'exams', 'announcements'],
    },
    {
        titleKey: 'portal.discipline',
        descKey: 'landing.portals.disDesc',
        icon: 'security',
        color: '#4f46e5',
        bg: 'rgba(79,70,229,0.09)',
        border: 'rgba(79,70,229,0.22)',
        gradient: 'linear-gradient(135deg, #4f46e5, #4338ca)',
        features: ['conductReports', 'activities', 'dining', 'boarding'],
    },
    {
        titleKey: 'portal.matron',
        descKey: 'landing.portals.matronDesc',
        icon: 'health_and_safety',
        color: '#8b5cf6',
        bg: 'rgba(139,92,246,0.09)',
        border: 'rgba(139,92,246,0.22)',
        gradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
        features: ['healthRecords', 'incidents', 'students', 'parentComms'],
    },
]

const features = [
    { icon: 'sync',           key: 'realtime'  },
    { icon: 'lock',           key: 'secure'    },
    { icon: 'forum',          key: 'messaging' },
    { icon: 'bar_chart',      key: 'analytics' },
    { icon: 'phone_iphone',   key: 'mobile'    },
    { icon: 'notifications',  key: 'smart'     },
]

const aboutPoints = [
    { icon: 'emoji_objects', key: 'mission'    },
    { icon: 'groups',        key: 'serve'      },
    { icon: 'verified',      key: 'commitment' },
]

const boardingPoints = ['point1', 'point2', 'point3', 'point4', 'point5', 'point6']

const boardingHouses = [
    { name: 'Karisimbi', groupKey: 'common.girls' },
    { name: 'Muhabura',  groupKey: 'common.boys'  },
    { name: 'Bisoke',    groupKey: 'common.girls' },
    { name: 'Sabyinyo',  groupKey: 'common.boys'  },
]

const mockNotifs = [
    { icon: 'priority_high', color: '#ef4444', key: 'notif1' },
    { icon: 'school',        color: '#0d9488', key: 'notif2' },
    { icon: 'event',         color: '#f97316', key: 'notif3' },
]

// Contact details are data, not copy — only the labels are translated.
const contactItems = [
    { icon: 'location_on', labelKey: 'landing.contact.address', valueKey: 'landing.contact.addressValue' },
    { icon: 'mail',        labelKey: 'common.email',            value: 'info@imboni.edu.rw'              },
    { icon: 'phone',       labelKey: 'common.phone',            value: '+250 788 000 000'                },
    { icon: 'schedule',    labelKey: 'landing.contact.hours',   valueKey: 'landing.contact.hoursValue'   },
]

export function LandingPage() {
    const { t } = useTranslation()

    return (
        <div className="landing-page">

            {/* ── Navbar ── */}
            <nav className="landing-nav">
                <div className="landing-nav-brand">
                    <div className="landing-nav-logo">
                        <img src={logo} alt="Imboni Logo" />
                    </div>
                    <span className="landing-nav-name">Imboni <span>{t('publicNav.education')}</span></span>
                </div>
                <div className="landing-nav-right">
                    <div className="landing-nav-links">
                        <a href="#portals">{t('publicNav.portals')}</a>
                        <a href="#features">{t('publicNav.features')}</a>
                        <Link to="/pricing">{t('publicNav.pricing')}</Link>
                        <Link to="/about">{t('publicNav.about')}</Link>
                        <Link to="/contact">{t('publicNav.contact')}</Link>
                        <Link to="/signup">{t('publicNav.signUpSchool')}</Link>
                    </div>
                    <LanguageSwitcher variant="buttons" compact />
                    <Link to="/login" className="landing-nav-signin">
                        <span className="material-symbols-rounded">login</span>
                        {t('publicNav.signIn')}
                    </Link>
                </div>
            </nav>

            {/* ── Hero ── */}
            <section className="landing-hero">
                <div className="hero-bg-image" />
                <div className="hero-bg-overlay" />
                <div className="hero-grid" />

                <div className="hero-inner">
                    <div className="hero-content">
                        <div className="hero-badge">
                            <span className="material-symbols-rounded">verified</span>
                            {t('landing.hero.badge')}
                        </div>

                        <h1 className="hero-title">
                            {t('landing.hero.titleLine1')}<br />
                            {t('landing.hero.titleLine2')}<br />
                            <span className="accent">{t('landing.hero.titleAccent')}</span>
                        </h1>

                        <p className="hero-subtitle">
                            {t('landing.hero.subtitle')}
                        </p>

                        <div className="hero-actions">
                            <Link to="/login" className="hero-cta">
                                {t('landing.hero.cta')}
                                <span className="material-symbols-rounded">arrow_forward</span>
                            </Link>
                            <a href="#about" className="hero-secondary">
                                {t('landing.hero.secondary')}
                            </a>
                        </div>
                    </div>

                    {/* RIGHT — UI mockup */}
                    <div className="hero-visual">
                        <div className="hero-mockup">
                            <div className="mockup-bar">
                                <div className="mockup-dots">
                                    <span /><span /><span />
                                </div>
                                <div className="mockup-url">imboni.edu/student</div>
                            </div>
                            <div className="mockup-body">
                                <div className="mockup-header">
                                    <div className="mockup-avatar">UA</div>
                                    <div>
                                        <div className="mockup-name">Uwase Amina</div>
                                        <div className="mockup-role">{t('landing.mock.role')}</div>
                                    </div>
                                </div>
                                <div className="mockup-stat-row">
                                    <div className="mockup-stat-card" style={{ '--mc': '#0d9488' }}>
                                        <span className="material-symbols-rounded">menu_book</span>
                                        <div className="msc-val">8</div>
                                        <div className="msc-lbl">{t('landing.mock.subjects')}</div>
                                    </div>
                                    <div className="mockup-stat-card" style={{ '--mc': '#f97316' }}>
                                        <span className="material-symbols-rounded">assignment</span>
                                        <div className="msc-val">3</div>
                                        <div className="msc-lbl">{t('landing.mock.dueSoon')}</div>
                                    </div>
                                    <div className="mockup-stat-card" style={{ '--mc': '#4f46e5' }}>
                                        <span className="material-symbols-rounded">check_circle</span>
                                        <div className="msc-val">94%</div>
                                        <div className="msc-lbl">{t('landing.mock.attendance')}</div>
                                    </div>
                                </div>
                                <div className="mockup-notif-label">{t('landing.mock.notifLabel')}</div>
                                <div className="mockup-notifs">
                                    {mockNotifs.map((n, i) => (
                                        <div key={i} className="mockup-notif">
                                            <div className="mockup-notif-icon" style={{ background: `${n.color}20`, color: n.color }}>
                                                <span className="material-symbols-rounded">{n.icon}</span>
                                            </div>
                                            <div className="mockup-notif-text">{t(`landing.mock.${n.key}`)}</div>
                                            <div className="mockup-notif-time">{t(`landing.mock.${n.key}Time`)}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="hero-mockup-glow" />
                    </div>
                </div>

                <div className="hero-scroll-hint">
                    <span className="material-symbols-rounded">keyboard_arrow_down</span>
                </div>
            </section>

            {/* ── About ── */}
            <section className="landing-section" id="about">
                <div className="section-header">
                    <div className="section-label">{t('landing.about.label')}</div>
                    <h2 className="section-title">{t('landing.about.title')}</h2>
                    <p className="section-subtitle">
                        {t('landing.about.subtitle')}
                    </p>
                </div>
                <div className="about-grid">
                    {aboutPoints.map(p => (
                        <div key={p.key} className="about-card">
                            <div className="about-card-icon">
                                <span className="material-symbols-rounded">{p.icon}</span>
                            </div>
                            <div className="about-card-title">{t(`landing.about.${p.key}Title`)}</div>
                            <p className="about-card-desc">{t(`landing.about.${p.key}Desc`)}</p>
                        </div>
                    ))}
                </div>

                {/* About photo strip */}
                <div className="about-photo-strip">
                    <div className="about-photo-overlay" />
                    <div className="about-photo-content">
                        <blockquote className="about-quote">
                            {t('landing.about.quote')}
                        </blockquote>
                        <div className="about-quote-source">{t('landing.about.quoteSource')}</div>
                    </div>
                </div>
            </section>

            {/* ── Portals ── */}
            <section className="landing-section alt" id="portals">
                <div className="section-header">
                    <div className="section-label">{t('landing.portals.label')}</div>
                    <h2 className="section-title">{t('landing.portals.title')}</h2>
                    <p className="section-subtitle">
                        {t('landing.portals.subtitle')}
                    </p>
                </div>
                <div className="portals-grid">
                    {portals.map(p => (
                        <div
                            key={p.titleKey}
                            className="portal-card"
                            style={{ '--card-color': p.color, '--card-bg': p.bg, '--card-border': p.border, '--card-gradient': p.gradient }}
                        >
                            <div className="portal-card-top-bar" />
                            <div className="portal-card-icon">
                                <span className="material-symbols-rounded">{p.icon}</span>
                            </div>
                            <div>
                                <div className="portal-card-title">{t(p.titleKey)}</div>
                                <p className="portal-card-desc">{t(p.descKey)}</p>
                            </div>
                            <div className="portal-card-features">
                                {p.features.map(f => (
                                    <span key={f} className="portal-card-feature">{t(`landing.chip.${f}`)}</span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Features ── */}
            <section className="landing-section" id="features">
                <div className="section-header">
                    <div className="section-label">{t('landing.features.label')}</div>
                    <h2 className="section-title">{t('landing.features.title')}</h2>
                    <p className="section-subtitle">
                        {t('landing.features.subtitle')}
                    </p>
                </div>
                <div className="features-grid">
                    {features.map(f => (
                        <div key={f.key} className="feature-item">
                            <div className="feature-icon">
                                <span className="material-symbols-rounded">{f.icon}</span>
                            </div>
                            <div className="feature-title">{t(`landing.features.${f.key}Title`)}</div>
                            <p className="feature-desc">{t(`landing.features.${f.key}Desc`)}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Boarding ── */}
            <section className="landing-section alt" id="boarding">
                <div className="boarding-split">
                    <div className="boarding-visual">
                        <div className="boarding-visual-badge">
                            <span className="material-symbols-rounded">night_shelter</span>
                            {t('landing.boarding.badge')}
                        </div>
                        <p className="boarding-visual-desc">
                            {t('landing.boarding.visualDesc')}
                        </p>
                        <div className="boarding-pill-row">
                            {boardingHouses.map(h => (
                                <span key={h.name} className="boarding-pill">
                                    {t('landing.boarding.pill', { name: h.name, group: t(h.groupKey) })}
                                </span>
                            ))}
                        </div>
                        <div className="boarding-visual-glow" />
                    </div>
                    <div>
                        <div className="section-label">{t('landing.boarding.label')}</div>
                        <h2 className="section-title">{t('landing.boarding.title')}</h2>
                        <p className="section-subtitle lp-sub-mb-175">
                            {t('landing.boarding.subtitle')}
                        </p>
                        <ul className="boarding-list">
                            {boardingPoints.map(point => (
                                <li key={point}>
                                    <div className="boarding-list-icon">
                                        <span className="material-symbols-rounded">check</span>
                                    </div>
                                    {t(`landing.boarding.${point}`)}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </section>

            {/* ── Contact ── */}
            <section className="landing-section" id="contact">
                <div className="contact-split">
                    <div>
                        <div className="section-label">{t('landing.contact.label')}</div>
                        <h2 className="section-title">{t('landing.contact.title')}</h2>
                        <p className="section-subtitle lp-sub-mb-2">
                            {t('landing.contact.subtitle')}
                        </p>
                        <div className="contact-items">
                            {contactItems.map(c => (
                                <div key={c.labelKey} className="contact-item">
                                    <div className="contact-item-icon">
                                        <span className="material-symbols-rounded">{c.icon}</span>
                                    </div>
                                    <div>
                                        <div className="contact-item-label">{t(c.labelKey)}</div>
                                        <div className="contact-item-value">{c.valueKey ? t(c.valueKey) : c.value}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="contact-form-card">
                        <div className="contact-form-title">{t('landing.contact.formTitle')}</div>
                        <div className="contact-form-group">
                            <label className="contact-form-label">{t('landing.contact.yourName')}</label>
                            <input type="text" className="contact-form-input" placeholder={t('landing.contact.namePlaceholder')} />
                        </div>
                        <div className="contact-form-group">
                            <label className="contact-form-label">{t('common.emailAddress')}</label>
                            <input type="email" className="contact-form-input" placeholder="your@email.com" />
                        </div>
                        <div className="contact-form-group">
                            <label className="contact-form-label">{t('common.role')}</label>
                            <select className="contact-form-input">
                                <option value="">{t('landing.contact.selectRole')}</option>
                                <option>{t('common.student')}</option>
                                <option>{t('landing.contact.roleGuardian')}</option>
                                <option>{t('common.teacher')}</option>
                                <option>{t('roles.staff')}</option>
                                <option>{t('landing.contact.roleOther')}</option>
                            </select>
                        </div>
                        <div className="contact-form-group">
                            <label className="contact-form-label">{t('landing.contact.message')}</label>
                            <textarea className="contact-form-input" rows={4} placeholder={t('landing.contact.messagePlaceholder')}></textarea>
                        </div>
                        <button className="contact-form-btn">
                            <span className="material-symbols-rounded">send</span>
                            {t('landing.contact.send')}
                        </button>
                    </div>
                </div>
            </section>

            {/* ── CTA strip ── */}
            <section className="landing-cta-strip">
                <div className="cta-strip-inner">
                    <div className="cta-strip-orb" />
                    <div className="cta-strip-orb cta-strip-orb-2" />
                    <div className="section-label cta-strip-label">{t('landing.cta.label')}</div>
                    <h2 className="cta-strip-title">{t('landing.cta.title')}</h2>
                    <p className="cta-strip-subtitle">
                        {t('landing.cta.subtitle')}
                    </p>
                    <Link to="/login" className="cta-strip-btn">
                        {t('landing.cta.button')}
                        <span className="material-symbols-rounded">arrow_forward</span>
                    </Link>
                </div>
            </section>

            {/* ── Footer ── */}
            <footer className="landing-footer">
                <div className="footer-inner">
                    <div className="footer-brand-col">
                        <div className="footer-brand">
                            <div className="landing-nav-logo">
                                <img src={logo} alt="Imboni Logo" />
                            </div>
                            <span className="footer-brand-name">Imboni <span>{t('publicNav.education')}</span></span>
                        </div>
                        <p className="footer-brand-desc">
                            {t('landing.footer.brandDesc')}
                        </p>
                        <div className="footer-contact">
                            <div className="footer-contact-item">
                                <span className="material-symbols-rounded">location_on</span>
                                {t('landing.contact.addressValue')}
                            </div>
                            <div className="footer-contact-item">
                                <span className="material-symbols-rounded">mail</span>
                                info@imboni.edu.rw
                            </div>
                            <div className="footer-contact-item">
                                <span className="material-symbols-rounded">phone</span>
                                +250 788 000 000
                            </div>
                        </div>
                    </div>

                    <div className="footer-col">
                        <div className="footer-col-title">{t('publicNav.portals')}</div>
                        <ul className="footer-col-list">
                            <li><a href="#portals">{t('portal.student')}</a></li>
                            <li><a href="#portals">{t('portal.teacher')}</a></li>
                            <li><a href="#portals">{t('portal.parent')}</a></li>
                            <li><a href="#portals">{t('portal.dos')}</a></li>
                            <li><a href="#portals">{t('portal.discipline')}</a></li>
                            <li><a href="#portals">{t('portal.matron')}</a></li>
                        </ul>
                    </div>

                    <div className="footer-col">
                        <div className="footer-col-title">{t('landing.footer.platform')}</div>
                        <ul className="footer-col-list">
                            <li><a href="#features">{t('landing.footer.realtimeUpdates')}</a></li>
                            <li><a href="#features">{t('landing.features.analyticsTitle')}</a></li>
                            <li><a href="#features">{t('landing.chip.announcements')}</a></li>
                            <li><a href="#features">{t('landing.footer.messaging')}</a></li>
                            <li><a href="#boarding">{t('landing.boarding.badge')}</a></li>
                            <li><a href="#features">{t('landing.footer.mobileAccess')}</a></li>
                        </ul>
                    </div>

                    <div className="footer-col">
                        <div className="footer-col-title">{t('landing.footer.school')}</div>
                        <ul className="footer-col-list">
                            <li><Link to="/about">{t('publicNav.aboutImboni')}</Link></li>
                            <li><Link to="/pricing">{t('publicNav.pricing')}</Link></li>
                            <li><Link to="/contact">{t('publicNav.contactUs')}</Link></li>
                            <li><Link to="/privacy">{t('auth.privacyPolicy')}</Link></li>
                            <li><Link to="/terms">{t('publicNav.termsOfUse')}</Link></li>
                            <li><Link to="/login">{t('publicNav.signIn')}</Link></li>
                            <li><Link to="/find-school">{t('publicNav.findSchool')}</Link></li>
                        </ul>
                    </div>
                </div>

                <div className="footer-bottom">
                    <span>{t('landing.footer.copyright', { year: new Date().getFullYear() })}</span>
                    {/* Cookies dropped: there is no cookie policy to link to, and a
                        dead link in the footer of a product handling children's data
                        reads worse than an absent one. */}
                    <div className="footer-bottom-links">
                        <Link to="/privacy">{t('publicNav.privacy')}</Link>
                        <Link to="/terms">{t('publicNav.terms')}</Link>
                    </div>
                </div>
            </footer>

        </div>
    )
}
