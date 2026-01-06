from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .models import SavingsGoal
from .serializers import SavingsGoalSerializer


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def saving_list_create(request):
    if request.method == "GET":
        qs = SavingsGoal.objects.filter(user=request.user).order_by("target_date", "-id")
        return Response(SavingsGoalSerializer(qs, many=True).data)

    serializer = SavingsGoalSerializer(data=request.data)
    if serializer.is_valid():
        obj = serializer.save(user=request.user)
        return Response(SavingsGoalSerializer(obj).data, status=status.HTTP_201_CREATED)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def saving_update_delete(request, pk: int):
    try:
        obj = SavingsGoal.objects.get(pk=pk, user=request.user)
    except SavingsGoal.DoesNotExist:
        return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "DELETE":
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    serializer = SavingsGoalSerializer(obj, data=request.data, partial=False)
    if serializer.is_valid():
        serializer.save(user=request.user)
        return Response(serializer.data)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)