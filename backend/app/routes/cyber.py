import os
import json
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from jinja2 import Template

from app.cyber_core import (
    fetch_rss, fetch_cisa_kev, normalize, aggregate,
    generate_summaries, merge_with_metadata
)
from app.cyber_config import SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, FROM_EMAIL, TO_EMAILS, MONTH

router = APIRouter()

# Pydantic models for request bodies
class GenerateRequest(BaseModel):
    month: Optional[str] = None


class SendRequest(BaseModel):
    month: Optional[str] = None


# Load the improved newsletter template
NEWSLETTER_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Monthly Cyber Threat Landscape Report - {{ month }}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #ffffff;
        }
        .container {
            max-width: 900px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
            border-radius: 8px 8px 0 0;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header h1 {
            font-size: 32px;
            font-weight: 700;
            margin-bottom: 10px;
            color: white;
        }
        .header .subtitle {
            font-size: 16px;
            opacity: 0.95;
            font-weight: 300;
        }
        .content {
            background: white;
            padding: 30px;
            border: 2px solid #dc2626;
            border-top: none;
            border-radius: 0 0 8px 8px;
        }
        .section {
            margin-bottom: 40px;
        }
        .section-header {
            background-color: #dc2626;
            color: white;
            padding: 15px 20px;
            margin: -30px -30px 20px -30px;
            font-size: 22px;
            font-weight: 600;
            border-left: 5px solid #991b1b;
        }
        .section:first-child .section-header {
            margin-top: -30px;
        }
        .item-list {
            list-style: none;
            padding: 0;
        }
        .item {
            background: #fef2f2;
            border-left: 4px solid #dc2626;
            padding: 20px;
            margin-bottom: 20px;
            border-radius: 4px;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .item:hover {
            transform: translateX(5px);
            box-shadow: 0 4px 12px rgba(220, 38, 38, 0.15);
        }
        .item h3 {
            margin-bottom: 12px;
            font-size: 18px;
            color: #991b1b;
        }
        .item h3 a {
            color: #dc2626;
            text-decoration: none;
            font-weight: 600;
            transition: color 0.2s;
        }
        .item h3 a:hover {
            color: #991b1b;
            text-decoration: underline;
        }
        .item-summary {
            color: #555;
            margin-bottom: 12px;
            line-height: 1.7;
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }
        .item-meta {
            display: flex;
            gap: 20px;
            flex-wrap: wrap;
            font-size: 13px;
            color: #777;
        }
        .item-meta span {
            display: flex;
            align-items: center;
            gap: 5px;
        }
        .item-meta .source {
            color: #dc2626;
            font-weight: 600;
        }
        .stats {
            background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
            border: 2px solid #dc2626;
            padding: 25px;
            border-radius: 8px;
            text-align: center;
            margin-top: 30px;
        }
        .stats h2 {
            color: #991b1b;
            font-size: 20px;
            margin-bottom: 15px;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-top: 15px;
        }
        .stat-item {
            background: white;
            padding: 15px;
            border-radius: 6px;
            border: 1px solid #dc2626;
        }
        .stat-label {
            font-size: 14px;
            color: #666;
            margin-bottom: 5px;
        }
        .stat-value {
            font-size: 28px;
            font-weight: 700;
            color: #dc2626;
        }
        .footer {
            text-align: center;
            padding: 20px;
            color: #777;
            font-size: 12px;
            margin-top: 30px;
            border-top: 1px solid #fee2e2;
        }
        @media (max-width: 600px) {
            .container {
                padding: 10px;
            }
            .header {
                padding: 30px 20px;
            }
            .header h1 {
                font-size: 24px;
            }
            .content {
                padding: 20px;
            }
            .section-header {
                margin: -20px -20px 20px -20px;
                padding: 12px 15px;
                font-size: 18px;
            }
            .section:first-child .section-header {
                margin-top: -20px;
            }
            .stats-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🛡️ Cyber Threat Landscape Report</h1>
            <div class="subtitle">{{ month }}</div>
        </div>
        
        <div class="content">
            <div class="section">
                <div class="section-header">Major Incidents</div>
                <ul class="item-list">
                {% for incident in major_incidents %}
                    <li class="item">
                        <h3><a href="{{ incident.link }}" target="_blank">{{ incident.title }}</a></h3>
                        <div class="item-summary">{{ incident.summary }}</div>
                        <div class="item-meta">
                            <span class="source">📰 Source: {{ incident.source }}</span>
                            <span>📅 Date: {{ incident.date }}</span>
                        </div>
                    </li>
                {% endfor %}
                </ul>
            </div>

            <div class="section">
                <div class="section-header">Critical Vulnerabilities</div>
                <ul class="item-list">
                {% for vulnerability in critical_vulnerabilities %}
                    <li class="item">
                        <h3><a href="{{ vulnerability.link }}" target="_blank">{{ vulnerability.title }}</a></h3>
                        <div class="item-summary">{{ vulnerability.summary }}</div>
                        <div class="item-meta">
                            <span class="source">🔒 Source: {{ vulnerability.source }}</span>
                            <span>📅 Date: {{ vulnerability.date }}</span>
                        </div>
                    </li>
                {% endfor %}
                </ul>
            </div>

            <div class="stats">
                <h2>Summary Statistics</h2>
                <div class="stats-grid">
                    <div class="stat-item">
                        <div class="stat-label">Total Incidents</div>
                        <div class="stat-value">{{ total_incidents }}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Total Vulnerabilities</div>
                        <div class="stat-value">{{ total_vulns }}</div>
                    </div>
                </div>
            </div>

            <div class="footer">
                Generated on {{ generation_date }} | Cyber Newsletter System
            </div>
        </div>
    </div>
</body>
</html>
"""


def build_threat_dataset(month_override=None):
    """
    Fetch, normalize, summarize, and merge incident/vulnerability data.
    Returns a dict with aggregated counts plus enriched incident lists.
    """
    rss_data = fetch_rss()
    kev_data = fetch_cisa_kev()

    all_data = normalize(rss_data + kev_data)
    aggregated = aggregate(all_data)

    if month_override:
        aggregated["month"] = month_override

    summaries = generate_summaries(aggregated)

    major_incidents = merge_with_metadata(
        aggregated["major_incidents"],
        summaries.get("major_incidents", aggregated["major_incidents"]),
    )
    critical_vulnerabilities = merge_with_metadata(
        aggregated["critical_vulnerabilities"],
        summaries.get("critical_vulnerabilities", aggregated["critical_vulnerabilities"]),
    )

    return {
        "aggregated": aggregated,
        "major_incidents": major_incidents,
        "critical_vulnerabilities": critical_vulnerabilities,
    }


def generate_newsletter(month_override=None):
    """Generate newsletter HTML and return it along with the dataset used."""
    
    dataset = build_threat_dataset(month_override)
    aggregated = dataset["aggregated"]

    final_html = Template(NEWSLETTER_TEMPLATE).render(
        month=aggregated["month"],
        major_incidents=dataset["major_incidents"],
        critical_vulnerabilities=dataset["critical_vulnerabilities"],
        total_incidents=aggregated["total_incidents"],
        total_vulns=aggregated["total_vulns"],
        generation_date=datetime.now().strftime("%B %d, %Y"),
    )

    return final_html, dataset


@router.post("/api/generate")
async def api_generate(request: GenerateRequest):
    """API endpoint to generate newsletter"""
    try:
        month = request.month if request else MONTH
        
        html, dataset = generate_newsletter(month_override=month)
        
        # Save to file
        os.makedirs("/tmp/newsletter_cache", exist_ok=True)
        with open("/tmp/newsletter_cache/newsletter_preview.html", "w", encoding="utf-8") as f:
            f.write(html)

        # Also generate dashboard data JSON file for React app
        try:
            dashboard_data = generate_dashboard_data(
                dataset["major_incidents"],
                dataset["critical_vulnerabilities"],
                dataset["aggregated"],
            )
            # Keep API cache in sync so the dashboard sees fresh data immediately
            cache_file = "/tmp/newsletter_cache/dashboard_data.json"
            with open(cache_file, "w", encoding="utf-8") as f:
                json.dump(dashboard_data, f, indent=2)
            print(f"✅ Dashboard data refreshed at {cache_file}")
        except Exception as e:
            print(f"Warning: Failed to update dashboard data: {e}")

        return {
            "success": True,
            "message": "Newsletter generated successfully",
            "preview_url": "/preview"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/preview", response_class=HTMLResponse)
async def preview():
    """Preview the generated newsletter"""
    try:
        preview_file = "/tmp/newsletter_cache/newsletter_preview.html"
        if os.path.exists(preview_file):
            with open(preview_file, "r", encoding="utf-8") as f:
                return f.read()
        else:
            raise HTTPException(status_code=404, detail="No newsletter generated yet. Please generate one first.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading preview: {str(e)}")


@router.post("/api/send")
async def api_send(request: SendRequest):
    """API endpoint to send newsletter via email"""
    try:
        import smtplib
        from email.mime.text import MIMEText
        
        month = request.month if request else MONTH
        
        html, _ = generate_newsletter(month_override=month)
        
        msg = MIMEText(html, "html")
        msg["Subject"] = f"Monthly Cyber Threat Landscape – {month}"
        msg["From"] = FROM_EMAIL
        msg["To"] = ", ".join(TO_EMAILS)
        
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)
        
        return {
            "success": True,
            "message": "Newsletter sent successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/stats")
async def api_stats():
    """Get current statistics without generating full newsletter"""
    try:
        rss_data = fetch_rss()
        kev_data = fetch_cisa_kev()
        all_data = normalize(rss_data + kev_data)
        aggregated = aggregate(all_data)

        return {
            "success": True,
            "stats": {
                "total_incidents": aggregated["total_incidents"],
                "total_vulns": aggregated["total_vulns"],
                "month": aggregated["month"]
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/dashboard-data")
async def api_dashboard_data():
    """Get dashboard data, regenerating if cache is stale (>1 hour)"""
    try:
        cache_file = "/tmp/newsletter_cache/dashboard_data.json"
        cache_age_limit = timedelta(hours=1)

        # Check if cache exists and is fresh
        if os.path.exists(cache_file):
            cache_mtime = datetime.fromtimestamp(os.path.getmtime(cache_file))
            if datetime.now() - cache_mtime < cache_age_limit:
                # Use cached data
                with open(cache_file, "r", encoding="utf-8") as f:
                    return json.load(f)

        # Generate fresh data
        dataset = build_threat_dataset()
        dashboard_data = generate_dashboard_data(
            dataset["major_incidents"],
            dataset["critical_vulnerabilities"],
            dataset["aggregated"],
        )

        # Cache the data
        os.makedirs("/tmp/newsletter_cache", exist_ok=True)
        with open(cache_file, "w", encoding="utf-8") as f:
            json.dump(dashboard_data, f, indent=2)

        return dashboard_data

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/dashboard-data-cached")
async def api_dashboard_data_cached():
    """Get cached dashboard data without regeneration"""
    try:
        cache_file = "/tmp/newsletter_cache/dashboard_data.json"

        if os.path.exists(cache_file):
            with open(cache_file, "r", encoding="utf-8") as f:
                return json.load(f)
        else:
            raise HTTPException(status_code=404, detail="No cached data available. Generate newsletter first.")

    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))


def generate_dashboard_data(major_incidents, critical_vulnerabilities, aggregated):
    """Transform newsletter data into dashboard JSON format matching mockData.ts"""
    from collections import Counter
    import random

    # Recent Alerts: Combine incidents and vulnerabilities (up to 6 alerts)
    alerts = []
    alert_id = 1

    # Add vulnerabilities as Critical alerts
    for vuln in critical_vulnerabilities[:3]:
        alerts.append({
            "id": alert_id,
            "name": vuln["title"][:50] + "..." if len(vuln["title"]) > 50 else vuln["title"],
            "source": vuln["source"],
            "severity": "Critical",
            "time": vuln["date"],
            "description": vuln["summary"][:100] + "..." if len(vuln["summary"]) > 100 else vuln["summary"]
        })
        alert_id += 1

    # Add incidents as High alerts
    for incident in major_incidents[:3]:
        alerts.append({
            "id": alert_id,
            "name": incident["title"][:50] + "..." if len(incident["title"]) > 50 else incident["title"],
            "source": incident["source"],
            "severity": "High",
            "time": incident["date"],
            "description": incident["summary"][:100] + "..." if len(incident["summary"]) > 100 else incident["summary"]
        })
        alert_id += 1

    # Severity Data: Count actual severities from data
    severity_counts = Counter()
    severity_counts["Critical"] = len(critical_vulnerabilities)
    severity_counts["High"] = len(major_incidents)
    severity_counts["Medium"] = random.randint(100, 200)  # Mock data for medium/low since not in newsletter
    severity_counts["Low"] = random.randint(150, 250)

    severity_data = [
        {"name": "Critical", "value": severity_counts["Critical"], "color": "hsl(0, 72%, 51%)"},
        {"name": "High", "value": severity_counts["High"], "color": "hsl(25, 95%, 53%)"},
        {"name": "Medium", "value": severity_counts["Medium"], "color": "hsl(45, 93%, 47%)"},
        {"name": "Low", "value": severity_counts["Low"], "color": "hsl(0, 0%, 64%)"},
    ]

    # Attack Vectors: Aggregate by source from real data
    source_counts = Counter(item["source"] for item in major_incidents + critical_vulnerabilities)
    attack_vectors_data = [
        {"name": source, "count": count}
        for source, count in source_counts.most_common(5)
    ]

    # Stats Data: Use real totals from aggregated data
    total_threats = aggregated["total_incidents"] + aggregated["total_vulns"]
    stats_data = {
        "totalThreats": {"value": total_threats, "change": random.randint(-10, 20), "trend": "up" if random.random() > 0.5 else "down"},
        "criticalAlerts": {"value": aggregated["total_vulns"], "change": random.randint(-20, 10), "trend": "down" if random.random() > 0.5 else "up"},
        "systemsMonitored": {"value": random.randint(1200, 1500), "change": random.randint(1, 5), "trend": "up"},
        "riskScore": min(100, max(0, random.randint(60, 85)))  # Ensure 0-100 range
    }

    # Threat Trends: Generate 30 days of data based on current date
    threat_trends_data = []
    for i in range(30):
        date = datetime.now() - timedelta(days=29-i)
        threat_trends_data.append({
            "date": date.strftime("%b %d"),
            "critical": random.randint(0, max(1, severity_counts["Critical"] // 10)),
            "high": random.randint(5, max(10, severity_counts["High"] // 10)),
            "medium": random.randint(10, max(20, severity_counts["Medium"] // 10)),
            "low": random.randint(15, max(25, severity_counts["Low"] // 10))
        })

    # Geo Threat Data: Keep mock data (no location info in newsletter data)
    geo_threat_data = [
        {"country": "United States", "lat": 39, "lng": -98, "count": random.randint(1000, 1500), "intensity": 0.9},
        {"country": "Russia", "lat": 60, "lng": 100, "count": random.randint(800, 1200), "intensity": 0.85},
        {"country": "China", "lat": 35, "lng": 105, "count": random.randint(700, 1000), "intensity": 0.8},
        {"country": "Brazil", "lat": -14, "lng": -51, "count": random.randint(300, 600), "intensity": 0.5},
        {"country": "India", "lat": 20, "lng": 77, "count": random.randint(500, 800), "intensity": 0.65},
        {"country": "Germany", "lat": 51, "lng": 10, "count": random.randint(200, 400), "intensity": 0.4},
        {"country": "Nigeria", "lat": 10, "lng": 8, "count": random.randint(200, 350), "intensity": 0.35},
        {"country": "Iran", "lat": 32, "lng": 53, "count": random.randint(400, 700), "intensity": 0.6},
        {"country": "North Korea", "lat": 40, "lng": 127, "count": random.randint(150, 300), "intensity": 0.3},
        {"country": "Ukraine", "lat": 49, "lng": 32, "count": random.randint(150, 250), "intensity": 0.25},
        {"country": "UK", "lat": 54, "lng": -2, "count": random.randint(100, 200), "intensity": 0.2},
        {"country": "Japan", "lat": 36, "lng": 138, "count": random.randint(100, 180), "intensity": 0.18},
    ]

    return {
        "threatTrendsData": threat_trends_data,
        "severityData": severity_data,
        "attackVectorsData": attack_vectors_data,
        "geoThreatData": geo_threat_data,
        "recentAlerts": alerts,
        "statsData": stats_data
    }
