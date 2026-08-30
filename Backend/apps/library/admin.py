from django.contrib import admin

from .models import (
    AcquisitionRequest, Book, BookCopy, Fine, LibrarySettings, Loan,
    Reservation, Supplier,
)

admin.site.register([
    LibrarySettings, Supplier, Book, BookCopy, Loan, Fine, Reservation,
    AcquisitionRequest,
])
