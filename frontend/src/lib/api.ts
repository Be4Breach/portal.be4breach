/**
 * Central API configuration.
 * All backend requests should use BACKEND_URL from this file.
 * Set VITE_BACKEND_URL in your .env (or Vercel/Render env vars) to point to your backend.
 */
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:8000";

export default BACKEND_URL;
