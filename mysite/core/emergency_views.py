from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status

from .models import EmergencyFund
from .serializers import EmergencyFundSerializer


@api_view(["GET", "POST"])
@permission_classes([AllowAny])  # ✅ TEMP: remove auth issues
def emergency_list_create(request):
    if request.method == "GET":
        funds = EmergencyFund.objects.all()
        serializer = EmergencyFundSerializer(funds, many=True)
        return Response(serializer.data)

    if request.method == "POST":
        serializer = EmergencyFundSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user_id=1)  # ✅ TEMP USER
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["PUT", "DELETE"])
@permission_classes([AllowAny])
def emergency_update_delete(request, pk):
    try:
        fund = EmergencyFund.objects.get(pk=pk)
    except EmergencyFund.DoesNotExist:
        return Response({"error": "Not found"}, status=404)

    if request.method == "PUT":
        serializer = EmergencyFundSerializer(fund, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    if request.method == "DELETE":
        fund.delete()
        return Response(status=204)