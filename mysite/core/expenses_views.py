from rest_framework import generics, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from datetime import date

from .models import Expense
from .serializers import ExpenseSerializer


class ExpenseListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ExpenseSerializer

    def get_queryset(self):
        return Expense.objects.filter(user=self.request.user).order_by("-expense_date", "-id")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class ExpenseUpdateDeleteView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ExpenseSerializer

    def get_queryset(self):
        return Expense.objects.filter(user=self.request.user)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def expense_ocr(request):
    """
    Temporary OCR endpoint so frontend works.
    Replace logic later with real OCR.
    """
    file = request.FILES.get("image") or request.FILES.get("file")
    if not file:
        return Response({"error": "No image/file uploaded"}, status=400)

    preview = {
        "amount": 0,
        "category": "Other",
        "expense_date": date.today().isoformat(),
        "merchant": file.name,
        "description": "Detected via OCR",
        "payment_mode": "OCR",
        "source": "OCR",
    }

    # Return in same shape as frontend expects
    return Response({"rawText": "", "preview": [preview]})