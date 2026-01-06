from django.urls import path

from .auth_views import login_view
from .income_views import income_list_create, income_update_delete
from .saving_views import saving_list_create, saving_update_delete
from .emergency_views import emergency_list_create, emergency_update_delete  
# ✅ Add these imports (create these view files if not made yet)
from .loan_views import loan_list_create, loan_update_delete
# from .emergency_views import emergency_list_create, emergency_update_delete  # optional

urlpatterns = [
    # AUTH
    path("login/", login_view, name="login"),

    # INCOME
    path("income/", income_list_create, name="income-list-create"),
    path("income/<int:pk>/", income_update_delete, name="income-update-delete"),

    # SAVING
    path("saving/", saving_list_create, name="saving-list-create"),
    path("saving/<int:pk>/", saving_update_delete, name="saving-update-delete"),

    # LOAN ✅ NEW
    path("loan/", loan_list_create, name="loan-list-create"),
    path("loan/<int:pk>/", loan_update_delete, name="loan-update-delete"),

    # EMERGENCY (optional - only if you have emergency_views.py)
    path("emergency/", emergency_list_create, name="emergency-list-create"),
    path("emergency/<int:pk>/", emergency_update_delete, name="emergency-update-delete"),
]