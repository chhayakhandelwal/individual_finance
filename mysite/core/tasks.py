# core/tasks.py

from __future__ import annotations

import calendar

from celery import shared_task
from django.core.mail import send_mail
from django.utils import timezone

from .models import (
    SavingsGoal,
    SavingsContribution,
    NotificationEvent,
    EmergencyFund,
)
from .services import (
    build_detailed_body,
    emergency_interval_delta,
    send_emergency_missed_interval_email,
)

# =========================================================
# SAVINGS MODULE TASKS (UNCHANGED)
# =========================================================

def _sent(user, goal, key: str) -> bool:
    return NotificationEvent.objects.filter(user=user, goal=goal, event_key=key).exists()


def _log(user, goal, key: str, meta=None, status: str = "sent"):
    NotificationEvent.objects.create(
        user=user,
        goal=goal,
        event_key=key,
        event_date=timezone.localdate(),
        channel="email",
        status=status,
        meta=meta or {},
    )


@shared_task
def daily_deadline_reminders():
    today = timezone.localdate()
    reminder_days = {30, 15, 5, 4, 3, 2, 1}

    goals = SavingsGoal.objects.select_related("user").all()

    for goal in goals:
        if not goal.target_date:
            continue

        days_left = (goal.target_date - today).days
        if days_left not in reminder_days:
            continue

        user = goal.user
        if not getattr(user, "email", None):
            continue

        key = f"DEADLINE_D{days_left}"
        if _sent(user, goal, key):
            continue

        subject = f'Reminder: {days_left} day(s) left for "{goal.name}"'
        headline = f"Target date reminder: {days_left} day(s) remaining."
        extra = [f"Reminder type: D-{days_left}"]

        body = build_detailed_body(goal, headline=headline, extra_lines=extra)

        try:
            send_mail(subject, body, None, [user.email], fail_silently=False)
            _log(user, goal, key, meta={"days_left": days_left})
        except Exception as e:
            _log(user, goal, key, meta={"error": str(e)}, status="failed")


@shared_task
def month_end_no_contribution_alert():
    today = timezone.localdate()

    last_day = calendar.monthrange(today.year, today.month)[1]
    if today.day != last_day:
        return "Not month end. Skipped."

    month_start = today.replace(day=1)
    month_key = f"{today.year}_{today.month:02d}"

    goals = SavingsGoal.objects.select_related("user").all()

    for goal in goals:
        user = goal.user
        if not getattr(user, "email", None):
            continue

        key = f"NO_CONTRIB_MONTHEND_{month_key}"
        if _sent(user, goal, key):
            continue

        contributed = SavingsContribution.objects.filter(
            goal=goal,
            contribution_date__gte=month_start,
            contribution_date__lte=today,
        ).exists()

        if contributed:
            continue

        subject = f'No saving added in {today.strftime("%B %Y")} for "{goal.name}"'
        headline = f"No contribution recorded in {today.strftime('%B %Y')}."
        extra = [
            "Month-end alert: you did not add any savings this month.",
            "Next step: add a contribution tomorrow to stay consistent.",
        ]

        body = build_detailed_body(goal, headline=headline, extra_lines=extra)

        try:
            send_mail(subject, body, None, [user.email], fail_silently=False)
            _log(user, goal, key, meta={"month": month_key})
        except Exception as e:
            _log(user, goal, key, meta={"error": str(e)}, status="failed")

    return "Month-end alerts processed."


# =========================================================
# EMERGENCY FUNDS MODULE TASK (NEW)
# =========================================================

@shared_task
def daily_emergency_interval_check():
    """
    Runs DAILY (via Celery Beat).

    If user has NOT added savings within chosen interval
    → send reminder email.
    """
    today = timezone.localdate()

    funds = EmergencyFund.objects.select_related("user").all()

    for fund in funds:
        user = fund.user
        if not user or not getattr(user, "email", None):
            continue

        # Interval in days
        delta_days = emergency_interval_delta(fund.interval).days

        # last contribution date (fallback to created_at)
        base_dt = fund.last_contribution_at or fund.created_at
        if not base_dt:
            continue

        base_date = timezone.localdate(base_dt)  # ✅ safe conversion datetime -> date
        days_passed = (today - base_date).days

        # if interval missed
        if days_passed > delta_days:
            days_overdue = days_passed - delta_days
            send_emergency_missed_interval_email(fund, days_overdue=days_overdue)

    return "Emergency interval check completed."