import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
    Mail, KeyRound, Eye, EyeOff, User, Building2,
    AlertCircle, CheckCircle2, Loader2,
} from "lucide-react";

// Google "G" SVG logo
function GoogleIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
    );
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:8000";

export default function SignupPage() {
    const navigate = useNavigate();
    const [form, setForm] = useState({
        first_name: "",
        last_name: "",
        company_name: "",
        email: "",
        password: "",
        confirm: "",
    });
    const [showPass, setShowPass] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((f) => ({ ...f, [k]: e.target.value }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (form.password !== form.confirm) {
            setError("Passwords do not match.");
            return;
        }
        if (form.password.length < 8) {
            setError("Password must be at least 8 characters.");
            return;
        }
        setSubmitting(true);
        try {
            const res = await fetch(`${BACKEND_URL}/api/auth/signup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    first_name: form.first_name,
                    last_name: form.last_name,
                    company_name: form.company_name,
                    email: form.email,
                    password: form.password,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail ?? `HTTP ${res.status}`);
            setSuccess(true);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex">
            {/* ── Left branding panel ─────────────────────────────────────── */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-[hsl(0,0%,6%)] flex-col items-center justify-center p-12">
                <div
                    className="absolute inset-0 opacity-[0.04]"
                    style={{
                        backgroundImage:
                            "linear-gradient(hsl(0,84%,50%) 1px, transparent 1px), linear-gradient(90deg, hsl(0,84%,50%) 1px, transparent 1px)",
                        backgroundSize: "40px 40px",
                    }}
                />
                <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

                <div className="relative z-10 flex flex-col items-center text-center gap-6 max-w-sm">
                    <div className="space-y-2">
                        <h1 className="text-3xl font-bold text-white leading-tight">
                            Join the security<br />
                            <span className="text-primary">platform</span>.
                        </h1>
                        <p className="text-sm text-white/50 leading-relaxed">
                            Create your account and start scanning repositories for secrets,
                            vulnerabilities, and misconfigurations.
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Right form panel ──────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col items-center justify-center p-8">
                <div className="w-full max-w-sm space-y-6">

                    {success ? (
                        /* ── Success state ── */
                        <div className="text-center space-y-4">
                            <div className="h-16 w-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
                                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold">Account created!</h2>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Your account is pending admin approval. You'll be able to log in once approved.
                                </p>
                            </div>
                            <button
                                onClick={() => navigate("/login")}
                                className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                            >
                                Back to Login
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-1">
                                <h2 className="text-2xl font-bold tracking-tight">Create account</h2>
                                <p className="text-sm text-muted-foreground">
                                    Fill in your details below to request access.
                                </p>
                            </div>

                            {error && (
                                <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-3">
                                {/* Name row */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium" htmlFor="signup-first-name">First name</label>
                                        <div className="relative">
                                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                            <input
                                                id="signup-first-name"
                                                type="text"
                                                required
                                                value={form.first_name}
                                                onChange={set("first_name")}
                                                placeholder="Jane"
                                                className="w-full h-10 pl-9 pr-3 rounded-lg border bg-secondary text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium" htmlFor="signup-last-name">Last name</label>
                                        <input
                                            id="signup-last-name"
                                            type="text"
                                            required
                                            value={form.last_name}
                                            onChange={set("last_name")}
                                            placeholder="Doe"
                                            className="w-full h-10 px-3 rounded-lg border bg-secondary text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                                        />
                                    </div>
                                </div>

                                {/* Company */}
                                <div className="space-y-1">
                                    <label className="text-xs font-medium" htmlFor="signup-company">Company</label>
                                    <div className="relative">
                                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                        <input
                                            id="signup-company"
                                            type="text"
                                            required
                                            value={form.company_name}
                                            onChange={set("company_name")}
                                            placeholder="Acme Corp"
                                            className="w-full h-10 pl-9 pr-3 rounded-lg border bg-secondary text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                                        />
                                    </div>
                                </div>

                                {/* Email */}
                                <div className="space-y-1">
                                    <label className="text-xs font-medium" htmlFor="signup-email">Email</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                        <input
                                            id="signup-email"
                                            type="email"
                                            required
                                            autoComplete="email"
                                            value={form.email}
                                            onChange={set("email")}
                                            placeholder="jane@acme.com"
                                            className="w-full h-10 pl-9 pr-3 rounded-lg border bg-secondary text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                                        />
                                    </div>
                                </div>

                                {/* Password */}
                                <div className="space-y-1">
                                    <label className="text-xs font-medium" htmlFor="signup-password">Password</label>
                                    <div className="relative">
                                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                        <input
                                            id="signup-password"
                                            type={showPass ? "text" : "password"}
                                            required
                                            value={form.password}
                                            onChange={set("password")}
                                            placeholder="Min. 8 characters"
                                            className="w-full h-10 pl-9 pr-10 rounded-lg border bg-secondary text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPass((s) => !s)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                            tabIndex={-1}
                                        >
                                            {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>

                                {/* Confirm password */}
                                <div className="space-y-1">
                                    <label className="text-xs font-medium" htmlFor="signup-confirm">Confirm password</label>
                                    <div className="relative">
                                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                        <input
                                            id="signup-confirm"
                                            type={showPass ? "text" : "password"}
                                            required
                                            value={form.confirm}
                                            onChange={set("confirm")}
                                            placeholder="Repeat password"
                                            className="w-full h-10 pl-9 pr-3 rounded-lg border bg-secondary text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                                        />
                                    </div>
                                </div>

                                <button
                                    id="signup-submit-btn"
                                    type="submit"
                                    disabled={submitting}
                                    className="w-full flex items-center justify-center gap-2 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed mt-1"
                                >
                                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                    Create account
                                </button>
                            </form>

                            <p className="text-center text-sm text-muted-foreground">
                                Already have an account?{" "}
                                <Link to="/login" className="text-primary font-medium hover:underline">
                                    Sign in
                                </Link>
                            </p>

                            {/* Divider */}
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-border" />
                                </div>
                                <div className="relative flex justify-center">
                                    <span className="bg-background px-3 text-[11px] text-muted-foreground uppercase tracking-widest">
                                        or continue with
                                    </span>
                                </div>
                            </div>

                            {/* Google placeholder */}
                            <button
                                id="google-signup-btn"
                                disabled
                                title="Google sign-in coming soon"
                                className="w-full flex items-center justify-center gap-3 h-10 px-4 rounded-lg border bg-card text-sm font-medium text-muted-foreground cursor-not-allowed opacity-50"
                            >
                                <GoogleIcon className="h-4 w-4" />
                                Continue with Google
                                <span className="ml-auto text-[10px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground/70 font-normal">
                                    Coming soon
                                </span>
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
