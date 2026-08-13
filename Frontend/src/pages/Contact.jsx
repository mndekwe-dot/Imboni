import { Link } from 'react-router'
import { PublicLayout } from '../components/PublicLayout'

/**
 * Contact page.
 *
 * Deliberately NOT a generic "send us a message" form. There is no backend
 * endpoint for free-text enquiries, and a form that silently discards what a
 * head teacher types is worse than no form at all.
 *
 * Instead: real contact details that work today, plus a prominent route to
 * /apply, which posts to a real endpoint (SchoolApplyView) that an operator
 * reviews. If a general enquiry inbox is added later, a form belongs here.
 */

const CHANNELS = [
    {
        icon: 'mail',
        title: 'Email',
        lines: [{ text: 'info@imboni.edu.rw', href: 'mailto:info@imboni.edu.rw' }],
        note: 'Best for detailed questions. We reply within one working day.',
    },
    {
        icon: 'phone',
        title: 'Phone',
        lines: [{ text: '+250 788 000 000', href: 'tel:+250788000000' }],
        note: 'Monday to Friday, 08:00 to 17:00 (Kigali time).',
    },
    {
        icon: 'location_on',
        title: 'Office',
        lines: [{ text: 'Musanze, Northern Province, Rwanda' }],
        note: 'Visits by appointment.',
    },
]

export function Contact() {
    return (
        <PublicLayout
            title="Contact us"
            subtitle="Questions about the system, pricing, or getting your school set up? Talk to a person."
        >
            <div className="pub-contact-grid">
                {CHANNELS.map(channel => (
                    <div className="pub-contact-card" key={channel.title}>
                        <span className="material-symbols-rounded" aria-hidden="true">
                            {channel.icon}
                        </span>
                        <h3>{channel.title}</h3>
                        {channel.lines.map(line => (
                            line.href
                                ? <p key={line.text}><a href={line.href}>{line.text}</a></p>
                                : <p key={line.text}>{line.text}</p>
                        ))}
                        <p>{channel.note}</p>
                    </div>
                ))}
            </div>

            <div className="pub-prose">
                <h2>Want your school on Imboni?</h2>
                <p>
                    There are two ways in, depending on how much you want to do yourself.
                </p>

                <h3>Set it up now</h3>
                <p>
                    <Link to="/signup">Sign up your school</Link> and your own subdomain is
                    created automatically, on the Free plan, with an admin account for you.
                    You can import classes and students straight away. No conversation
                    required.
                </p>

                <h3>Have us do it with you</h3>
                <p>
                    <Link to="/apply">Apply to join</Link> and we will review your details,
                    get in touch, and set the school up with your real classes, subjects and
                    staff so you can see your own school rather than a demo.
                </p>

                <h2>Already using Imboni?</h2>
                <p>
                    Support requests are raised inside the system rather than here, so they
                    arrive attached to your school and the staff member reporting them.
                    Sign in and use the support option in your portal. If you cannot sign
                    in at all, email us and say which school you are from.
                </p>

                <h2>Data protection enquiries</h2>
                <p>
                    Requests about student records, access, correction or erasure are handled
                    under our <Link to="/privacy">privacy policy</Link>. Email us with
                    &quot;data request&quot; in the subject line and we will respond within
                    the period set out there.
                </p>
            </div>
        </PublicLayout>
    )
}
