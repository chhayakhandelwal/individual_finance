from django.db import models
from django.utils import timezone
from django.contrib.auth.hashers import make_password, check_password
from django.conf import settings


class AppUser(models.Model):
    username = models.CharField(max_length=150, unique=True, db_index=True)
    user_id = models.CharField(max_length=50, unique=True, db_index=True)

    password_hash = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    def set_password(self, raw_password: str) -> None:
        self.password_hash = make_password(raw_password)

    def check_password(self, raw_password: str) -> bool:
        return check_password(raw_password, self.password_hash)

    def __str__(self) -> str:
        return f"{self.username} ({self.user_id})"


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
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES, default="SALARY")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    income_date = models.DateField()
    description = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-income_date", "-id"]
        indexes = [
            models.Index(fields=["user", "income_date"]),
            models.Index(fields=["user", "category"]),
        ]

    def __str__(self) -> str:
        return f"{self.user} | {self.category} | {self.amount}"


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
        indexes = [models.Index(fields=["user", "target_date"])]

    def __str__(self) -> str:
        return f"{self.user} | {self.name} | {self.saved_amount}/{self.target_amount}"

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

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return f"{self.user} | {self.name}"



class Loan(models.Model):
    TYPE_CHOICES = [("GIVEN", "GIVEN"), ("TAKEN", "TAKEN")]
    STATUS_CHOICES = [("ONGOING", "ONGOING"), ("PAID", "PAID")]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="loans",
    )

    loan_type = models.CharField(max_length=10, choices=TYPE_CHOICES, default="GIVEN")
    person_name = models.CharField(max_length=120)
    title = models.CharField(max_length=255, blank=True, default="")

    amount = models.DecimalField(max_digits=12, decimal_places=2)
    paid_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="ONGOING")

    start_date = models.DateField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)

    note = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-start_date", "-id"]
        indexes = [
            models.Index(fields=["user", "loan_type"]),
            models.Index(fields=["user", "status"]),
            models.Index(fields=["user", "start_date"]),
        ]

    def save(self, *args, **kwargs):
        amt = self.amount or 0
        paid = self.paid_amount or 0
        self.status = "PAID" if amt > 0 and paid >= amt else "ONGOING"
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.user} | {self.loan_type} | {self.person_name} | {self.amount}"