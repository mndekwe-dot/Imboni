from django.urls import path

from . import views

urlpatterns = [
    # Is finance part of this school's plan at all?
    path('finance/availability/', views.FinanceAvailabilityView.as_view(),
         name='finance-availability'),

    path('finance/dashboard/', views.FinanceDashboardView.as_view(), name='finance-dashboard'),
    path('finance/report/',    views.FinanceReportView.as_view(),    name='finance-report'),
    path('finance/settings/',  views.FinanceSettingsView.as_view(),  name='finance-settings'),

    # Charges and the money against them
    path('finance/fees/',     views.FeeListView.as_view(),      name='finance-fees'),
    path('finance/payments/', views.PaymentListView.as_view(),  name='finance-payments'),
    path('finance/payments/record/', views.RecordPaymentView.as_view(),
         name='finance-record-payment'),
    path('finance/payments/<uuid:pk>/reverse/', views.ReversePaymentView.as_view(),
         name='finance-reverse-payment'),

    # Students
    path('finance/debtors/', views.DebtorListView.as_view(), name='finance-debtors'),
    path('finance/students/<uuid:pk>/', views.StudentFinanceView.as_view(),
         name='finance-student'),

    # Fee structure and invoicing
    path('finance/structures/', views.FeeStructureListView.as_view(),
         name='finance-structures'),
    path('finance/structures/<uuid:pk>/', views.FeeStructureDetailView.as_view(),
         name='finance-structure'),
    path('finance/structures/<uuid:pk>/invoice/', views.InvoiceView.as_view(),
         name='finance-invoice'),

    # Expenses
    path('finance/expenses/', views.ExpenseListView.as_view(), name='finance-expenses'),
    path('finance/expenses/<uuid:pk>/decision/', views.ExpenseDecisionView.as_view(),
         name='finance-expense-decision'),
    path('finance/expense-categories/', views.ExpenseCategoryListView.as_view(),
         name='finance-expense-categories'),
]
