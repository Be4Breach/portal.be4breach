================================================================
Be4Breach — EC2 Server Management Cheat Sheet
Server : api.be4breach.com
App : FastAPI (uvicorn) via systemd → be4breach.service
Proxy : Nginx
DB : MongoDB Atlas (remote)
================================================================

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SSH INTO EC2
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ssh -i "be4breach-key.pem" ubuntu@api.be4breach.com

# Or by IP (if DNS is down):

ssh -i "be4breach-key.pem" ubuntu@15.206.82.152

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BACKEND SERVICE (be4breach)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

sudo systemctl start be4breach # Start the backend
sudo systemctl stop be4breach # Stop the backend
sudo systemctl restart be4breach # Restart (after code changes)
sudo systemctl status be4breach # Check if running

# View live logs (Ctrl+C to exit)

sudo journalctl -u be4breach -f

# View last 100 lines of logs

sudo journalctl -u be4breach -n 100

# View logs since last restart

sudo journalctl -u be4breach --since "today"

# Clear old logs (if disk is filling up)

sudo journalctl --vacuum-time=7d

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEPLOY CODE UPDATES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

cd ~/portal.be4breach

# Pull latest code from GitHub

git pull

# If requirements.txt changed (new packages added):

cd backend
source venv/bin/activate
pip install -r requirements.txt
deactivate

# Restart backend to apply changes

sudo systemctl restart be4breach

# Confirm it's running after update

sudo systemctl status be4breach

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NGINX
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

sudo systemctl start nginx # Start nginx
sudo systemctl stop nginx # Stop nginx
sudo systemctl restart nginx # Restart nginx
sudo systemctl reload nginx # Reload config WITHOUT downtime ✅
sudo systemctl status nginx # Check if running

# Test config before applying (always do this first!)

sudo nginx -t

# Edit nginx config

sudo nano /etc/nginx/sites-available/be4breach

# After editing config — test then reload

sudo nginx -t && sudo systemctl reload nginx

# View nginx error logs (live)

sudo tail -f /var/log/nginx/error.log

# View nginx access logs (live)

sudo tail -f /var/log/nginx/access.log

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SSL CERTIFICATE (Let's Encrypt)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Check certificate expiry date

sudo certbot certificates

# Manually renew (auto-renews via cron, but use this to force)

sudo certbot renew

# Test renewal process (dry run — no actual changes)

sudo certbot renew --dry-run

# Cert auto-renewal timer status

sudo systemctl status certbot.timer

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ENVIRONMENT VARIABLES (.env)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Edit .env

nano ~/portal.be4breach/backend/.env

# After editing .env → MUST restart backend to apply changes

sudo systemctl restart be4breach

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SERVER HEALTH CHECKS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Test backend directly (internal)

curl http://localhost:8000/

# Test via domain (public)

curl https://api.be4breach.com/

# Test API docs are accessible

curl -I https://api.be4breach.com/docs

# Check DNS resolves correctly

nslookup api.be4breach.com

# Check what's running on port 8000

sudo ss -tlnp | grep 8000

# Check what's running on port 80 and 443

sudo ss -tlnp | grep -E '80|443'

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DISK & MEMORY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Disk usage (overall)

df -h

# Disk usage by folder (top-level)

du -sh ~/portal.be4breach/\*

# RAM usage

free -h

# CPU + RAM live monitor (q to quit)

htop

# Check for leftover semgrep temp scan folders

ls /tmp/be4breach*scan*\* 2>/dev/null

# Delete leftover temp scan folders manually (if any)

rm -rf /tmp/be4breach*scan*\*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SYSTEM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Reboot server (services auto-restart via systemd enable)

sudo reboot

# After reboot — verify services came back up

sudo systemctl status be4breach
sudo systemctl status nginx

# Update Ubuntu packages

sudo apt update && sudo apt upgrade -y

# Check server uptime

uptime

# Check all enabled services

sudo systemctl list-units --type=service --state=running

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUICK TROUBLESHOOTING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PROBLEM: curl http://localhost:8000 returns nothing
─────────────────────────────────────────────────
sudo systemctl status be4breach
sudo journalctl -u be4breach -n 50
→ Look for Python errors in the log

PROBLEM: curl https://api.be4breach.com fails
─────────────────────────────────────────────
sudo systemctl status nginx
sudo nginx -t
sudo tail -f /var/log/nginx/error.log

PROBLEM: 502 Bad Gateway from nginx
─────────────────────────────────────────────
→ Backend is down. Fix:
sudo systemctl restart be4breach
sudo systemctl status be4breach

PROBLEM: SSL certificate expired
─────────────────────────────────────────────
sudo certbot renew
sudo systemctl reload nginx

PROBLEM: Server ran out of disk space
─────────────────────────────────────────────
df -h
sudo journalctl --vacuum-time=3d # Clear old logs
rm -rf /tmp/be4breach*scan*\* # Clear old scan temp dirs

PROBLEM: Backend crashes during semgrep scan (OOM)
─────────────────────────────────────────────
free -h # Check RAM
→ If t3.small RAM is full, add swap:
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

================================================================
