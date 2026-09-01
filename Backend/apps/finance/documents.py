"""
What the finance office prints.

A school runs on paper it can hand over, file, and sign: a parent wants a
receipt in their hand, a head wants a debtor list to take into a meeting, a
member of staff wants a payslip they can show a bank. Every one of these is a
PDF built from the same letterhead, so they are recognisably from one office.

Layout lives in `templates/documents/`; this module only decides what goes on
each page. The CSV side is inline in the views, because a spreadsheet export is
a queryset and a header row, not a document.
"""
from decimal import Decimal

from django.utils import timezone

from apps.common.documents import document_context, pdf_response

from . import services

ZERO = Decimal('0.00')


def _term_label(term):
    return f'Term {term.term} {term.year}' if term is not None else 'All terms'


# ── Money in ──────────────────────────────────────────────────────────────────

def receipt_pdf(payment):
    """
    One receipt, for the parent standing at the desk.

    Opens in the browser rather than downloading (`inline`): the parent is
    waiting, and a file that lands in a downloads folder is one more click
    before it reaches a printer.
    """
    fee = payment.fee
    student = fee.student if fee else None
    balance = services.balance_of(fee) if fee else ZERO
    context = document_context(
        f'Receipt {payment.receipt_no}',
        subtitle=student.full_name if student else '',
        payment=payment,
        fee=fee,
        student=student,
        class_label=f'{student.grade}{student.section}' if student else '',
        charged=fee.amount if fee else ZERO,
        paid_so_far=services.paid_total(fee) if fee else ZERO,
        balance=balance,
        settled=balance <= ZERO,
    )
    return pdf_response('documents/finance_receipt.html', context,
                        f'receipt-{payment.receipt_no}', inline=True)


def statement_pdf(student, term, balance):
    """
    Everything one family has been charged and has paid, on one page.

    The document a parent actually argues with, so it shows each charge with
    its payments underneath rather than a single net figure they cannot check.
    """
    lines = []
    for fee in balance['fees']:
        lines.append({
            'fee': fee,
            'paid': services.paid_total(fee),
            'balance': services.balance_of(fee),
            'payments': list(fee.payments.filter(reversed_at__isnull=True)
                             .order_by('paid_on')),
        })
    context = document_context(
        'Fee statement',
        subtitle=f'{student.full_name} · {student.grade}{student.section} · {_term_label(term)}',
        student=student, term=term, lines=lines,
        charged=balance['charged'], paid=balance['paid'],
        outstanding=balance['outstanding'], overdue=balance['overdue'],
        arrears=services.arrears_for(student, before_term=term),
        account=getattr(student, 'finance_account', None),
    )
    return pdf_response('documents/finance_statement.html', context,
                        f'statement-{student.student_id or student.id}')


def payments_pdf(request, payments):
    """The receipt book for a day or a week — what a cash-up is checked against."""
    rows = list(payments)
    total = sum((p.amount for p in rows if not p.is_reversed), ZERO)
    date_from = request.query_params.get('from') or ''
    date_to = request.query_params.get('to') or ''
    span = f'{date_from} to {date_to}'.strip(' to ') or 'All dates'
    context = document_context('Receipts', subtitle=span,
                               payments=rows, total=total, count=len(rows))
    return pdf_response('documents/finance_payments.html', context, 'receipts')


# ── Money owed ────────────────────────────────────────────────────────────────

def debtors_pdf(request, rows, term):
    """Who owes what, worst first. The list that goes into a staff meeting."""
    from .views import class_label_of

    total = sum((r['outstanding'] for r in rows), ZERO)
    overdue = sum((r['overdue'] for r in rows), ZERO)
    context = document_context(
        'Who owes',
        subtitle=f'{class_label_of(request)} · {_term_label(term)}',
        rows=rows, total=total, overdue=overdue, count=len(rows))
    return pdf_response('documents/finance_debtors.html', context,
                        f'who-owes-{class_label_of(request)}')


def charges_pdf(request, fees, term):
    """Every charge raised, with what has been paid against it."""
    from .views import class_label_of

    rows = [{'fee': fee,
             'paid': services.paid_total(fee),
             'balance': services.balance_of(fee)}
            for fee in fees]
    context = document_context(
        'Charges',
        subtitle=f'{class_label_of(request)} · {_term_label(term)}',
        rows=rows,
        charged=sum((r['fee'].amount for r in rows), ZERO),
        paid=sum((r['paid'] for r in rows), ZERO),
        outstanding=sum((r['balance'] for r in rows), ZERO))
    return pdf_response('documents/finance_charges.html', context,
                        f'charges-{class_label_of(request)}')


def reminders_pdf(rows, term):
    """
    One page per family, each a letter they can be handed.

    Deliberately one page each rather than a list: a reminder is given to a
    particular parent, and handing over a sheet with forty other families'
    debts on it tells every one of them what the others owe.
    """
    context = document_context(
        'Fee reminders', subtitle=_term_label(term),
        rows=rows, term=term, today=timezone.localdate())
    return pdf_response('documents/finance_reminders.html', context, 'fee-reminders')


# ── Money out ─────────────────────────────────────────────────────────────────

def expenses_pdf(rows, term, totals):
    context = document_context('Expenses', subtitle=_term_label(term),
                               rows=rows, totals=totals)
    return pdf_response('documents/finance_expenses.html', context, 'expenses')


def payroll_register_pdf(run, payslips, totals):
    """
    The whole month on one sheet: who is paid what, and what it costs.

    This is the page the head signs before any money moves, so it carries a
    signature block rather than ending at the totals row.
    """
    context = document_context(
        'Payroll register', subtitle=run.period_label,
        run=run, payslips=payslips, totals=totals, count=len(payslips))
    return pdf_response('documents/finance_payroll.html', context,
                        f'payroll-{run.period_year}-{run.period_month:02d}')


def payslip_pdf(payslip):
    """One person's payslip. Their document, not the school's."""
    context = document_context(
        'Payslip', subtitle=f'{payslip.staff_name} · {payslip.run.period_label}',
        payslip=payslip, run=payslip.run)
    return pdf_response('documents/finance_payslip.html', context,
                        f'payslip-{payslip.staff_name}-{payslip.run.period_month:02d}',
                        inline=True)


# ── Control ───────────────────────────────────────────────────────────────────

def budget_pdf(report):
    context = document_context(
        'Budget against actual',
        subtitle=f"{report['budget'].name} · {_term_label(report['budget'].term)}",
        **report)
    return pdf_response('documents/finance_budget.html', context, 'budget')


def cash_position_pdf(position, movements=None):
    context = document_context(
        'Cash position', subtitle=f'As at {timezone.localdate():%d %B %Y}',
        accounts=position['accounts'], total=position['total'],
        movements=movements or [])
    return pdf_response('documents/finance_cash.html', context, 'cash-position')
