from django.contrib import admin

from .models import (
    Expense, ExpenseCategory, FeeCategory, FeeDiscount, FeePayment, FeeStructure,
    FinanceSettings,
    StudentAccount,
)

admin.site.register([
    FinanceSettings, FeeCategory, FeeStructure, FeeDiscount, FeePayment, ExpenseCategory,
    Expense,
    StudentAccount,
])
