from rest_framework import serializers
from django.contrib.auth import get_user_model, authenticate

from .models import Income, SavingsGoal, Loan, EmergencyFund, InsurancePolicy, Expense

User = get_user_model()

# =====================================================
# ✅ Profile Serializer (GET + PATCH)
# =====================================================
class ProfileSerializer(serializers.ModelSerializer):
    # Frontend-friendly read-only joined string
    joined = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = User
        fields = [
            "user_id",     # read-only in UI (identifier)
            "username",    # editable
            "email",       # editable if you use it
            "joined",      # read-only
        ]
        read_only_fields = ["user_id", "joined"]

        extra_kwargs = {
            "username": {"required": False, "allow_blank": True},
            "email": {"required": False, "allow_blank": True, "allow_null": True},
        }

    def get_joined(self, obj):
        dj = getattr(obj, "date_joined", None)
        return dj.strftime("%B %Y") if dj else ""

    def validate_username(self, value):
        value = (value or "").strip()
        if value == "":
            raise serializers.ValidationError("Username cannot be empty.")
        return value
# =====================================================
# ✅ AUTH (Register / Login)
# =====================================================
class RegisterSerializer(serializers.ModelSerializer):
    """
    Expected payload from frontend:
    {
      "username": "Chhavi",
      "user_id": "BV123",
      "password": "password123"
    }
    """
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ["username", "user_id", "password"]

    def validate_username(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Username is required.")
        return value

    def validate_user_id(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("User ID is required.")
        return value

    def create(self, validated_data):
        password = validated_data.pop("password")
        # Uses AppUserManager.create_user() -> set_password()
        user = User.objects.create_user(password=password, **validated_data)
        return user


class LoginSerializer(serializers.Serializer):
    """
    Expected payload from frontend:
    {
      "user_id": "BV123",
      "password": "password123"
    }
    """
    user_id = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        user_id = (attrs.get("user_id") or "").strip()
        password = attrs.get("password") or ""

        if not user_id or not password:
            raise serializers.ValidationError("User ID and password are required.")

        # Because USERNAME_FIELD = "user_id"
        user = authenticate(username=user_id, password=password)
        if not user:
            raise serializers.ValidationError("Invalid credentials or user not registered.")

        if not getattr(user, "is_active", True):
            raise serializers.ValidationError("User is inactive.")

        attrs["user"] = user
        return attrs


# =====================================================
# Income
# =====================================================
class IncomeSerializer(serializers.ModelSerializer):
    # Frontend sends "date" -> map to model field "income_date"
    date = serializers.DateField(source="income_date", required=True)

    class Meta:
        model = Income
        fields = [
            "id",
            "source",
            "category",
            "amount",
            "date",         # frontend write/read
            "income_date",  # read-only mirror for table display
            "description",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "income_date",
            "created_at",
            "updated_at",
        ]

    def validate_amount(self, value):
        if value is None or value <= 0:
            raise serializers.ValidationError("Amount must be greater than zero.")
        return value

    def validate_source(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Source is required.")
        return value


# =====================================================
# Savings Goal
# =====================================================
class SavingsGoalSerializer(serializers.ModelSerializer):
    class Meta:
        model = SavingsGoal
        fields = [
            "id",
            "name",
            "target_amount",
            "saved_amount",
            "target_date",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, attrs):
        target = attrs.get("target_amount", getattr(self.instance, "target_amount", None))
        saved = attrs.get("saved_amount", getattr(self.instance, "saved_amount", None))

        if target is not None and target <= 0:
            raise serializers.ValidationError({"target_amount": "Target amount must be greater than zero."})

        if saved is not None and saved < 0:
            raise serializers.ValidationError({"saved_amount": "Saved amount cannot be negative."})

        if target is not None and saved is not None and saved > target:
            raise serializers.ValidationError({"saved_amount": "Saved amount cannot exceed target amount."})

        name = attrs.get("name")
        if name is not None and not str(name).strip():
            raise serializers.ValidationError({"name": "Name cannot be empty."})

        return attrs


# =====================================================
# Emergency Fund
# =====================================================
class EmergencyFundSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmergencyFund
        fields = [
            "id",
            "name",
            "target_amount",
            "saved_amount",
            "note",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, attrs):
        target = attrs.get("target_amount", getattr(self.instance, "target_amount", None))
        saved = attrs.get("saved_amount", getattr(self.instance, "saved_amount", None))

        name = attrs.get("name")
        if name is not None and not str(name).strip():
            raise serializers.ValidationError({"name": "Fund name is required."})

        if target is not None and target <= 0:
            raise serializers.ValidationError({"target_amount": "Target amount must be greater than zero."})

        if saved is not None and saved < 0:
            raise serializers.ValidationError({"saved_amount": "Saved amount cannot be negative."})

        if target is not None and saved is not None and saved > target:
            raise serializers.ValidationError({"saved_amount": "Saved amount cannot exceed target amount."})

        return attrs


# =====================================================
# Loan
# =====================================================
class LoanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Loan
        fields = [
            "id",
            "loan_type",
            "person_name",
            "title",
            "amount",
            "paid_amount",
            "status",
            "start_date",
            "due_date",
            "note",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "status", "created_at", "updated_at"]

    def validate(self, attrs):
        amount = attrs.get("amount", getattr(self.instance, "amount", None))
        paid = attrs.get("paid_amount", getattr(self.instance, "paid_amount", 0))

        if amount is not None and amount <= 0:
            raise serializers.ValidationError({"amount": "Amount must be greater than zero."})

        if paid is not None and paid < 0:
            raise serializers.ValidationError({"paid_amount": "Paid amount cannot be negative."})

        if amount is not None and paid is not None and paid > amount:
            raise serializers.ValidationError({"paid_amount": "Paid amount cannot exceed amount."})

        person = attrs.get("person_name")
        if person is not None and not str(person).strip():
            raise serializers.ValidationError({"person_name": "Person name is required."})

        title = attrs.get("title")
        if title is not None and not str(title).strip():
            raise serializers.ValidationError({"title": "Title is required."})

        return attrs


# =====================================================
# ✅ Insurance Policy Serializer (camelCase frontend)
# =====================================================
class InsurancePolicySerializer(serializers.ModelSerializer):
    # Frontend -> Model mapping
    policyNumber = serializers.CharField(source="policy_number", required=True)
    startDate = serializers.DateField(source="start_date", required=True)
    endDate = serializers.DateField(source="end_date", required=True)
    interval = serializers.ChoiceField(
        source="payment_interval",
        choices=InsurancePolicy.PAYMENT_INTERVAL_CHOICES,
        required=True,
    )

    class Meta:
        model = InsurancePolicy
        fields = [
            "id",
            "name",
            "policyNumber",
            "startDate",
            "endDate",
            "amount",
            "interval",
            "note",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, attrs):
        # attrs has MODEL field names because of source= mapping
        name = (attrs.get("name") or "").strip()
        policy_number = (attrs.get("policy_number") or "").strip()
        start = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end = attrs.get("end_date", getattr(self.instance, "end_date", None))
        amount = attrs.get("amount", getattr(self.instance, "amount", 0))

        errors = {}

        if not name:
            errors["name"] = "Insurance name is required."

        if not policy_number:
            errors["policyNumber"] = "Policy number is required."

        if amount is not None and float(amount) < 0:
            errors["amount"] = "Amount cannot be negative."

        if start and end and end < start:
            errors["endDate"] = "End date must be after start date."

        if errors:
            raise serializers.ValidationError(errors)

        # put trimmed values back
        attrs["name"] = name
        attrs["policy_number"] = policy_number

        return attrs


# =====================================================
# ✅ Expense Serializer (camelCase frontend mapping)
# Frontend fields: categoryKey, date, note, merchant, amount
# Model fields: category, expense_date, description, merchant, amount
# =====================================================
class ExpenseSerializer(serializers.ModelSerializer):
    categoryKey = serializers.CharField(source="category", required=True)
    date = serializers.DateField(source="expense_date", required=True)

    # note is optional and maps to description
    note = serializers.CharField(
        source="description",
        required=False,
        allow_blank=True,
        allow_null=True,
        default="",
    )

    merchant = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        default="",
    )

    # OPTIONAL: read-only mirrors for debugging / convenience (like income_date)
    category = serializers.CharField(read_only=True)
    expense_date = serializers.DateField(read_only=True)

    class Meta:
        model = Expense
        fields = [
            "id",

            # camelCase (frontend)
            "categoryKey",
            "amount",
            "date",
            "note",
            "merchant",

            # optional extra fields
            "payment_mode",
            "source",
            "direction",
            "txn_id",
            "raw_text",

            # read-only mirrors (safe)
            "category",
            "expense_date",

            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "category", "expense_date"]

    def validate(self, attrs):
        errors = {}

        category = (attrs.get("category") or "").strip()
        amount = attrs.get("amount", None)
        expense_date = attrs.get("expense_date", None)

        if not category:
            errors["categoryKey"] = "Category is required."

        if amount is None or amount <= 0:
            errors["amount"] = "Amount must be greater than zero."

        if not expense_date:
            errors["date"] = "Date is required."

        # normalize optional strings
        merchant = attrs.get("merchant", "")
        attrs["merchant"] = (merchant or "").strip() or None

        description = attrs.get("description", "")
        attrs["description"] = (description or "").strip() or ""

        attrs["category"] = category

        if errors:
            raise serializers.ValidationError(errors)

        return attrs