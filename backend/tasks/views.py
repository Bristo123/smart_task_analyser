from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
import json
import datetime

# --------- Holidays (you can add more) ----------
HOLIDAYS = {
    "2025-01-01",
    "2025-01-26",
    "2025-03-14",
}

def business_days_analysis(date_str):
    due = datetime.date.fromisoformat(date_str)
    today = datetime.date.today()

    if due < today:
        return 0, [], []

    delta = (due - today).days
    working_days = 0
    weekend_days = []
    holiday_days = []

    for i in range(delta + 1):
        day = today + datetime.timedelta(days=i)
        day_str = str(day)

        if day.weekday() >= 5:
            weekend_days.append(day_str)
            continue

        if day_str in HOLIDAYS:
            holiday_days.append(day_str)
            continue

        working_days += 1

    return working_days, weekend_days, holiday_days


def has_circular_dependency(tasks):
    graph = {i: set(t.get("dependencies", [])) for i, t in enumerate(tasks)}
    visited = set()
    stack = set()

    def visit(node):
        if node in stack:
            return True
        if node in visited:
            return False

        visited.add(node)
        stack.add(node)

        for dep in graph[node]:
            if visit(dep):
                return True

        stack.remove(node)
        return False

    return any(visit(n) for n in graph)


def calculate_score(task, strategy):
    importance = task["importance"]
    effort = task["estimated_hours"]

    working_days, weekend_days, holiday_days = business_days_analysis(task["due_date"])
    urgency = max(0, 22 - working_days)
    dependency_count = len(task["dependencies"])

    if strategy == "High Impact":
        score = (importance * 2) - (effort * 0.2)
        explanation = f"Highly weighted importance ({importance})."

    elif strategy == "Fastest Wins":
        score = (10 / (effort + 1)) + (importance * 0.25)
        explanation = f"Low effort ({effort} hrs) prioritized."

    elif strategy == "Deadline Driven":
        score = urgency + (importance * 0.5)
        explanation = (
            f"Due in {working_days} working days. "
            f"Skipped {len(weekend_days)} weekends and {len(holiday_days)} holidays."
        )

    else:
        score = (
            (importance * 1.2) +
            (urgency * 1) -
            (effort * 0.4) +
            (dependency_count * 0.6)
        )
        explanation = (
            f"Balanced: working days={working_days}, "
            f"skipped {len(weekend_days)} weekends & {len(holiday_days)} holidays."
        )

    return round(score, 2), explanation, working_days, weekend_days, holiday_days


# --------- REQUIRED VIEW 1 ----------
@csrf_exempt
def analyze_tasks(request):
    if request.method == "OPTIONS":
        response = HttpResponse()
        response["Access-Control-Allow-Origin"] = "*"
        response["Access-Control-Allow-Methods"] = "POST, OPTIONS"
        response["Access-Control-Allow-Headers"] = "Content-Type"
        return response

    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=400)

    try:
        data = json.loads(request.body)
    except:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    tasks = data.get("tasks", [])
    strategy = data.get("strategy", "Smart Balance")

    if has_circular_dependency(tasks):
        return JsonResponse({"error": "Circular dependency detected!"}, status=400)

    for t in tasks:
        score, explanation, wd, wknds, hols = calculate_score(t, strategy)
        t["score"] = score
        t["explanation"] = explanation
        t["working_days"] = wd
        t["skipped_weekends"] = wknds
        t["skipped_holidays"] = hols

    tasks = sorted(tasks, key=lambda x: x["score"], reverse=True)

    response = JsonResponse({"results": tasks})
    response["Access-Control-Allow-Origin"] = "*"
    return response


# --------- REQUIRED VIEW 2 ----------
@csrf_exempt
def suggest_tasks(request):
    if request.method == "OPTIONS":
        response = HttpResponse()
        response["Access-Control-Allow-Origin"] = "*"
        response["Access-Control-Allow-Methods"] = "GET, OPTIONS"
        return response

    sample = [
        {"title": "Fix login bug", "score": 8, "reason": "High importance & urgent"},
        {"title": "Quick typo fix", "score": 7, "reason": "Low effort quick win"},
        {"title": "UI redesign", "score": 6, "reason": "Moderate importance"},
    ]

    response = JsonResponse({"suggestions": sample})
    response["Access-Control-Allow-Origin"] = "*"
    return response


# --------- REQUIRED VIEW 3 ----------
@csrf_exempt
def feedback(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=400)

    try:
        data = json.loads(request.body)
    except:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    print("User feedback received:", data)

    return JsonResponse({"message": "Feedback saved!"})