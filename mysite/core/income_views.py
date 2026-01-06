from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .models import Income
from .serializers import IncomeSerializer

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def income_list_create(request):
    if request.method == "GET":
        qs = Income.objects.filter(user=request.user).order_by("-income_date", "-id")
        return Response(IncomeSerializer(qs, many=True).data)

    # POST
    serializer = IncomeSerializer(data=request.data)
    if serializer.is_valid():
        obj = serializer.save(user=request.user)  # attach owner
        return Response(IncomeSerializer(obj).data, status=status.HTTP_201_CREATED)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def income_update_delete(request, pk: int):
    try:
        obj = Income.objects.get(pk=pk, user=request.user)
    except Income.DoesNotExist:
        return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "DELETE":
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # PUT
    serializer = IncomeSerializer(obj, data=request.data, partial=False)
    if serializer.is_valid():
        serializer.save(user=request.user)  # keep owner same
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)