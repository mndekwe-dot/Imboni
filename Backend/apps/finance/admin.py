from django.contrib import admin

from .models import (
    Expense, ExpenseCategory, FeePayment, FeeStructure, FinanceSettings,
    StudentAccount,
)

admin.site.register([
    FinanceSettings, FeeStructure, FeePayment, ExpenseCategory, Expense,
    StudentAccount,
])
