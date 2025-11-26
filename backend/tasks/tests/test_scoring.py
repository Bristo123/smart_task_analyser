from django.test import TestCase
from tasks.scoring import score_task


class ScoringAlgorithmTests(TestCase):

    def test_low_priority(self):
        task = {"urgency": 1, "importance": 1}
        result = score_task(task)
        self.assertEqual(result, "LOW")

    def test_medium_priority(self):
        task = {"urgency": 3, "importance": 3}
        result = score_task(task)
        self.assertEqual(result, "MEDIUM")

    def test_high_priority(self):
        task = {"urgency": 5, "importance": 5}
        result = score_task(task)
        self.assertEqual(result, "HIGH")

    def test_deadline_boost(self):
        # This checks if your scoring boosts urgency when deadline is soon
        task = {
            "urgency": 2,
            "importance": 5,
            "deadline": "2025-11-28"
        }
        result = score_task(task)
        self.assertIn(result, ["HIGH", "CRITICAL"])  # depends on your logic