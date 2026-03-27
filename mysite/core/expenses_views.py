import logging


from django.conf import settings
from rest_framework import generics, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response


from .models import Expense
from .serializers import ExpenseSerializer


logger = logging.getLogger(__name__)




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
   OCR for a single bill/receipt image or PDF: extract date, category, total amount.
   """
   file = request.FILES.get("image") or request.FILES.get("file")
   if not file:
       return Response({"error": "No image/file uploaded"}, status=400)


   try:
       from .bill_ocr import analyze_bill_upload


       result = analyze_bill_upload(file)
   except ValueError as e:
       return Response({"error": str(e)}, status=400)
   except Exception as e:
       logger.exception("expense_ocr failed")
       hint = "OCR failed. Install Tesseract (brew install tesseract), add TESSERACT_CMD if needed, and pip install -r requirements.txt (pdfplumber, pytesseract, Pillow, opencv-python-headless)."
       detail = str(e) if settings.DEBUG else None
       body = {"error": hint}
       if detail:
           body["detail"] = detail
       return Response(body, status=500)


   expense_date = result["expense_date"]
   preview = [
       {
           "categoryKey": result["category"],
           "date": expense_date.isoformat(),
           "amount": result["amount"],
           "merchant": result["merchant"],
           "note": "Bill OCR",
           "payment_mode": "OCR",
           "source": "OCR",
       }
   ]


   return Response({"rawText": result["raw_text"], "preview": preview})



