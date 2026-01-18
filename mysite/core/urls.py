from django.urls import path

# AUTH
from .auth_views import login_view, register_view

# MODULE VIEWS
from .income_views import income_list_create, income_update_delete
from .saving_views import saving_list_create, saving_update_delete
from .emergency_views import emergency_list_create, emergency_update_delete
from .loan_views import loan_list_create, loan_update_delete
from .insurance_views import insurance_list_create, insurance_detail
from .expenses_views import ExpenseListCreateView, ExpenseUpdateDeleteView, expense_ocr

urlpatterns = [
    # =====================
    # AUTH (correct)
    # =====================
    path("register/", register_view, name="api-register"),
    path("login/", login_view, name="api-login"),

    # =====================
    # MODULES
    # =====================
    path("income/", income_list_create),
    path("income/<int:pk>/", income_update_delete),

    path("saving/", saving_list_create),
    path("saving/<int:pk>/", saving_update_delete),

    path("emergency/", emergency_list_create),
    path("emergency/<int:pk>/", emergency_update_delete),

    path("loan/", loan_list_create),
    path("loan/<int:pk>/", loan_update_delete),

    path("insurance/", insurance_list_create),
    path("insurance/<int:pk>/", insurance_detail),

    
    path("expenses/", ExpenseListCreateView.as_view(), name="expense-list-create"),
    path("expenses/<int:pk>/", ExpenseUpdateDeleteView.as_view(), name="expense-detail"),
    path("expenses/ocr/", expense_ocr, name="expense-ocr"),
]