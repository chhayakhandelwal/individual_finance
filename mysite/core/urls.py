from django.urls import path

# AUTH
from .auth_views import login_view

# MODULE VIEWS
from .income_views import income_list_create, income_update_delete
from .saving_views import saving_list_create, saving_update_delete
from .emergency_views import emergency_list_create, emergency_update_delete
from .loan_views import loan_list_create, loan_update_delete
from .insurance_views import insurance_list_create, insurance_detail  # ✅ NEW

urlpatterns = [
    # =========================
    # AUTH
    # =========================
    path("login/", login_view, name="login"),

    # =========================
    # INCOME
    # =========================
    path("income/", income_list_create, name="income-list-create"),
    path("income/<int:pk>/", income_update_delete, name="income-update-delete"),

    # =========================
    # SAVINGS
    # =========================
    path("saving/", saving_list_create, name="saving-list-create"),
    path("saving/<int:pk>/", saving_update_delete, name="saving-update-delete"),

    # =========================
    # EMERGENCY FUND
    # =========================
    path("emergency/", emergency_list_create, name="emergency-list-create"),
    path("emergency/<int:pk>/", emergency_update_delete, name="emergency-update-delete"),

    # =========================
    # LOAN
    # =========================
    path("loan/", loan_list_create, name="loan-list-create"),
    path("loan/<int:pk>/", loan_update_delete, name="loan-update-delete"),

    # =========================
    # INSURANCE  ✅ NEW
    # =========================
    path("insurance/", insurance_list_create, name="insurance-list-create"),
    path("insurance/<int:pk>/", insurance_detail, name="insurance-detail"),
]