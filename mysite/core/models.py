from django.db import models
from django.utils import timezone
from django.conf import settings
from datetime import timedelta
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager


# =====================================================
# App User (Django Auth User Model) ✅
# =====================================================
class AppUserManager(BaseUserManager):
    def create_user(self, username, password=None, **extra_fields):
        if not username:
            raise ValueError("username is required")

        username = username.strip()
        user = self.model(username=username, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, username, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)
        return self.create_user(username=username, password=password, **extra_fields)


class AppUser(AbstractBaseUser, PermissionsMixin):
    username = models.CharField(
        max_length=150,
        unique=True,          # ✅ UNIQUE
        db_index=True,
    )
    first_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100, blank=True)
    email = models.EmailField(blank=True)
             # ✅

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    groups = models.ManyToManyField(
        "auth.Group",
        blank=True,
        related_name="core_appuser_set",
        related_query_name="appuser",
    )
    user_permissions = models.ManyToManyField(
        "auth.Permission",
        blank=True,
        related_name="core_appuser_permissions_set",
        related_query_name="appuser",
    )

    objects = AppUserManager()

    USERNAME_FIELD = "username"
    REQUIRED_FIELDS = []

    class Meta:
        swappable = "AUTH_USER_MODEL"

    def __str__(self):
        return self.username
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


# =====================================================
# Expense ✅ (Manual + OCR + Bank Statement)
# =====================================================
class Expense(models.Model):
    DIRECTION_CHOICES = [
        ("DEBIT", "DEBIT"),
        ("CREDIT", "CREDIT"),
    ]

    SOURCE_CHOICES = [
        ("MANUAL", "MANUAL"),
        ("OCR", "OCR"),
        ("STATEMENT", "STATEMENT"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="expenses",
        db_index=True,
    )

    description = models.CharField(max_length=255, blank=True, null=True)
    merchant = models.CharField(max_length=140, blank=True, null=True)

    category = models.CharField(max_length=50, default="Other", db_index=True)
    sub_category = models.CharField(max_length=80, blank=True, null=True)

    amount = models.DecimalField(max_digits=12, decimal_places=2)
    expense_date = models.DateField(db_index=True)

    payment_mode = models.CharField(max_length=30, blank=True, null=True)
    direction = models.CharField(max_length=10, choices=DIRECTION_CHOICES, default="DEBIT")
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default="MANUAL")

    txn_id = models.CharField(max_length=120, blank=True, null=True)
    raw_text = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-expense_date", "-id"]
        indexes = [
            models.Index(fields=["user", "expense_date"]),
            models.Index(fields=["user", "category"]),
        ]

    def __str__(self):
        return f"{self.user} | {self.category} | {self.amount} | {self.expense_date}"


# =====================================================
# Password Reset OTP ✅
# =====================================================
class PasswordResetOTP(models.Model):
    username = models.CharField(max_length=150, db_index=True)
    email = models.EmailField(db_index=True)
    otp_hash = models.CharField(max_length=255)
    created_at = models.DateTimeField(default=timezone.now)

    def is_expired(self):
        return timezone.now() > self.created_at + timedelta(minutes=10)

    class Meta:
        indexes = [
            models.Index(fields=["username", "email"]),
        ]

    def __str__(self):
        return f"{self.username} | {self.email} | {self.created_at}"