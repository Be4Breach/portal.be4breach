import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Shield, AlertCircle } from "lucide-react";

/**
 * Landing page for GitHub OAuth redirects (both login and connect flows).
 * The backend redirects here with ?token=<jwt> on success, or ?error=<msg> on failure.
 * Optional ?next=<path> specifies where to navigate after login (default: /repositories).
 */
export default function AuthCallbackPage() {
    const [params] = useSearchParams();
    const { login } = useAuth();
    const navigate = useNavigate();
    const handled = useRef(false);

    useEffect(() => {
        if (handled.current) return;
        handled.current = true;

        const token = params.get("token");
        const error = params.get("error");
        const next = params.get("next") ?? "/";

        if (token) {
            login(token);
            navigate(next, { replace: true });
        } else {
            navigate(`/login?error=${encodeURIComponent(error ?? "Authentication failed")}`, {
                replace: true,
            });
        }
    }, [params, login, navigate]);

    return (
        <div className="h-screen flex flex-col items-center justify-center bg-background gap-4">
            <div className="relative">
                <Shield className="h-12 w-12 text-primary" />
                <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
            </div>
            <p className="text-sm text-muted-foreground animate-pulse">
                Completing sign-in…
            </p>
            <AlertCircle className="h-4 w-4 text-muted-foreground/40" />
        </div>
    );
}
