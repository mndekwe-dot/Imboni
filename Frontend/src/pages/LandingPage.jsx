import '../styles/landing.css'
import { Link } from 'react-router'
import logo from '../assets/images/imboni-logo.png'

const portals = [
    {
        title: 'Student Portal',
        desc: 'Access your timetable, results, assignments, attendance record, and school announcements — all in one place.',
        icon: 'school',
        color: '#0d9488',
        bg: 'rgba(13,148,136,0.1)',
        border: 'rgba(13,148,136,0.25)',
        gradient: 'linear-gradient(135deg, #0d9488, #0891b2)',
        features: ['Timetable', 'Results', 'Assignments', 'Attendance'],
    },
    {
        title: 'Teacher Portal',
        desc: 'Manage classes, record results, track attendance, and communicate with students effortlessly.',
        icon: 'person_book',
        color: '#0891b2',
        bg: 'rgba(8,145,178,0.09)',
        border: 'rgba(8,145,178,0.22)',
        gradient: 'linear-gradient(135deg, #0891b2, #0369a1)',
        features: ['Classes', 'Results', 'Attendance', 'Assignments'],
    },
    {
        title: 'Parent Portal',
        desc: "Stay informed about your child's academic progress, attendance, behaviour, and school communications.",
        icon: 'family_restroom',
        color: '#7c3aed',
        bg: 'rgba(124,58,237,0.09)',
        border: 'rgba(124,58,237,0.22)',
        gradient: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
        features: ['Academic Results', 'Attendance', 'Behaviour', 'Messages'],
    },
    {
        title: 'Director of Studies',
        desc: 'Full academic oversight — manage timetables, exam schedules, analytics, and school-wide announcements.',
        icon: 'manage_accounts',
        color: '#003d7a',
        bg: 'rgba(0,61,122,0.09)',
        border: 'rgba(0,61,122,0.22)',
        gradient: 'linear-gradient(135deg, #003d7a, #005a8f)',
        features: ['Analytics', 'Timetables', 'Exams', 'Announcements'],
    },
    {
        title: 'Discipline Portal',
        desc: 'Track student conduct, manage boarding activities, dining schedules, and staff coordination.',
        icon: 'security',
        color: '#4f46e5',
        bg: 'rgba(79,70,229,0.09)',
        border: 'rgba(79,70,229,0.22)',
        gradient: 'linear-gradient(135deg, #4f46e5, #4338ca)',
        features: ['Conduct Reports', 'Activities', 'Dining', 'Boarding'],
    },
    {
        title: 'Matron Portal',
        desc: 'Monitor student health, manage dormitory welfare, record incidents, and liaise with parents.',
        icon: 'health_and_safety',
        color: '#8b5cf6',
        bg: 'rgba(139,92,246,0.09)',
        border: 'rgba(139,92,246,0.22)',
        gradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
        features: ['Health Records', 'Incidents', 'Students', 'Parent Comms'],
    },
]

const features = [
    { icon: 'sync', title: 'Real-Time Information', desc: 'Results, attendance, and announcements update instantly across all portals.' },
    { icon: 'lock', title: 'Secure Role-Based Access', desc: 'Every user sees only what they need. School-issued credentials keep data private.' },
    { icon: 'forum', title: 'Integrated Messaging', desc: 'Direct messaging between teachers, parents, and boarding staff — no outside apps needed.' },
    { icon: 'bar_chart', title: 'Academic Analytics', desc: 'A live picture of performance trends, attendance rates, and exam outcomes.' },
    { icon: 'phone_iphone', title: 'Mobile-Friendly', desc: 'Full experience on any device — phone, tablet, or desktop. No app install needed.' },
    { icon: 'notifications', title: 'Smart Announcements', desc: 'Important notices reach students, teachers, and parents simultaneously.' },
]

const aboutPoints = [
    { icon: 'emoji_objects', title: 'Our Mission', desc: 'To simplify school life by connecting every stakeholder — students, teachers, parents, and boarding staff — on one clear and reliable platform.' },
    { icon: 'groups', title: 'Who We Serve', desc: 'Imboni is built for boarding schools that want to bring clarity, transparency, and efficiency to every part of school operations.' },
    { icon: 'verified', title: 'Our Commitment', desc: 'We are committed to data privacy, secure access, and building tools that actually match how schools work every day.' },
]

const boardingPoints = [
    'Dormitory welfare monitoring and daily check-ins',
    'Health record management and sick bay tracking',
    'Incident reports with parent notification workflow',
    'House-based student tracking across all boarding houses',
    'Direct communication channel between Matron and parents',
    'Structured weekly schedule for all boarding students',
]

const boardingPills = ['Karisimbi (Girls)', 'Muhabura (Boys)', 'Bisoke (Girls)', 'Sabyinyo (Boys)']

const mockNotifs = [
    { icon: 'priority_high', color: '#ef4444', text: 'Physics Exam moved to Mar 14', time: '2m ago' },
    { icon: 'school', color: '#0d9488', text: 'Term 2 results now published', time: '1h ago' },
    { icon: 'event', color: '#f97316', text: 'Parent-Teacher Conf — Mar 20', time: '3h ago' },
]

const contactItems = [
    { icon: 'location_on', label: 'Address', value: 'Musanze, Northern Province, Rwanda' },
    { icon: 'mail', label: 'Email', value: 'ndekwe22@gmail.com' },
    { icon: 'phone', label: 'Phone', value: '+250 798 650 0692' },
    { icon: 'schedule', label: 'Hours', value: 'Mon – Fri, 7:30 AM – 5:00 PM' },
]

export function LandingPage() {
    return (
        <div className="landing-page">

            {/* ── Navbar ── */}
            <nav className="landing-nav">
                <div className="landing-nav-brand">
                    <div className="landing-nav-logo">
                        <img src={logo} alt="Imboni Logo" />
                    </div>
                    <span className="landing-nav-name">Imboni <span>Education</span></span>
                </div>
                <div className="landing-nav-right">
                    <div className="landing-nav-links">
                        <a href="#about">About</a>
                        <a href="#portals">Portals</a>
                        <a href="#features">Features</a>
                        <a href="#contact">Contact</a>
                    </div>
                    <Link to="/login" className="landing-nav-signin">
                        <span className="material-symbols-rounded">login</span>
                        Sign In
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
                            Boarding School Management Platform
                        </div>

                        <h1 className="hero-title">
                            Every part of<br />
                            school life,<br />
                            <span className="accent">connected.</span>
                        </h1>

                        <p className="hero-subtitle">
                            Imboni brings students, teachers, parents, and boarding staff together
                            on one unified platform — keeping communication clear and school life running smoothly.
                        </p>

                        <div className="hero-actions">
                            <Link to="/login" className="hero-cta">
                                Access Your Portal
                                <span className="material-symbols-rounded">arrow_forward</span>
                            </Link>
                            <a href="#about" className="hero-secondary">
                                Learn more
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
                                        <div className="mockup-role">Student · S4A</div>
                                    </div>
                                </div>
                                <div className="mockup-stat-row">
                                    <div className="mockup-stat-card" style={{ '--mc': '#0d9488' }}>
                                        <span className="material-symbols-rounded">menu_book</span>
                                        <div className="msc-val">8</div>
                                        <div className="msc-lbl">Subjects</div>
                                    </div>
                                    <div className="mockup-stat-card" style={{ '--mc': '#f97316' }}>
                                        <span className="material-symbols-rounded">assignment</span>
                                        <div className="msc-val">3</div>
                                        <div className="msc-lbl">Due Soon</div>
                                    </div>
                                    <div className="mockup-stat-card" style={{ '--mc': '#4f46e5' }}>
                                        <span className="material-symbols-rounded">check_circle</span>
                                        <div className="msc-val">94%</div>
                                        <div className="msc-lbl">Attendance</div>
                                    </div>
                                </div>
                                <div className="mockup-notif-label">Recent Notifications</div>
                                <div className="mockup-notifs">
                                    {mockNotifs.map((n, i) => (
                                        <div key={i} className="mockup-notif">
                                            <div className="mockup-notif-icon" style={{ background: `${n.color}20`, color: n.color }}>
                                                <span className="material-symbols-rounded">{n.icon}</span>
                                            </div>
                                            <div className="mockup-notif-text">{n.text}</div>
                                            <div className="mockup-notif-time">{n.time}</div>
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
                    <div className="section-label">About Imboni</div>
                    <h2 className="section-title">Built around your school community</h2>
                    <p className="section-subtitle">
                        Imboni was designed from the ground up for boarding schools —
                        where students, teachers, parents, and residential staff all need
                        to stay connected and informed every single day.
                    </p>
                </div>
                <div className="about-grid">
                    {aboutPoints.map(p => (
                        <div key={p.title} className="about-card">
                            <div className="about-card-icon">
                                <span className="material-symbols-rounded">{p.icon}</span>
                            </div>
                            <div className="about-card-title">{p.title}</div>
                            <p className="about-card-desc">{p.desc}</p>
                        </div>
                    ))}
                </div>

                {/* About photo strip */}
                <div className="about-photo-strip">
                    <div className="about-photo-overlay" />
                    <div className="about-photo-content">
                        <blockquote className="about-quote">
                            "A school runs on communication. Imboni makes sure that communication
                            is clear, timely, and reaches the right people — every time."
                        </blockquote>
                        <div className="about-quote-source">School Administration Team</div>
                    </div>
                </div>
            </section>

            {/* ── Portals ── */}
            <section className="landing-section alt" id="portals">
                <div className="section-header">
                    <div className="section-label">Six Portals</div>
                    <h2 className="section-title">A dedicated view for every role</h2>
                    <p className="section-subtitle">
                        From classroom results to dormitory welfare, each stakeholder gets
                        a purpose-built portal tailored to their daily responsibilities.
                    </p>
                </div>
                <div className="portals-grid">
                    {portals.map(p => (
                        <div
                            key={p.title}
                            className="portal-card"
                            style={{ '--card-color': p.color, '--card-bg': p.bg, '--card-border': p.border, '--card-gradient': p.gradient }}
                        >
                            <div className="portal-card-top-bar" />
                            <div className="portal-card-icon">
                                <span className="material-symbols-rounded">{p.icon}</span>
                            </div>
                            <div>
                                <div className="portal-card-title">{p.title}</div>
                                <p className="portal-card-desc">{p.desc}</p>
                            </div>
                            <div className="portal-card-features">
                                {p.features.map(f => (
                                    <span key={f} className="portal-card-feature">{f}</span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Features ── */}
            <section className="landing-section" id="features">
                <div className="section-header">
                    <div className="section-label">Platform Features</div>
                    <h2 className="section-title">Built for how schools actually work</h2>
                    <p className="section-subtitle">
                        Imboni handles the communication and record-keeping so staff can focus on students.
                    </p>
                </div>
                <div className="features-grid">
                    {features.map(f => (
                        <div key={f.title} className="feature-item">
                            <div className="feature-icon">
                                <span className="material-symbols-rounded">{f.icon}</span>
                            </div>
                            <div className="feature-title">{f.title}</div>
                            <p className="feature-desc">{f.desc}</p>
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
                            Boarding Management
                        </div>
                        <p className="boarding-visual-desc">
                            The Matron and Discipline portals give boarding staff complete oversight
                            of residential life — from health records to house activities.
                        </p>
                        <div className="boarding-pill-row">
                            {boardingPills.map(h => (
                                <span key={h} className="boarding-pill">{h}</span>
                            ))}
                        </div>
                        <div className="boarding-visual-glow" />
                    </div>
                    <div>
                        <div className="section-label">Residential Life</div>
                        <h2 className="section-title">Complete boarding school oversight</h2>
                        <p className="section-subtitle" style={{ marginBottom: '1.75rem' }}>
                            Every boarding house, every student, every incident — tracked and
                            communicated clearly between staff and parents.
                        </p>
                        <ul className="boarding-list">
                            {boardingPoints.map(point => (
                                <li key={point}>
                                    <div className="boarding-list-icon">
                                        <span className="material-symbols-rounded">check</span>
                                    </div>
                                    {point}
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
                        <div className="section-label">Get In Touch</div>
                        <h2 className="section-title">We're here to help</h2>
                        <p className="section-subtitle" style={{ marginBottom: '2rem' }}>
                            Have a question about accessing your portal, or need support with your
                            school-issued credentials? Reach out to the school office and we'll assist you.
                        </p>
                        <div className="contact-items">
                            {contactItems.map(c => (
                                <div key={c.label} className="contact-item">
                                    <div className="contact-item-icon">
                                        <span className="material-symbols-rounded">{c.icon}</span>
                                    </div>
                                    <div>
                                        <div className="contact-item-label">{c.label}</div>
                                        <div className="contact-item-value">{c.value}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="contact-form-card">
                        <div className="contact-form-title">Send a Message</div>
                        <div className="contact-form-group">
                            <label className="contact-form-label">Your Name</label>
                            <input type="text" className="contact-form-input" placeholder="e.g. Uwase Amina" />
                        </div>
                        <div className="contact-form-group">
                            <label className="contact-form-label">Email Address</label>
                            <input type="email" className="contact-form-input" placeholder="your@email.com" />
                        </div>
                        <div className="contact-form-group">
                            <label className="contact-form-label">Role</label>
                            <select className="contact-form-input">
                                <option value="">Select your role...</option>
                                <option>Student</option>
                                <option>Parent / Guardian</option>
                                <option>Teacher</option>
                                <option>Staff</option>
                                <option>Other</option>
                            </select>
                        </div>
                        <div className="contact-form-group">
                            <label className="contact-form-label">Message</label>
                            <textarea className="contact-form-input" rows={4} placeholder="How can we help you?"></textarea>
                        </div>
                        <button className="contact-form-btn">
                            <span className="material-symbols-rounded">send</span>
                            Send Message
                        </button>
                    </div>
                </div>
            </section>

            {/* ── CTA strip ── */}
            <section className="landing-cta-strip">
                <div className="cta-strip-inner">
                    <div className="cta-strip-orb" />
                    <div className="cta-strip-orb cta-strip-orb-2" />
                    <div className="section-label" style={{ color: '#fb923c', marginBottom: '1rem' }}>Get Started</div>
                    <h2 className="cta-strip-title">Ready to sign in?</h2>
                    <p className="cta-strip-subtitle">
                        Use your school-issued credentials to access your portal.
                        Contact the school office if you need help.
                    </p>
                    <Link to="/login" className="cta-strip-btn">
                        Sign In to Your Portal
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
                            <span className="footer-brand-name">Imboni <span>Education</span></span>
                        </div>
                        <p className="footer-brand-desc">
                            A unified school management platform connecting students, teachers,
                            parents, and boarding staff under one roof.
                        </p>
                        <div className="footer-contact">
                            <div className="footer-contact-item">
                                <span className="material-symbols-rounded">location_on</span>
                                Musanze, Northern Province, Rwanda
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
                        <div className="footer-col-title">Portals</div>
                        <ul className="footer-col-list">
                            <li><a href="#portals">Student Portal</a></li>
                            <li><a href="#portals">Teacher Portal</a></li>
                            <li><a href="#portals">Parent Portal</a></li>
                            <li><a href="#portals">Director of Studies</a></li>
                            <li><a href="#portals">Discipline Portal</a></li>
                            <li><a href="#portals">Matron Portal</a></li>
                        </ul>
                    </div>

                    <div className="footer-col">
                        <div className="footer-col-title">Platform</div>
                        <ul className="footer-col-list">
                            <li><a href="#features">Real-Time Updates</a></li>
                            <li><a href="#features">Academic Analytics</a></li>
                            <li><a href="#features">Announcements</a></li>
                            <li><a href="#features">Messaging</a></li>
                            <li><a href="#boarding">Boarding Management</a></li>
                            <li><a href="#features">Mobile Access</a></li>
                        </ul>
                    </div>

                    <div className="footer-col">
                        <div className="footer-col-title">School</div>
                        <ul className="footer-col-list">
                            <li><a href="#about">About Imboni</a></li>
                            <li><a href="#contact">Contact Us</a></li>
                            <li><a href="#">Privacy Policy</a></li>
                            <li><a href="#">Terms of Use</a></li>
                            <li><Link to="/login">Sign In</Link></li>
                        </ul>
                    </div>
                </div>

                <div className="footer-bottom">
                    <span>&copy; {new Date().getFullYear()} Imboni Education Connects. All rights reserved.</span>
                    <div className="footer-bottom-links">
                        <a href="#">Privacy</a>
                        <a href="#">Terms</a>
                        <a href="#">Cookies</a>
                    </div>
                </div>
            </footer>

        </div>
    )
}
