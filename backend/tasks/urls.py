from django.urls import path
from .views import analyze_tasks, suggest_tasks, feedback

urlpatterns = [
    path('analyze/', analyze_tasks),
    path('suggest/', suggest_tasks),
    path('feedback/', feedback),
]
