#!/usr/bin/env python
"""
Local locking API smoke test (no production deploy needed).

Prerequisites:
  1. From the backend folder: python manage.py runserver 127.0.0.1:8000
  2. Two active accounts that can hit the chosen endpoint (admins are simplest).
  3. At least one row in the target table (script picks the first monthly work entry).

Usage (PowerShell):
  $env:LOCK_TEST_EMAIL_A="admin1@example.com"
  $env:LOCK_TEST_EMAIL_B="admin2@example.com"
  $env:LOCK_TEST_PASSWORD="shared-or-per-user-password"
  python test_locking.py

Optional:
  LOCK_TEST_ENTRY_ID=5   — force a specific monthly-work-entries id
  LOCK_TEST_BASE=http://127.0.0.1:8000/api

Locking is exposed on:
  POST   /api/monthly-work-entries/{id}/lock/
  POST   /api/monthly-work-entries/{id}/unlock/
  GET    /api/monthly-work-entries/{id}/lock-status/
  (same pattern under /api/timesheets/{id}/... and /api/client-resources/{id}/...)
"""
from __future__ import annotations

import os
import sys
from typing import Any

import requests

BASE = os.environ.get("LOCK_TEST_BASE", "http://127.0.0.1:8000/api").rstrip("/")
EMAIL_A = os.environ.get("LOCK_TEST_EMAIL_A", "").strip()
EMAIL_B = os.environ.get("LOCK_TEST_EMAIL_B", "").strip()
PASSWORD = os.environ.get("LOCK_TEST_PASSWORD", "").strip()
ENTRY_ID = os.environ.get("LOCK_TEST_ENTRY_ID", "").strip()


def token_for(email: str) -> str | None:
    r = requests.post(
        f"{BASE}/auth/token/",
        json={"email": email, "password": PASSWORD},
        timeout=15,
    )
    if r.status_code != 200:
        print(f"❌ Auth failed for {email}: {r.status_code} {r.text[:500]}")
        return None
    return r.json().get("access")


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def first_monthly_entry_id(token: str) -> int | None:
    if ENTRY_ID:
        return int(ENTRY_ID)
    r = requests.get(f"{BASE}/monthly-work-entries/", headers=auth_headers(token), timeout=15)
    if r.status_code != 200:
        print(f"❌ Cannot list monthly-work-entries: {r.status_code} {r.text[:400]}")
        return None
    data = r.json()
    rows = data if isinstance(data, list) else data.get("results") or []
    if not rows:
        print("❌ No monthly work entries in DB — create one in the UI first.")
        return None
    return int(rows[0]["id"])


def post_lock(entry_id: int, token: str, who: str) -> tuple[int, dict[str, Any]]:
    r = requests.post(
        f"{BASE}/monthly-work-entries/{entry_id}/lock/",
        headers=auth_headers(token),
        timeout=15,
    )
    try:
        body = r.json()
    except Exception:
        body = {}
    print(f"  [{who}] POST lock → {r.status_code} {body}")
    return r.status_code, body


def post_unlock(entry_id: int, token: str, who: str) -> None:
    r = requests.post(
        f"{BASE}/monthly-work-entries/{entry_id}/unlock/",
        headers=auth_headers(token),
        timeout=15,
    )
    try:
        body = r.json()
    except Exception:
        body = {}
    print(f"  [{who}] POST unlock → {r.status_code} {body}")


def main() -> int:
    print("\n🔒 Local locking API test")
    print(f"   Base: {BASE}\n")

    if not EMAIL_A or not PASSWORD:
        print("Set LOCK_TEST_EMAIL_A and LOCK_TEST_PASSWORD (and LOCK_TEST_EMAIL_B for contention).")
        return 1

    ta = token_for(EMAIL_A)
    if not ta:
        return 1

    eid = first_monthly_entry_id(ta)
    if eid is None:
        return 1

    print(f"Using monthly-work-entries id={eid}\n")

    # A acquires
    code, _ = post_lock(eid, ta, "A")
    if code != 200:
        print("❌ Expected 200 first lock")
        return 1

    # Second user: same account cannot prove contention; need B
    if EMAIL_B and EMAIL_B.lower() != EMAIL_A.lower():
        tb = token_for(EMAIL_B)
        if not tb:
            return 1
        code_b, body_b = post_lock(eid, tb, "B")
        if code_b != 423:
            print("❌ Expected 423 when B locks while A holds lock")
            return 1
        if "lock" not in body_b and "error" not in body_b:
            print("⚠️  Unexpected body shape (still might be OK)")
    else:
        print("  (Skip B-vs-A: set LOCK_TEST_EMAIL_B to a different user for contention test.)\n")

    post_unlock(eid, ta, "A")
    print("\n✅ Done. If two users were configured, B was correctly denied then A released.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect — start the API: python manage.py runserver 127.0.0.1:8000")
        sys.exit(1)
