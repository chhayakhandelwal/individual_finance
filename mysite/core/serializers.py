from rest_framework import serializers
from .models import Income, SavingsGoal, Loan, EmergencyFund, InsurancePolicy


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
        if name is not None and not name.strip():
            raise serializers.ValidationError({"name": "Name cannot be empty."})

        return attrs


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
# ✅ Insurance Policy Serializer (UPDATED)
# API fields = camelCase (frontend)
# Model fields = snake_case (db)
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