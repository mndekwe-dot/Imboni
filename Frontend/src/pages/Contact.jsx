import { Link } from 'react-router'
import { Trans, useTranslation } from 'react-i18next'
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
    { key: 'email', icon: 'mail', text: 'info@imboni.edu.rw', href: 'mailto:info@imboni.edu.rw', note: 'emailNote' },
    { key: 'phone', icon: 'phone', text: '+250 788 000 000', href: 'tel:+250788000000', note: 'phoneNote' },
    { key: 'office', icon: 'location_on', textKey: 'officeAddress', note: 'officeNote' },
]

export function Contact() {
    const { t } = useTranslation()
    return (
        <PublicLayout title={t('publicPages.contact.title')} subtitle={t('publicPages.contact.subtitle')}>
            <div className="pub-contact-grid">
                {CHANNELS.map(channel => (
                    <div className="pub-contact-card" key={channel.key}>
                        <span className="material-symbols-rounded" aria-hidden="true">
                            {channel.icon}
                        </span>
                        <h3>{t(`publicPages.contact.${channel.key}`)}</h3>
                        <p>
                            {channel.href
                                ? <a href={channel.href}>{channel.text}</a>
                                : t(`publicPages.contact.${channel.textKey}`)}
                        </p>
                        <p>{t(`publicPages.contact.${channel.note}`)}</p>
                    </div>
                ))}
            </div>

            <div className="pub-prose">
                <h2>{t('publicPages.contact.joinTitle')}</h2>
                <p>{t('publicPages.contact.joinIntro')}</p>

                <h3>{t('publicPages.contact.selfTitle')}</h3>
                <p><Trans i18nKey="publicPages.contact.self" components={{ signup: <Link to="/signup" /> }} /></p>

                <h3>{t('publicPages.contact.assistedTitle')}</h3>
                <p><Trans i18nKey="publicPages.contact.assisted" components={{ apply: <Link to="/apply" /> }} /></p>

                <h2>{t('publicPages.contact.existingTitle')}</h2>
                <p>{t('publicPages.contact.existing')}</p>

                <h2>{t('publicPages.contact.dataTitle')}</h2>
                <p><Trans i18nKey="publicPages.contact.data" components={{ privacy: <Link to="/privacy" /> }} /></p>
            </div>
        </PublicLayout>
    )
}
