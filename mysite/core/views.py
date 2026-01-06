from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import AppUser


@api_view(["POST"])
@permission_classes([AllowAny])
def login_api(request):
    username = (request.data.get("username") or "").strip()
    user_id = (request.data.get("userId") or "").strip()
    password = request.data.get("password") or ""

    if not username or not user_id or not password:
        return Response({"message": "All fields are required!"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        u = AppUser.objects.get(username=username)
    except AppUser.DoesNotExist:
        return Response({"message": "Invalid ID or password"}, status=status.HTTP_401_UNAUTHORIZED)

    if hasattr(u, "is_active") and not u.is_active:
        return Response({"message": "Account is inactive"}, status=status.HTTP_403_FORBIDDEN)

    if u.user_id != user_id or not u.check_password(password):
        return Response({"message": "Invalid ID or password"}, status=status.HTTP_401_UNAUTHORIZED)

    token = f"appuser-{u.id}-{u.user_id}"
    return Response(
        {"message": "Login successful", "token": token, "user": {"username": u.username, "userId": u.user_id}},
        status=status.HTTP_200_OK,
    )