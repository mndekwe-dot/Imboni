"""
The finance office's routes.

Every list endpoint below also answers `?format=csv` and, where a printed
version makes sense, `?format=pdf` — so exporting is a parameter on the list
you are already looking at rather than a parallel set of endpoints that can
drift away from it and start disagreeing.

The `/document/` paths are the exception: a receipt, a statement, a payslip and
a set of reminders are documents in their own right, not a rendering of a list.
"""
from django.urls import path

from . import operations_views as ops
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

    # ── Documents the office hands over ──────────────────────────────────────
    path('finance/payments/<uuid:pk>/receipt/', views.ReceiptDocumentView.as_view(),
         name='finance-receipt'),
    path('finance/students/<uuid:pk>/statement/', views.StatementDocumentView.as_view(),
         name='finance-statement'),
    path('finance/reminders/', views.RemindersDocumentView.as_view(),
         name='finance-reminders'),

    # ── Where the money sits ─────────────────────────────────────────────────
    path('finance/accounts/', ops.CashAccountListView.as_view(),
         name='finance-accounts'),
    path('finance/accounts/<uuid:pk>/', ops.CashAccountDetailView.as_view(),
         name='finance-account'),
    path('finance/cash/', ops.CashPositionView.as_view(), name='finance-cash'),
    path('finance/cash/transfer/', ops.CashTransferView.as_view(),
         name='finance-cash-transfer'),
    path('finance/cash/adjust/', ops.CashAdjustmentView.as_view(),
         name='finance-cash-adjust'),
    path('finance/cash/reconciliations/', ops.ReconciliationListView.as_view(),
         name='finance-reconciliations'),

    # ── Income that is not school fees ───────────────────────────────────────
    path('finance/income/', ops.OtherIncomeListView.as_view(), name='finance-income'),
    path('finance/income-categories/', ops.IncomeCategoryListView.as_view(),
         name='finance-income-categories'),

    # ── What is owed from earlier terms ──────────────────────────────────────
    path('finance/arrears/', ops.ArrearsView.as_view(), name='finance-arrears'),

    # ── Budget ───────────────────────────────────────────────────────────────
    path('finance/budgets/', ops.BudgetListView.as_view(), name='finance-budgets'),
    path('finance/budgets/<uuid:pk>/', ops.BudgetDetailView.as_view(),
         name='finance-budget'),
    path('finance/budgets/<uuid:pk>/lines/', ops.BudgetLineView.as_view(),
         name='finance-budget-lines'),

    # ── Payroll ──────────────────────────────────────────────────────────────
    path('finance/salaries/', ops.StaffSalaryListView.as_view(),
         name='finance-salaries'),
    path('finance/payroll/', ops.PayrollRunListView.as_view(), name='finance-payroll'),
    path('finance/payroll/<uuid:pk>/', ops.PayrollRunDetailView.as_view(),
         name='finance-payroll-run'),
    path('finance/payroll/<uuid:pk>/<str:action>/', ops.PayrollActionView.as_view(),
         name='finance-payroll-action'),
    path('finance/payslips/<uuid:pk>/document/', ops.PayslipDocumentView.as_view(),
         name='finance-payslip'),
]
