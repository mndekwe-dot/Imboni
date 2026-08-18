import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { PublicLayout } from '../components/PublicLayout'

/**
 * Terms of service.
 *
 * Written to describe how the service actually behaves (plan limits that block
 * rather than delete, suspension that still allows login and payment, schema
 * isolation, nightly backups) rather than as boilerplate. Anything asserted
 * here should be true of the running system.
 *
 * This is not a lawyer-drafted contract. It needs review before a school signs
 * anything against it -- flagged in the closing note rather than hidden. The
 * Kinyarwanda is a translation; the English governs, and readers are told so
 * at the foot of the page whenever they are not reading the English.
 */
export function Terms() {
    const { t, i18n } = useTranslation()

    return (
        <PublicLayout
            title={t('terms.title')}
            subtitle={t('terms.subtitle')}
        >
            <div className="pub-prose">
                <p className="pub-updated">{t('terms.summary')}</p>

                <h2>{t('terms.partiesTitle')}</h2>
                <p>{t('terms.partiesBody')}</p>

                <h2>{t('terms.accountsTitle')}</h2>
                <p>{t('terms.accountsBody')}</p>

                <h2>{t('terms.useTitle')}</h2>
                <p>{t('terms.useIntro')}</p>
                <ul>
                    <li>{t('terms.useUnlawful')}</li>
                    <li>{t('terms.useProbe')}</li>
                    <li>{t('terms.useMalware')}</li>
                    <li>{t('terms.useResell')}</li>
                </ul>

                <h2>{t('terms.dataTitle')}</h2>
                <p>
                    {t('terms.dataBody')}{' '}
                    <Link to="/privacy">{t('terms.dataLink')}</Link>.
                </p>

                <h2>{t('terms.plansTitle')}</h2>
                <p>
                    {t('terms.plansBodyStart')}{' '}
                    <Link to="/pricing">{t('terms.plansLink')}</Link>.{' '}
                    {t('terms.plansBodyEnd')}
                </p>

                <h2>{t('terms.paymentTitle')}</h2>
                <p>{t('terms.paymentBody')}</p>

                <h2>{t('terms.availabilityTitle')}</h2>
                <p>{t('terms.availabilityBody')}</p>

                <h2>{t('terms.backupsTitle')}</h2>
                <p>{t('terms.backupsBody')}</p>

                <h2>{t('terms.endingTitle')}</h2>
                <p>{t('terms.endingBody')}</p>

                <h2>{t('terms.liabilityTitle')}</h2>
                <p>{t('terms.liabilityBody')}</p>

                <h2>{t('terms.changesTitle')}</h2>
                <p>{t('terms.changesBody')}</p>

                <h2>{t('terms.lawTitle')}</h2>
                <p>{t('terms.lawBody')}</p>

                <h2>{t('terms.contactTitle')}</h2>
                <p>
                    {t('terms.contactBody')}{' '}
                    <Link to="/contact">{t('terms.contactLink')}</Link>.
                </p>

                <p className="pub-updated">{t('terms.closing')}</p>

                {i18n.language !== 'en' && (
                    <p className="pub-updated">{t('privacy.translationNotice')}</p>
                )}
            </div>
        </PublicLayout>
    )
}
