from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase


class LoginWarningTests(APITestCase):
    token_url = "/api/auth/token/"

    def test_unknown_email_returns_email_warning(self):
        response = self.client.post(
            self.token_url,
            {"email": "missing@example.com", "password": "AnyPass123!"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)
        self.assertNotIn("password", response.data)

    def test_inactive_email_returns_account_warning(self):
        get_user_model().objects.create_user(
            username="inactive@example.com",
            email="inactive@example.com",
            password="CorrectPass123!",
            is_active=False,
        )

        response = self.client.post(
            self.token_url,
            {"email": "inactive@example.com", "password": "CorrectPass123!"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)
        self.assertNotIn("password", response.data)

    def test_existing_email_with_wrong_password_returns_password_warning(self):
        get_user_model().objects.create_user(
            username="approved@example.com",
            email="approved@example.com",
            password="CorrectPass123!",
            is_active=True,
        )

        response = self.client.post(
            self.token_url,
            {"email": "approved@example.com", "password": "WrongPass123!"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.data)
        self.assertNotIn("email", response.data)
