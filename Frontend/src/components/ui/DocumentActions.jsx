import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { exportCsv, printPdf } from '../../api/documents'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import '../../styles/components.css'

/**
 * Print and Export, for a list the server can render.
 *
 * Both actions send the SAME filters the page is showing, to the same endpoint
 * the page already reads. Two consequences worth having:
 *
 *   * what you print is what you are looking at. A debtor list filtered to S4A
 *     prints S4A, without the page having to describe its own filters twice;
 *   * the export is the whole filtered set, not the page's display cap. The
 *     old client-side CSV could only write the rows already loaded, so
 *     exporting a 900-row list silently produced the first 300 -- a truncated
 *     list a bursar believes is complete is worse than no list at all.
 *
 * Pass `pdf={false}` where a printed version makes no sense (a settings page),
 * or `csv={false}` where the document is the point (spine labels).
 */
export function DocumentActions({
    url, params = {}, stem = 'export', csv = true, pdf = true,
    disabled = false, className = '',
}) {
    const { t } = useTranslation()
    const toast = useToast()
    const [busy, setBusy] = useState(null)

    async function run(kind, action) {
        setBusy(kind)
        try {
            await action()
        } catch (error) {
            // Never fail silently: the person pressed a button and is now
            // watching for paper that is not coming.
            toast.error(errorMessage(error, t('common.documentFailed')))
        } finally {
            setBusy(null)
        }
    }

    return (
        <div className={`doc-actions${className ? ` ${className}` : ''}`}>
            {pdf && (
                <button
                    type="button"
                    className="btn-secondary btn-sm"
                    disabled={disabled || busy !== null}
                    onClick={() => run('pdf', () => printPdf(url, params))}
                >
                    <span className="material-symbols-rounded" aria-hidden="true">print</span>
                    {busy === 'pdf' ? t('common.preparing') : t('common.print')}
                </button>
            )}
            {csv && (
                <button
                    type="button"
                    className="btn-secondary btn-sm"
                    disabled={disabled || busy !== null}
                    onClick={() => run('csv', () => exportCsv(url, params, stem))}
                >
                    <span className="material-symbols-rounded" aria-hidden="true">download</span>
                    {busy === 'csv' ? t('common.preparing') : t('common.export')}
                </button>
            )}
        </div>
    )
}
