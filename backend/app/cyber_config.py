import os
from dotenv import load_dotenv

load_dotenv()

def get_env(name, required=True, default=None):
    value = os.getenv(name, default)
    if required and not value:
        raise RuntimeError(f"Missing required env var: {name}")
    return value

# Ollama settings are optional now so the app can run AI-free
OLLAMA_URL = get_env("OLLAMA_URL", required=False, default=None)
OLLAMA_MODEL = get_env("OLLAMA_MODEL", required=False, default=None)

SMTP_HOST = get_env("SMTP_HOST", required=False, default="smtp.gmail.com")
SMTP_PORT = int(get_env("SMTP_PORT", required=False, default="587"))
SMTP_USER = get_env("SMTP_USER", required=False, default="")
SMTP_PASS = get_env("SMTP_PASS", required=False, default="")

FROM_EMAIL = get_env("FROM_EMAIL", required=False, default="noreply@be4breach.com")
TO_EMAILS = get_env("TO_EMAILS", required=False, default="admin@be4breach.com").split(",")

MONTH = get_env("NEWSLETTER_MONTH", required=False, default="February 2026")
