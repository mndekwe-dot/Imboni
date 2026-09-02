"""
Barcodes: the ones printed on the back of a book, and the ones the school
prints itself.

The distinction runs through everything here, and getting it wrong is the
single most common way a school library system becomes useless:

  * The barcode on the back of a published book is its **ISBN**. It identifies
    the EDITION. Five copies of the same textbook carry the same ISBN, five
    identical barcodes, on five different physical books.

  * A loan is of a COPY. "Who has it" and "when is it due" are facts about one
    physical object, so the thing scanned at the desk has to identify that
    object -- which is why every library in the world sticks its own label on
    every book.

So the back-cover barcode is for CATALOGUING (what is this title, do we already
have it, add three more copies), and the school's own label is for CIRCULATION
(issue this one, take this one back, count this one). Scanning an ISBN at the
returns desk cannot tell you which of five copies came back, and a system that
pretends otherwise silently marks the wrong one returned.

`resolve()` below therefore never guesses. It says what a scanned string IS and
lets the caller decide, and when an ISBN matches several copies it hands back
all of them rather than picking.

No new dependencies: reportlab (already here, under xhtml2pdf) draws Code 128,
and `qrcode` is already pinned in requirements.
"""
import base64
import io
import re

from reportlab.graphics import renderPM
from reportlab.graphics.barcode import createBarcodeDrawing


# ── Reading a scanned string ─────────────────────────────────────────────────

def normalise(raw):
    """
    What the scanner typed, cleaned up -- whitespace and case only.

    A USB scanner behaves as a keyboard: it types the characters and presses
    Enter, so a trailing carriage return is normal. Upper-cased because copy
    codes are generated upper-case and a scanner set otherwise would miss every
    one of them.

    Hyphens are deliberately KEPT. It is tempting to strip them here because an
    ISBN is printed with them -- but a copy code has one by design ('THI-0001'),
    and stripping it globally means the school's own labels stop matching their
    own database. Hyphens come out in `_digits()` below, where the question
    actually is "is this an ISBN".
    """
    return re.sub(r'\s+', '', str(raw or '')).upper()


def _digits(code):
    """An ISBN with its printed hyphens removed. Only ISBNs go through here."""
    return re.sub(r'[\-‐-―]', '', code)


def _isbn10_check(digits):
    total = sum((10 - i) * (10 if c == 'X' else int(c)) for i, c in enumerate(digits))
    return total % 11 == 0


def _isbn13_check(digits):
    total = sum(int(c) * (3 if i % 2 else 1) for i, c in enumerate(digits))
    return total % 10 == 0


def is_isbn(code):
    """
    True only if the check digit agrees.

    Validated rather than pattern-matched because a bad scan is common -- a
    creased barcode, a scanner reading half of one label and half of the next --
    and a 13-digit string that fails its check digit is not an ISBN that we do
    not stock, it is a misread. Treating it as a new title is how a catalogue
    fills up with books that do not exist.
    """
    code = _digits(normalise(code))
    if len(code) == 10 and re.fullmatch(r'\d{9}[\dX]', code):
        return _isbn10_check(code)
    if len(code) == 13 and code.isdigit():
        return code.startswith(('978', '979')) and _isbn13_check(code)
    return False


def to_isbn13(code):
    """
    ISBN-10 -> ISBN-13, so a book catalogued from its old ten-digit number and
    the same book scanned off a modern barcode are one record, not two.
    """
    code = _digits(normalise(code))
    if len(code) == 13:
        return code
    if not (len(code) == 10 and _isbn10_check(code)):
        return code
    body = '978' + code[:9]
    check = (10 - sum(int(c) * (3 if i % 2 else 1) for i, c in enumerate(body)) % 10) % 10
    return body + str(check)


# ── Drawing one ──────────────────────────────────────────────────────────────

def barcode_data_uri(value, *, kind='code128', height=34, width=0.011):
    """
    A PNG data URI, because xhtml2pdf cannot fetch a URL while rendering and a
    label sheet that depends on the network is a label sheet that prints blank
    the day the line is down.

    Code 128 by default: a cheap USB laser scanner -- what a school actually
    buys -- reads linear barcodes and mostly cannot read QR at all. QR is
    offered for phones, which read both.
    """
    value = str(value or '').strip()
    if not value:
        return ''

    if kind == 'qr':
        import qrcode
        img = qrcode.make(value, box_size=3, border=1)
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
    else:
        drawing = createBarcodeDrawing(
            'Code128', value=value, barHeight=height, barWidth=width,
            humanReadable=False, quiet=True,
        )
        buffer = io.BytesIO()
        # 300dpi: a barcode rendered at screen resolution and then printed is
        # a grey smear that no scanner reads. This is the whole point of the
        # label, so it is worth the bytes.
        renderPM.drawToFile(drawing, buffer, fmt='PNG', dpi=300)

    encoded = base64.b64encode(buffer.getvalue()).decode('ascii')
    return f'data:image/png;base64,{encoded}'


# ── What did I just scan? ────────────────────────────────────────────────────

def resolve(raw, *, copies_qs=None, books_qs=None, users_qs=None):
    """
    Identify a scanned string. Never acts on it, never guesses between
    candidates -- the caller decides, because the right answer differs between
    the issue desk, the returns desk and the cataloguing screen.

    Returns a dict whose 'kind' is one of:

      'copy'     one physical book, identified exactly. The only kind that can
                 safely be issued or returned without asking.
      'title'    an ISBN we stock. Carries every copy, so the desk can say
                 "which one" instead of picking one at random.
      'isbn'     a VALID ISBN we do not stock. Deliberately distinct from
                 'unknown': the answer at the cataloguing screen is "add it",
                 and telling the librarian "not found" about a book they are
                 holding is how they stop trusting the scanner.
      'borrower' a person's ID card, so a desk can scan card then book.
      'unknown'  a string that is nothing we recognise, and does not even
                 check-digit as an ISBN.
    """
    from apps.authentication.models import User

    from .models import Book, BookCopy

    code = normalise(raw)
    if not code:
        return {'kind': 'unknown', 'code': ''}

    copies = copies_qs if copies_qs is not None else BookCopy.objects.all()
    books = books_qs if books_qs is not None else Book.objects.all()
    users = users_qs if users_qs is not None else User.objects.all()

    # The school's own label first. It is the only exact answer, and a copy code
    # is checked before an ISBN so a school whose codes happen to be numeric
    # cannot have one shadowed by a book's barcode.
    copy = copies.select_related('book').filter(copy_code__iexact=code).first()
    if copy is not None:
        return {'kind': 'copy', 'code': code, 'copy': copy, 'book': copy.book}

    if is_isbn(code):
        thirteen = to_isbn13(code)
        # Match either form: a book catalogued years ago from its ten-digit
        # number is the same book as the one on the shelf today.
        matches = list(books.filter(isbn__in={_digits(code), thirteen})
                       .prefetch_related('copies'))
        if matches:
            book = matches[0]
            return {
                'kind': 'title', 'code': thirteen, 'book': book,
                'books': matches,
                'copies': list(book.copies.all()),
            }
        return {'kind': 'isbn', 'code': thirteen}

    person = users.filter(student_profile__student_id__iexact=code).first()
    if person is not None:
        return {'kind': 'borrower', 'code': code, 'borrower': person}

    return {'kind': 'unknown', 'code': code}
