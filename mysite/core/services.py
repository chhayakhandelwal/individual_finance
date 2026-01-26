# core/services.py

from decimal import Decimal
from django.core.mail import send_mail
from django.utils import timezone
from django.db.models import Sum

from .models import NotificationEvent, SavingsGoal, SavingsContribution


def _already_sent(user, goal, event_key) -> bool:
    return NotificationEvent.objects.filter(user=user, goal=goal, event_key=event_key).exists()


def _log(user, goal, event_key, meta=None, status="sent"):
    NotificationEvent.objects.create(
        user=user,
        goal=goal,
        event_key=event_key,
        event_date=timezone.localdate(),
        channel="email",
        status=status,
        meta=meta or {},
    )


def goal_stats(goal: SavingsGoal):
    target = Decimal(goal.target_amount or 0)
    saved = Decimal(goal.saved_amount or 0)
    remaining = max(target - saved, Decimal("0"))
    pct = float((saved / target) * 100) if target > 0 else 0.0
    pct = round(pct, 2)
    days_left = (goal.target_date - timezone.localdate()).days if goal.target_date else None
    return target, saved, remaining, pct, days_left


def contribution_summary(goal: SavingsGoal, days: int = 30):
    """
    Summary for last `days` days:
    - count
    - total contributed
    - last contribution date
    """
    today = timezone.localdate()
    start = today - timezone.timedelta(days=days)

    qs = SavingsContribution.objects.filter(
        goal=goal,
        contribution_date__gte=start,
        contribution_date__lte=today,
    )

    total = qs.aggregate(s=Sum("amount"))["s"] or Decimal("0")
    count = qs.count()
    last_date = qs.order_by("-contribution_date").values_list("contribution_date", flat=True).first()

    return count, total, last_date


def build_detailed_body(goal: SavingsGoal, headline: str, extra_lines=None) -> str:
    """
    Full-detail email body used for ALL notifications.
    """
    user = goal.user
    target, saved, remaining, pct, days_left = goal_stats(goal)

    # Pace (only meaningful when days_left > 0)
    if days_left is None or days_left <= 0:
        daily_required = None
        monthly_required = None
    else:
        daily_required = (remaining / Decimal(days_left)) if remaining > 0 else Decimal("0")
        monthly_required = daily_required * Decimal("30")

    # Simple status heuristic (no start_date in model yet)
    status_label = "On Track"
    if days_left is not None and days_left > 0:
        if pct < 50 and days_left < 15:
            status_label = "Behind Schedule"

    # Contribution summaries
    c7_count, c7_total, c7_last = contribution_summary(goal, days=7)
    c30_count, c30_total, c30_last = contribution_summary(goal, days=30)

    extra_lines = extra_lines or []

    lines = [
        f"Hi {user.get_username()},",
        "",
        headline,
        "",
        "==============================",
        "GOAL DETAILS",
        "==============================",
        f"Goal Name       : {goal.name}",
        f"Target Amount   : ₹{int(target)}",
        f"Saved Amount    : ₹{int(saved)}",
        f"Remaining       : ₹{int(remaining)}",
        f"Progress        : {pct}%",
        f"Target Date     : {goal.target_date}",
        f"Days Left       : {days_left if days_left is not None else 'N/A'}",
        f"Status          : {status_label}",
        "",
        "==============================",
        "PACE & RECOMMENDATION",
        "==============================",
    ]

    if daily_required is None:
        lines.append("Required pace   : N/A")
    else:
        lines.append(f"Required pace   : ~₹{int(daily_required)}/day")
        lines.append(f"Monthly pace    : ~₹{int(monthly_required)}/month")

    lines += [
        "",
        "==============================",
        "RECENT CONTRIBUTIONS SUMMARY",
        "==============================",
        f"Last 7 days  : {c7_count} contributions | Total ₹{int(c7_total)} | Last on {c7_last or '-'}",
        f"Last 30 days : {c30_count} contributions | Total ₹{int(c30_total)} | Last on {c30_last or '-'}",
        "",
    ]

    if extra_lines:
        lines += [
            "==============================",
            "NOTE",
            "==============================",
            *extra_lines,
            "",
        ]

    lines += [
        "Regards,",
        "Finance App",
    ]

    return "\n".join(lines)


def send_contribution_added(goal: SavingsGoal, added_amount: Decimal):
    user = goal.user
    if not getattr(user, "email", None):
        return

    # unique per day + goal + amount
    key = f"CONTRIB_{timezone.localdate().isoformat()}_{goal.id}_{int(added_amount)}"
    if _already_sent(user, goal, key):
        return

    subject = f'Savings updated: ₹{int(added_amount)} added to "{goal.name}"'
    headline = "New saving added successfully."
    extra = [f"Added Amount: ₹{int(added_amount)}"]

    body = build_detailed_body(goal, headline=headline, extra_lines=extra)

    try:
        send_mail(subject, body, None, [user.email])
        _log(user, goal, key, meta={"type": "contribution_added", "added": float(added_amount)})
    except Exception as e:
        _log(user, goal, key, meta={"error": str(e)}, status="failed")


def maybe_send_thresholds(goal: SavingsGoal):
    user = goal.user
    if not getattr(user, "email", None):
        return

    _, _, _, pct, _ = goal_stats(goal)

    for threshold in (80, 90):
        key = f"PROGRESS_{threshold}"
        if pct >= threshold and not _already_sent(user, goal, key):
            subject = f'You crossed {threshold}% on "{goal.name}"'
            headline = f"You crossed the {threshold}% milestone."
            extra = [f"Milestone reached: {threshold}%", f"Current progress: {pct}%"]

            body = build_detailed_body(goal, headline=headline, extra_lines=extra)

            try:
                send_mail(subject, body, None, [user.email])
                _log(user, goal, key, meta={"pct": pct, "threshold": threshold})
            except Exception as e:
                _log(user, goal, key, meta={"error": str(e)}, status="failed")


def send_goal_achieved(goal: SavingsGoal):
    user = goal.user
    if not getattr(user, "email", None):
        return

    key = "GOAL_ACHIEVED"
    if _already_sent(user, goal, key):
        return

    subject = f'Congratulations! You achieved "{goal.name}"'
    headline = "Congratulations! Your savings goal is achieved."
    extra = [
        "This goal is now completed.",
        f"Achieved Date: {timezone.localdate().isoformat()}",
    ]

    body = build_detailed_body(goal, headline=headline, extra_lines=extra)

    try:
        send_mail(subject, body, None, [user.email])
        _log(user, goal, key, meta={"saved": float(goal.saved_amount or 0)})
    except Exception as e:
        _log(user, goal, key, meta={"error": str(e)}, status="failed")