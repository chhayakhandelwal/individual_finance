from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status

from django.contrib.auth.models import User

from rest_framework_simplejwt.tokens import RefreshToken  # ✅ IMPORTANT

from .models import AppUser


@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    # React sends: { username, userId, password }
    username = (request.data.get("username") or "").strip()
    user_id = (request.data.get("userId") or "").strip()
    password = request.data.get("password") or ""

    # Validate request
    if not user_id or not password:
        return Response(
            {"message": "userId and password are required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Fetch AppUser by user_id
    try:
        app_user = AppUser.objects.get(user_id=user_id)
    except AppUser.DoesNotExist:
        return Response(
            {"message": "Invalid ID or password"},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    # Optional: if you want to ensure the username matches the DB record
    # If you don't want this check, you can remove this block.
    if username and app_user.username and username.lower() != app_user.username.lower():
        return Response(
            {"message": "Username does not match this ID"},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    # Verify password (AppUser password must be stored using Django hashing)
    if not app_user.check_password(password):
        return Response(
            {"message": "Invalid ID or password"},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    # Create/Reuse Django auth user used only for issuing JWT
    django_user, created = User.objects.get_or_create(
        username=user_id,
        defaults={"first_name": app_user.username},
    )

    # Keep first_name in sync (optional but useful)
    if not created and django_user.first_name != (app_user.username or ""):
        django_user.first_name = app_user.username or ""
        django_user.save(update_fields=["first_name"])

    # Ensure Django user cannot be logged into via password (safer)
    if not django_user.has_usable_password():
        # already unusable => fine
        pass
    else:
        django_user.set_unusable_password()
        django_user.save(update_fields=["password"])

    # Issue JWT
    refresh = RefreshToken.for_user(django_user)
    access_token = str(refresh.access_token)

    return Response(
        {
            "message": "Login successful",
            "token": access_token,              # ✅ React extractToken() will pick this
            "refreshToken": str(refresh),       # optional, but useful
            "user": {
                "name": app_user.username,
                "userId": app_user.user_id,
            },
        },
        status=status.HTTP_200_OK,
    )