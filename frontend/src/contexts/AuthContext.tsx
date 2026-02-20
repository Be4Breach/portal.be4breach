import {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
} from "react";
import type { ReactNode } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AppUser {
    email: string;
    auth_provider: "github" | "email";
    role: string;
    // GitHub fields (always set for github auth; set for email auth after connecting)
    github_login: string | null;
    github_name: string | null;
    github_avatar: string | null;
    // Email/password specific
    first_name?: string;
    last_name?: string;
}

export interface AuthContextValue {
    user: AppUser | null;
    token: string | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    hasGitHub: boolean;    // convenient flag — does user have a linked GitHub account?
    login: (token: string) => void;
    logout: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function decodeJwt(token: string): Record<string, unknown> | null {
    try {
        const payload = token.split(".")[1];
        return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    } catch {
        return null;
    }
}

function isTokenExpired(payload: Record<string, unknown>): boolean {
    const exp = payload.exp as number | undefined;
    if (!exp) return false;
    return Date.now() / 1000 > exp;
}

function buildUser(payload: Record<string, unknown>): AppUser | null {
    const sub = payload.sub as string | undefined;
    if (!sub) return null;

    return {
        email: sub,
        auth_provider: (payload.auth_provider as "github" | "email") ?? "email",
        role: (payload.role as string) ?? "user",
        github_login: (payload.github_login as string | null) ?? null,
        github_name: (payload.github_name as string | null) ?? null,
        github_avatar: (payload.github_avatar as string | null) ?? null,
        first_name: payload.first_name as string | undefined,
        last_name: payload.last_name as string | undefined,
    };
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
    const [token, setToken] = useState<string | null>(null);
    const [user, setUser] = useState<AppUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Restore session from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem("token");
        if (stored) {
            const payload = decodeJwt(stored);
            if (payload && !isTokenExpired(payload)) {
                const u = buildUser(payload);
                setToken(stored);
                setUser(u);
            } else {
                localStorage.removeItem("token");
            }
        }
        setIsLoading(false);
    }, []);

    const login = useCallback((newToken: string) => {
        const payload = decodeJwt(newToken);
        if (!payload || isTokenExpired(payload)) return;
        const u = buildUser(payload);
        localStorage.setItem("token", newToken);
        setToken(newToken);
        setUser(u);
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem("token");
        setToken(null);
        setUser(null);
    }, []);

    const hasGitHub = !!(user?.github_login);

    return (
        <AuthContext.Provider
            value={{
                user,
                token,
                isLoading,
                isAuthenticated: !!token,
                hasGitHub,
                login,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
    return ctx;
}
