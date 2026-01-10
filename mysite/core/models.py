from django.db import models
from django.utils import timezone
from django.contrib.auth.hashers import make_password, check_password
from django.conf import settings


# =====================================================
# App User (NOT Django Auth User)
# =====================================================
class AppUser(models.Model):
    username = models.CharField(max_length=150, unique=True, db_index=True)
    user_id = models.CharField(max_length=50, unique=True, db_index=True)

    password_hash = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    def set_password(self, raw_password):
        self.password_hash = make_password(raw_password)

    def check_password(self, raw_password):
        return check_password(raw_password, self.password_hash)

    def __str__(self):
        return f"{self.username} ({self.user_id})"


# =====================================================
# Income
# =====================================================
class Income(models.Model):
    CATEGORY_CHOICES = [
        ("SALARY", "SALARY"),
        ("FREELANCE", "FREELANCE"),
        ("BUSINESS", "BUSINESS"),
        ("RENTAL", "RENTAL"),
        ("INTEREST", "INTEREST"),
        ("OTHER", "OTHER"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="incomes",
    )

    source = models.CharField(max_length=255)
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    income_date = models.DateField()
    description = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-income_date", "-id"]

    def __str__(self):
        return f"{self.user} | {self.category} | {self.amount}"


# =====================================================
# Savings Goal
# =====================================================
class SavingsGoal(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="savings_goals",
    )

    name = models.CharField(max_length=255)
    target_amount = models.DecimalField(max_digits=12, decimal_places=2)
    saved_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    target_date = models.DateField()

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-target_date", "-id"]

    def __str__(self):
        return f"{self.user} | {self.name}"


# =====================================================
# Emergency Fund
# =====================================================
class EmergencyFund(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="emergency_funds",
    )

    name = models.CharField(max_length=255)
    target_amount = models.DecimalField(max_digits=12, decimal_places=2)
    saved_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    note = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user} | {self.name}"


# =====================================================
# Loan
# =====================================================
class Loan(models.Model):
    TYPE_CHOICES = [("GIVEN", "GIVEN"), ("TAKEN", "TAKEN")]
    STATUS_CHOICES = [("ONGOING", "ONGOING"), ("PAID", "PAID")]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="loans",
    )

    loan_type = models.CharField(max_length=10, choices=TYPE_CHOICES)
    person_name = models.CharField(max_length=120)
    title = models.CharField(max_length=255, blank=True)

    amount = models.DecimalField(max_digits=12, decimal_places=2)
    paid_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES)

    start_date = models.DateField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)
    note = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        self.status = "PAID" if self.paid_amount >= self.amount else "ONGOING"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.user} | {self.loan_type} | {self.amount}"


# =====================================================
# Insurance Policy ✅
# =====================================================
class InsurancePolicy(models.Model):
    PAYMENT_INTERVAL_CHOICES = [
        ("Monthly", "Monthly"),
        ("Quarterly", "Quarterly"),
        ("Half-Yearly", "Half-Yearly"),
        ("Yearly", "Yearly"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="insurance_policies",
    )

    name = models.CharField(max_length=255)
    policy_number = models.CharField(max_length=100)

    start_date = models.DateField()
    end_date = models.DateField()

    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_interval = models.CharField(
        max_length=20,
        choices=PAYMENT_INTERVAL_CHOICES,
    )

    note = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "policy_number")
        ordering = ["end_date"]

    def __str__(self):
        return f"{self.user} | {self.name} | {self.policy_number}"