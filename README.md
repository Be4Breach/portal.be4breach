# Portal.be4breach - Merged with Cyber Dashboard

This project combines the Be4Breach portal with the Cyber Dashboard functionality.

## Project Structure

### Backend (`/backend`)

- **Authentication & Admin**: Original portal.be4breach authentication and admin routes
- **Cyber Dashboard**: Integrated cyber threat intelligence dashboard with:
  - RSS feed aggregation from security sources
  - CISA KEV (Known Exploited Vulnerabilities) integration
  - Newsletter generation
  - Dashboard data API endpoints

### Frontend (`/frontend`)

- **Cyber Dashboard UI**: Complete dashboard interface from cyber-dashboard
- **Dynamic User Profile**: JWT-based authentication with dynamic user information in navbar
- **Features**:
  - Real-time threat monitoring
  - Interactive charts and visualizations
  - Alert notifications
  - Threat intelligence reports

## Setup Instructions

### Backend Setup

1. Navigate to backend directory:

   ```bash
   cd backend
   ```

2. Create virtual environment (recommended):

   ```bash
   python -m venv venv
   # Windows
   venv\Scripts\activate
   # Linux/Mac
   source venv/bin/activate
   ```

3. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

4. Configure environment variables in `.env`:
   - MongoDB connection (required for auth)
   - SMTP settings (optional, for newsletter emails)
   - Ollama settings (optional, for AI summaries)

5. Run the backend:
   ```bash
   uvicorn app.main:app --reload
   ```
   Backend will be available at `http://localhost:8000`

### Frontend Setup

1. Navigate to frontend directory:

   ```bash
   cd frontend
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```
   Frontend will be available at `http://localhost:5173`

## API Endpoints

### Authentication Routes (`/api/auth/*`)

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user info

### Admin Routes (`/api/admin/*`)

- Admin-specific endpoints (requires admin role)

### Cyber Dashboard Routes

- `POST /api/generate` - Generate newsletter from threat data
- `GET /preview` - Preview generated newsletter
- `POST /api/send` - Send newsletter via email
- `GET /api/stats` - Get current threat statistics
- `GET /api/dashboard-data` - Get dashboard data (auto-refreshes if stale)
- `GET /api/dashboard-data-cached` - Get cached dashboard data

## Features

### Backend Features

1. **User Authentication**: JWT-based authentication with MongoDB
2. **Threat Intelligence**:
   - RSS feed aggregation from The Hacker News, BleepingComputer, KrebsOnSecurity
   - CISA KEV integration for actively exploited vulnerabilities
3. **Newsletter Generation**: HTML email newsletters with threat summaries
4. **Dashboard API**: Real-time threat data for frontend visualization

### Frontend Features

1. **Dynamic User Profile**:
   - Decodes JWT token to display user info
   - Shows user initials/name in navbar
   - Logout functionality
2. **Threat Dashboard**:
   - Interactive charts (threat trends, severity distribution)
   - Geographic threat visualization
   - Real-time alerts and notifications
3. **Responsive Design**: Works on desktop and mobile devices

## Environment Variables

### Required (Backend)

- `SECRET_KEY` - JWT secret key
- `MONGO_URI` - MongoDB connection string
- `CORS_ORIGINS` - Allowed CORS origins

### Optional (Backend - Cyber Dashboard)

- `OLLAMA_URL` - Ollama API URL (for AI summaries)
- `OLLAMA_MODEL` - Ollama model name
- `SMTP_HOST` - SMTP server host
- `SMTP_PORT` - SMTP server port
- `SMTP_USER` - SMTP username
- `SMTP_PASS` - SMTP password
- `FROM_EMAIL` - Newsletter sender email
- `TO_EMAILS` - Newsletter recipient emails (comma-separated)
- `NEWSLETTER_MONTH` - Current newsletter month

## Development Notes

- Backend runs on port 8000
- Frontend runs on port 5173
- Frontend API calls are configured to use `http://localhost:8000/api`
- Dashboard data is cached for 1 hour to reduce API calls
- Newsletter previews are saved to `newsletter_cache/newsletter_preview.html`
- Dashboard data cache is saved to `newsletter_cache/dashboard_data.json`

## Testing

### Backend

```bash
cd backend
pytest  # If tests are configured
```

### Frontend

```bash
cd frontend
npm run test
```

## Building for Production

### Backend

Deploy using your preferred method (Docker, Vercel, etc.)

### Frontend

```bash
cd frontend
npm run build
```

The build output will be in the `dist/` directory.

## Troubleshooting

1. **CORS Issues**: Make sure `CORS_ORIGINS` in backend `.env` includes your frontend URL
2. **API Connection Failed**: Verify backend is running on port 8000
3. **Dashboard Data Not Loading**: Check backend logs for RSS feed or CISA KEV fetch errors
4. **Authentication Issues**: Verify MongoDB connection and JWT secret key configuration
