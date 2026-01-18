from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction

from .models import AppUser


@api_view(["POST"])
@permission_classes([AllowAny])
def register_view(request):
    username = (request.data.get("username") or "").strip()
    user_id = (request.data.get("user_id") or "").strip()
    password = request.data.get("password") or ""

    if not username or not user_id or not password:
        return Response(
            {"message": "username, user_id and password are required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if len(password) < 8:
        return Response(
            {"message": "Password must be at least 8 characters long"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if AppUser.objects.filter(user_id=user_id).exists():
        return Response(
            {"message": "This ID is already registered"},
            status=status.HTTP_409_CONFLICT,
        )

    try:
        with transaction.atomic():
            user = AppUser.objects.create_user(
                user_id=user_id,
                username=username,
                password=password,
            )
    except IntegrityError:
        return Response(
            {"message": "User already exists"},
            status=status.HTTP_409_CONFLICT,
        )

    return Response(
        {
            "message": "Registration successful",
            "user": {"name": user.username, "user_id": user.user_id},
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    User = get_user_model()  # core.AppUser because AUTH_USER_MODEL is set

    user_id = (request.data.get("user_id") or "").strip()
    password = request.data.get("password") or ""
    username = (request.data.get("username") or "").strip()

    if not user_id or not password:
        return Response(
            {"message": "user_id and password are required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        user = User.objects.get(user_id=user_id)
    except User.DoesNotExist:
        return Response(
            {"message": "Invalid ID or password"},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    # optional username match
    if username and user.username and user.username.lower() != username.lower():
        return Response(
            {"message": "Username does not match this ID"},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if not user.check_password(password):
        return Response(
            {"message": "Invalid ID or password"},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    refresh = RefreshToken.for_user(user)

    return Response(
        {
            "message": "Login successful",
            "token": str(refresh.access_token),
            "refreshToken": str(refresh),
            "user": {"name": user.username, "user_id": user.user_id},
        },
        status=status.HTTP_200_OK,
    )


# ✅ MUST be outside login_view (top-level)
@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def profile_view(request):
    u = request.user

    # PATCH: update allowed fields (only if they exist)
    if request.method == "PATCH":
        username = request.data.get("username", None)
        email = request.data.get("email", None)
        phone = request.data.get("phone", None)

        errors = {}

        if username is not None:
            username = (username or "").strip()
            if not username:
                errors["username"] = "Username cannot be empty."
            else:
                u.username = username

        if email is not None and hasattr(u, "email"):
            u.email = (email or "").strip()

        if phone is not None and hasattr(u, "phone"):
            u.phone = (phone or "").strip()

        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)

        u.save()

    # Build safe response
    username_val = getattr(u, "username", "") or ""
    user_id_val = getattr(u, "user_id", None)

    full_name = ""
    if hasattr(u, "get_full_name"):
        try:
            full_name = (u.get_full_name() or "").strip()
        except Exception:
            full_name = ""

    joined = ""
    dj = getattr(u, "date_joined", None)
    if dj:
        try:
            joined = dj.strftime("%B %Y")
        except Exception:
            joined = ""

    return Response(
        {
            "name": full_name or username_val,
            "username": username_val,
            "user_id": user_id_val,
            "email": getattr(u, "email", "") if hasattr(u, "email") else "",
            "phone": getattr(u, "phone", "") if hasattr(u, "phone") else "",
            "joined": joined,
        },
        status=status.HTTP_200_OK,
    )