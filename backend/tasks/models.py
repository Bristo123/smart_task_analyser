from django.db import models

class Task(models.Model):
    title = models.CharField(max_length=255)
    due_date = models.DateField()
    estimated_hours = models.FloatField()
    importance = models.IntegerField()
    dependencies = models.JSONField(default=list)

    def __str__(self):
        return self.title
