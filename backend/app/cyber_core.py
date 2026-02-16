import feedparser
import requests
import hashlib
import json
from datetime import datetime, timezone
from dateutil import parser as dateparser
from jinja2 import Template

# ---------------- CONFIG IMPORT ---------------- #
from app.cyber_config import (
    OLLAMA_URL, OLLAMA_MODEL,
    FROM_EMAIL, TO_EMAILS, MONTH
)

from app.cyber_sources import RSS_FEEDS, CISA_KEV_URL

# ---------------- FETCH RSS ---------------- #
def fetch_rss():
    articles = []
    for source, url in RSS_FEEDS.items():
        feed = feedparser.parse(url)
        for entry in feed.entries:
            published = entry.get("published")
            dt = dateparser.parse(published) if published else datetime.now(timezone.utc)
            articles.append({
                "title": entry.get("title", ""),
                "summary": entry.get("summary", ""),
                "link": entry.get("link", "#"),
                "date": dt.strftime("%Y-%m-%d"),
                "source": source,
                "type": "news"
            })
    return articles

# ---------------- FETCH CISA KEV ---------------- #
def fetch_cisa_kev():
    try:
        data = requests.get(CISA_KEV_URL, timeout=15).json()
    except Exception:
        data = {"vulnerabilities": []}

    vulns = []
    for v in data.get("vulnerabilities", []):
        vulns.append({
            "title": f"CVE {v['cveID']} Actively Exploited",
            "summary": v.get("shortDescription", ""),
            "date": dateparser.parse(v["dateAdded"]).strftime("%Y-%m-%d"),
            "source": "CISA KEV",
            "link": f"https://cve.mitre.org/cgi-bin/cvename.cgi?name={v['cveID']}",
            "type": "vulnerability"
        })
    return vulns

# ---------------- NORMALIZATION ---------------- #
def normalize(items):
    normalized = {}
    for item in items:
        key = hashlib.sha256((item["title"] + item["source"]).encode()).hexdigest()
        normalized[key] = item
    return list(normalized.values())

# ---------------- AGGREGATION ---------------- #
def aggregate(items):
    incidents = []
    vulns = []

    for i in items:
        if i["type"] == "vulnerability":
            vulns.append(i)
        else:
            incidents.append(i)

    return {
        "month": MONTH,
        "major_incidents": incidents[:10],
        "critical_vulnerabilities": vulns[:10],
        "total_incidents": len(incidents),
        "total_vulns": len(vulns)
    }

# ---------------- OLLAMA SUMMARIES ---------------- #
def generate_summaries(data):
    """AI-free summarization: reuse source summaries and lightly truncate. Ollama call is commented for later re-enable."""

    def truncate_text(item, limit=280):
        text = (item.get("summary") or item.get("title") or "").strip()
        return (text[:limit].rstrip() + "...") if len(text) > limit else text

    major_incidents = [
        {**incident, "summary": truncate_text(incident)}
        for incident in data.get("major_incidents", [])
    ]
    critical_vulnerabilities = [
        {**vuln, "summary": truncate_text(vuln)}
        for vuln in data.get("critical_vulnerabilities", [])
    ]

    # --- Ollama request (disabled for AI-free mode) ---
    # prompt = f"""
    # You are a cybersecurity analyst.
    # For the following data, generate concise 1-2 sentence summaries for each item.
    # Do not hallucinate, use clear, simple professional language.
    # Output as JSON like:
    # {{
    #     "major_incidents": [{{"title": "...", "summary": "..."}}],
    #     "critical_vulnerabilities": [{{"title": "...", "summary": "..."}}]
    # }}
    #
    # DATA:
    # {json.dumps(data, indent=2)}
    # """
    #
    # payload = {
    #     "model": OLLAMA_MODEL,
    #     "prompt": prompt,
    #     "stream": False
    # }
    #
    # r = requests.post(OLLAMA_URL, json=payload, timeout=300)
    # response = r.json()["response"]
    #
    # try:
    #     summaries = json.loads(response)
    # except Exception:
    #     summaries = {
    #         "major_incidents": major_incidents,
    #         "critical_vulnerabilities": critical_vulnerabilities
    #     }
    #     return summaries

    return {
        "major_incidents": major_incidents,
        "critical_vulnerabilities": critical_vulnerabilities
    }

# ---------------- MERGE SUMMARIES WITH METADATA ---------------- #
def merge_with_metadata(original_list, summary_list):
    merged = []
    for i, s in zip(original_list, summary_list):
        merged.append({
            "title": s.get("title", i["title"]),
            "summary": s.get("summary", i["summary"]),
            "source": i.get("source", ""),
            "date": i.get("date", ""),
            "link": i.get("link", "#")
        })
    return merged
