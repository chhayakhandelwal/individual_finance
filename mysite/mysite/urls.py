from django.contrib import admin
from django.urls import path, include
from core.auth_views import login_view

urlpatterns = [
    path("admin/", admin.site.urls),

    # ✅ LOGIN API
    path("api/login/", login_view),

    # other APIs
    path("api/", include("core.urls")),
]