from django.urls import path

from . import operations_views as ops
from . import views

urlpatterns = [
    # Is the library part of this school's plan at all?
    path('library/availability/', views.LibraryAvailabilityView.as_view(),
         name='library-availability'),

    path('library/dashboard/', views.LibraryDashboardView.as_view(), name='library-dashboard'),
    path('library/settings/',  views.LibrarySettingsView.as_view(),  name='library-settings'),

    # Catalogue
    path('library/books/', views.BookListView.as_view(), name='library-books'),
    path('library/books/<uuid:pk>/', views.BookDetailView.as_view(), name='library-book'),
    path('library/books/<uuid:pk>/copies/', views.BookCopyListView.as_view(),
         name='library-book-copies'),
    path('library/copies/<uuid:pk>/', views.BookCopyDetailView.as_view(), name='library-copy'),

    # Circulation
    path('library/loans/', views.LoanListView.as_view(), name='library-loans'),
    path('library/loans/issue/', views.IssueLoanView.as_view(), name='library-issue'),
    path('library/loans/<uuid:pk>/return/', views.ReturnLoanView.as_view(), name='library-return'),
    path('library/loans/<uuid:pk>/renew/',  views.RenewLoanView.as_view(),  name='library-renew'),

    # Borrowers
    path('library/members/', views.MemberListView.as_view(), name='library-members'),
    path('library/members/<uuid:pk>/', views.MemberDetailView.as_view(), name='library-member'),

    # Fines
    path('library/fines/', views.FineListView.as_view(), name='library-fines'),
    path('library/fines/<uuid:pk>/', views.FineActionView.as_view(), name='library-fine'),

    # Reservations
    path('library/reservations/', views.ReservationListView.as_view(),
         name='library-reservations'),
    path('library/reservations/<uuid:pk>/cancel/', views.ReservationCancelView.as_view(),
         name='library-reservation-cancel'),

    # Acquisitions
    path('library/acquisitions/', views.AcquisitionListView.as_view(),
         name='library-acquisitions'),
    path('library/acquisitions/<uuid:pk>/decision/', views.AcquisitionDecisionView.as_view(),
         name='library-acquisition-decision'),
    path('library/acquisitions/<uuid:pk>/receive/', views.AcquisitionReceiveView.as_view(),
         name='library-acquisition-receive'),
    path('library/suppliers/', views.SupplierListView.as_view(), name='library-suppliers'),

    # The student's side
    path('library/catalogue/', views.CatalogueView.as_view(), name='library-catalogue'),
    path('library/me/',        views.MyLibraryView.as_view(), name='library-me'),
    path('library/me/reserve/', views.MyReserveView.as_view(), name='library-me-reserve'),

    # ── Chasing what is late ─────────────────────────────────────────────────
    path('library/overdue/', ops.OverdueView.as_view(), name='library-overdue'),
    path('library/overdue/notices/', ops.NoticesView.as_view(),
         name='library-notices'),
    path('library/borrowers/<uuid:pk>/', ops.BorrowerHistoryView.as_view(),
         name='library-borrower'),

    # ── Lost, damaged, written off ───────────────────────────────────────────
    path('library/copies/<uuid:pk>/events/', ops.CopyEventView.as_view(),
         name='library-copy-events'),
    path('library/lost-damaged/', ops.LostAndDamagedView.as_view(),
         name='library-lost-damaged'),

    # ── Counting the shelves ─────────────────────────────────────────────────
    path('library/stocktakes/', ops.StocktakeListView.as_view(),
         name='library-stocktakes'),
    path('library/stocktakes/<uuid:pk>/', ops.StocktakeDetailView.as_view(),
         name='library-stocktake'),
    path('library/stocktakes/<uuid:pk>/scan/', ops.StocktakeScanView.as_view(),
         name='library-stocktake-scan'),
    path('library/stocktakes/<uuid:pk>/close/', ops.StocktakeCloseView.as_view(),
         name='library-stocktake-close'),

    # ── Paper and spreadsheets ───────────────────────────────────────────────
    path('library/scan/', ops.ScanView.as_view(), name='library-scan'),
    path('library/scan/return/', ops.ScanReturnView.as_view(),
         name='library-scan-return'),

    path('library/scan/catalogue/', ops.ScanCatalogueView.as_view(),
         name='library-scan-catalogue'),

    path('library/labels/', ops.LabelsView.as_view(), name='library-labels'),
    path('library/import/', ops.BookImportView.as_view(), name='library-import'),
    path('library/export/catalogue/', ops.CatalogueExportView.as_view(),
         name='library-export-catalogue'),
    path('library/export/loans/', ops.LoanExportView.as_view(),
         name='library-export-loans'),

    # ── What the collection does ─────────────────────────────────────────────
    path('library/usage/', ops.UsageReportView.as_view(), name='library-usage'),
]
