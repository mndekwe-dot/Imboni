"""Matching a bank or mobile-money statement to the families who paid.

A bursar who receives forty deposits in a statement used to look each one up by
hand. This works out, for every line, one of:

    recorded   the reference is already on a receipt: money we have, not to be taken twice
    suggested  exactly one family fits (admission number in the narration, or the
               payer's phone, or the one family owing exactly that amount)
    ambiguous  more than one fits: the bursar chooses
    unmatched  nothing fits: the bursar finds the family or leaves it

It SUGGESTS and never posts: nothing here writes to the books. Pure functions,
so every rule can be tested without a database.
"""
import re
from decimal import Decimal, InvalidOperation

ZERO = Decimal('0')


def normalise_phone(value):
    """Last nine digits: +250 788 123 456, 0788123456 and 788123456 are one number."""
    digits = re.sub(r'\D', '', value or '')
    return digits[-9:] if len(digits) >= 9 else ''


def parse_amount(value):
    """'1,250,000.00' -> Decimal; anything unreadable or non-positive -> None."""
    text = re.sub(r'[^\d.\-]', '', str(value or '').replace(',', ''))
    try:
        amount = Decimal(text)
    except InvalidOperation:
        return None
    return amount if amount > 0 else None


def match_row(row, families, recorded_refs):
    """
    ``row``: {reference, amount, description, phone}.
    ``families``: [{id, student_id (admission no.), name, phone, outstanding}].
    Returns {status, candidates: [family ids], reason}.
    """
    amount = parse_amount(row.get('amount'))
    reference = (row.get('reference') or '').strip()
    if amount is None:
        return {'status': 'unmatched', 'candidates': [], 'reason': 'No amount received on this line.'}
    if reference and reference.lower() in recorded_refs:
        return {'status': 'recorded', 'candidates': [], 'reason': 'This reference is already on a receipt.'}

    text = f"{row.get('description') or ''} {reference}".lower()

    # 1. An admission number written in the narration is the strongest signal.
    by_code = [f for f in families if f['student_id'] and re.search(
        rf"(?<![a-z0-9]){re.escape(f['student_id'].lower())}(?![a-z0-9])", text)]
    if len(by_code) == 1:
        return {'status': 'suggested', 'candidates': [by_code[0]['id']], 'reason': 'Admission number in the narration.'}
    if len(by_code) > 1:
        return {'status': 'ambiguous', 'candidates': [f['id'] for f in by_code], 'reason': 'Several admission numbers in the narration.'}

    # 2. The phone the money came from, when the office has recorded who pays.
    phone = normalise_phone(row.get('phone')) or normalise_phone(text)
    by_phone = [f for f in families if phone and normalise_phone(f['phone']) == phone]
    if len(by_phone) == 1:
        return {'status': 'suggested', 'candidates': [by_phone[0]['id']], 'reason': 'Matches the payer\'s phone.'}
    if len(by_phone) > 1:
        # One parent paying for two children: let the bursar split it.
        return {'status': 'ambiguous', 'candidates': [f['id'] for f in by_phone], 'reason': 'This phone pays for more than one student.'}

    # 3. Only one family owes exactly this much.
    by_amount = [f for f in families if f['outstanding'] == amount]
    if len(by_amount) == 1:
        return {'status': 'suggested', 'candidates': [by_amount[0]['id']], 'reason': 'The only family owing exactly this amount.'}
    if len(by_amount) > 1:
        return {'status': 'ambiguous', 'candidates': [f['id'] for f in by_amount], 'reason': 'Several families owe exactly this amount.'}

    return {'status': 'unmatched', 'candidates': [], 'reason': 'Nothing on the statement line points to a family.'}


def match_statement(rows, families, recorded_refs):
    """Match every line, and mark a reference repeated within the file as already seen."""
    seen = set(recorded_refs)
    out = []
    for index, row in enumerate(rows):
        result = match_row(row, families, seen)
        ref = (row.get('reference') or '').strip().lower()
        if ref and result['status'] != 'recorded':
            seen.add(ref)
        out.append({'row': index, **result})
    return out
