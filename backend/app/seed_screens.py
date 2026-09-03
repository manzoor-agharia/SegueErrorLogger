"""One-off seed script for the Screen lookup table.

Run after `alembic upgrade head`:
    python -m app.seed_screens
"""

import asyncio

from sqlalchemy import select

from app.db import SessionLocal
from app.models import Screen

SCREENS: list[tuple[str, str]] = [
    # Auth / Onboarding
    ("Login", "Auth / Onboarding"),
    ("Signup", "Auth / Onboarding"),
    ("Forgot Password", "Auth / Onboarding"),
    ("Reset Password", "Auth / Onboarding"),
    ("Magic Link Request", "Auth / Onboarding"),
    ("Magic Link Redeem", "Auth / Onboarding"),
    ("Change Password", "Auth / Onboarding"),
    ("MFA Setup Required", "Auth / Onboarding"),
    ("Set Password", "Auth / Onboarding"),
    ("Unauthorized", "Auth / Onboarding"),
    ("First-Run Super Admin Setup", "Auth / Onboarding"),
    # Dashboard
    ("Dashboard", "Dashboard"),
    # Workflow / Pipeline
    ("Workflow Builder (Pipeline Canvas)", "Workflow / Pipeline"),
    ("Workflows List", "Workflow / Pipeline"),
    # User Management
    ("User List", "User Management"),
    ("User Detail", "User Management"),
    ("Tenant List", "User Management"),
    ("Role List", "User Management"),
    ("Role Permissions Matrix", "User Management"),
    # User Account
    ("Profile", "User Account"),
    ("Account Settings", "User Account"),
    ("Security (My Account)", "User Account"),
    ("Preferences", "User Account"),
    ("Help", "User Account"),
    # Settings - General
    ("Branding Settings", "Settings - General"),
    ("EHR Endpoint List", "Settings - General"),
    ("Allowed CORS Origins", "Settings - General"),
    # Settings - Workflow Configurations
    ("Source Connection List", "Settings - Workflow Configurations"),
    ("Destination Connection List", "Settings - Workflow Configurations"),
    ("Mapping Profile List", "Settings - Workflow Configurations"),
    ("Transformation Rule List", "Settings - Workflow Configurations"),
    # Settings - System Settings
    ("Email Settings", "Settings - System Settings"),
    ("System Settings (General)", "Settings - System Settings"),
    ("App Secrets (System Security)", "Settings - System Settings"),
    ("SSO Configurations", "Settings - System Settings"),
    ("Terminology Codes - LOINC", "Settings - System Settings"),
    ("Terminology Codes - SNOMED CT", "Settings - System Settings"),
    ("Terminology Codes - RxNorm", "Settings - System Settings"),
    ("Terminology Codes - ICD-10", "Settings - System Settings"),
    ("Terminology Codes - ICD-10-PCS", "Settings - System Settings"),
    ("Terminology Codes - HCPCS", "Settings - System Settings"),
    ("Terminology Codes - NDC", "Settings - System Settings"),
    ("Terminology Codes - CVX", "Settings - System Settings"),
    ("Terminology Codes - UCUM", "Settings - System Settings"),
    ("Terminology Codes - CPT", "Settings - System Settings"),
    # Execution History
    ("Execution History List", "Execution History"),
    ("Execution History Detail", "Execution History"),
    # Execution Logs / Schedules / Reports / Configuration
    ("Execution Logs", "Execution Logs / Schedules / Reports"),
    ("Schedules", "Execution Logs / Schedules / Reports"),
    ("Reports", "Execution Logs / Schedules / Reports"),
    ("Configuration", "Execution Logs / Schedules / Reports"),
    # Governance
    ("Audit Logs", "Governance"),
    ("Authentication Logs", "Governance"),
    ("Configuration Comparison", "Governance"),
    ("Data Lineage", "Governance"),
    ("Alert Rules", "Governance"),
    ("Alerts", "Governance"),
    ("Authorization Logs", "Governance"),
    ("Archive", "Governance"),
    ("OAuth Logs", "Governance"),
    ("Log Settings", "Governance"),
    ("Data Access Logs", "Governance"),
    ("Security Events", "Governance"),
    ("Retention Policies", "Governance"),
    ("Compliance Reports", "Governance"),
    ("SMART Launch Logs", "Governance"),
    ("Correlation Search", "Governance"),
    # Operations
    ("System Health", "Operations"),
    ("Pipeline Execution List", "Operations"),
    ("Pipeline Execution Detail", "Operations"),
    ("Queue Monitor", "Operations"),
    ("API Analytics", "Operations"),
    ("Scheduler History", "Operations"),
    ("Retry History", "Operations"),
    ("Errors", "Operations"),
    ("API Requests", "Operations"),
    ("Exports", "Operations"),
    ("Notifications", "Operations"),
    ("Validation Failures", "Operations"),
    ("Endpoint Health", "Operations"),
]


async def seed() -> None:
    async with SessionLocal() as db:
        existing_names = set((await db.execute(select(Screen.name))).scalars().all())
        added = 0
        for name, category in SCREENS:
            if name in existing_names:
                continue
            db.add(Screen(name=name, category=category))
            added += 1
        await db.commit()
        print(f"Seeded {added} new screen(s); {len(SCREENS) - added} already present.")


if __name__ == "__main__":
    asyncio.run(seed())
