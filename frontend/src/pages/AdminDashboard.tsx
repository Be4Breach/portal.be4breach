import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
    Shield, LogOut, Check, Users, Clock, CheckCircle2,
    RefreshCw, Trash2, UserCog, Search, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

import BACKEND_URL from "@/lib/api";

interface AdminUser {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    company_name: string;
    role: string;
    is_approved: boolean;
}

export default function AdminDashboard() {
    const { token, user, logout } = useAuth();
    const navigate = useNavigate();
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<"all" | "pending" | "active">("all");
    const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

    // Guard: redirect non-admins immediately
    useEffect(() => {
        if (user && user.role !== "admin") {
            navigate("/", { replace: true });
        }
    }, [user, navigate]);

    const fetchUsers = useCallback(async (silent = false) => {
        if (!token) return;
        if (!silent) setLoading(true);
        else setRefreshing(true);

        try {
            const res = await fetch(`${BACKEND_URL}/api/admin/users`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.status === 401 || res.status === 403) {
                logout();
                navigate("/login");
                return;
            }
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data: AdminUser[] = await res.json();
            setUsers(data);
        } catch {
            toast.error("Failed to load users.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [token, logout, navigate]);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    const setLoaderFor = (id: string, val: boolean) =>
        setActionLoading((prev) => ({ ...prev, [id]: val }));

    const handleApprove = async (userId: string) => {
        setLoaderFor(userId, true);
        const toastId = toast.loading("Approving user…");
        try {
            const res = await fetch(`${BACKEND_URL}/api/admin/users/${userId}/approve`, {
                method: "PUT",
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error();
            toast.success("User approved!", { id: toastId });
            fetchUsers(true);
        } catch {
            toast.error("Failed to approve user.", { id: toastId });
        } finally {
            setLoaderFor(userId, false);
        }
    };

    const handleDelete = async (userId: string, name: string) => {
        if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
        setLoaderFor(userId, true);
        const toastId = toast.loading("Deleting user…");
        try {
            const res = await fetch(`${BACKEND_URL}/api/admin/users/${userId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error();
            toast.success("User deleted.", { id: toastId });
            setUsers((prev) => prev.filter((u) => u.id !== userId));
        } catch {
            toast.error("Failed to delete user.", { id: toastId });
        } finally {
            setLoaderFor(userId, false);
        }
    };

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    // Filter + search
    const visible = users.filter((u) => {
        if (filter === "pending" && u.is_approved) return false;
        if (filter === "active" && !u.is_approved) return false;
        if (search) {
            const q = search.toLowerCase();
            return (
                u.email.toLowerCase().includes(q) ||
                u.first_name.toLowerCase().includes(q) ||
                u.last_name.toLowerCase().includes(q) ||
                u.company_name.toLowerCase().includes(q)
            );
        }
        return true;
    });

    const pending = users.filter((u) => !u.is_approved).length;
    const approved = users.filter((u) => u.is_approved).length;

    return (
        <div className="min-h-screen bg-background">
            <Toaster position="top-right" toastOptions={{ className: "text-sm" }} />

            {/* ── Top bar ────────────────────────────────────────────────────── */}
            <header className="sticky top-0 z-40 h-14 border-b bg-card flex items-center justify-between px-6">
                <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <Shield className="h-4 w-4 text-primary" />
                    </div>
                    <span className="font-bold tracking-tight">
                        be<span className="text-primary">4</span>breach
                    </span>
                    <span className="text-muted-foreground/40 mx-1">·</span>
                    <span className="text-sm text-muted-foreground font-medium flex items-center gap-1">
                        <UserCog className="h-4 w-4" /> Admin Console
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground hidden sm:block">
                        Signed in as <span className="font-medium text-foreground">{user?.email}</span>
                    </span>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium hover:bg-secondary transition-colors"
                    >
                        <LogOut className="h-3.5 w-3.5" />
                        Logout
                    </button>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 md:px-6 py-8 space-y-6">

                {/* ── Page title ─────────────────────────────────────────────── */}
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Approve, manage, and remove user accounts.
                    </p>
                </div>

                {/* ── Stat cards ─────────────────────────────────────────────── */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <StatCard
                        icon={Users}
                        label="Total users"
                        value={users.length}
                        color="text-foreground"
                    />
                    <StatCard
                        icon={Clock}
                        label="Pending approval"
                        value={pending}
                        color="text-yellow-500"
                        urgent={pending > 0}
                    />
                    <StatCard
                        icon={CheckCircle2}
                        label="Active accounts"
                        value={approved}
                        color="text-emerald-500"
                    />
                </div>

                {/* ── Toolbar ────────────────────────────────────────────────── */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by name, email or company…"
                            className="w-full h-9 pl-9 pr-4 rounded-lg border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                        />
                    </div>

                    {/* Filter pills */}
                    <div className="flex rounded-lg border bg-secondary/40 p-0.5 gap-0.5 text-sm">
                        {(["all", "pending", "active"] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={cn(
                                    "px-3 py-1.5 rounded-md font-medium capitalize transition-all",
                                    filter === f
                                        ? "bg-card shadow-sm text-foreground"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {f}
                                {f === "pending" && pending > 0 && (
                                    <span className="ml-1.5 bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 text-[10px] px-1.5 py-0.5 rounded-full font-semibold">
                                        {pending}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={() => fetchUsers(true)}
                        disabled={refreshing}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium hover:bg-secondary transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
                        <span className="hidden sm:inline">Refresh</span>
                    </button>
                </div>

                {/* ── Table ──────────────────────────────────────────────────── */}
                <div className="rounded-xl border bg-card overflow-hidden">
                    {loading ? (
                        <div className="flex items-center justify-center h-48 gap-2 text-sm text-muted-foreground">
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            Loading users…
                        </div>
                    ) : visible.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
                            <Users className="h-8 w-8 opacity-30" />
                            <p className="text-sm">
                                {search || filter !== "all" ? "No users match the current filter." : "No users found."}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-muted/30">
                                        <Th>Name</Th>
                                        <Th>Email</Th>
                                        <Th className="hidden md:table-cell">Company</Th>
                                        <Th>Status</Th>
                                        <Th className="hidden sm:table-cell">Role</Th>
                                        <Th className="text-right">Actions</Th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {visible.map((u) => (
                                        <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                                            <td className="px-5 py-3.5 font-medium whitespace-nowrap">
                                                {u.first_name} {u.last_name}
                                            </td>
                                            <td className="px-5 py-3.5 text-muted-foreground">
                                                {u.email}
                                            </td>
                                            <td className="px-5 py-3.5 text-muted-foreground hidden md:table-cell">
                                                {u.company_name}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                {u.is_approved ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                                        Active
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
                                                        Pending
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5 capitalize hidden sm:table-cell">
                                                <RoleBadge role={u.role} />
                                            </td>
                                            <td className="px-5 py-3.5 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {!u.is_approved && (
                                                        <button
                                                            id={`approve-${u.id}`}
                                                            onClick={() => handleApprove(u.id)}
                                                            disabled={actionLoading[u.id]}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition-colors disabled:opacity-50"
                                                        >
                                                            {actionLoading[u.id]
                                                                ? <RefreshCw className="h-3 w-3 animate-spin" />
                                                                : <Check className="h-3 w-3" />
                                                            }
                                                            Approve
                                                        </button>
                                                    )}
                                                    <button
                                                        id={`delete-${u.id}`}
                                                        onClick={() => handleDelete(u.id, `${u.first_name} ${u.last_name}`)}
                                                        disabled={actionLoading[u.id]}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs font-medium transition-colors border border-destructive/20 disabled:opacity-50"
                                                    >
                                                        {actionLoading[u.id]
                                                            ? <RefreshCw className="h-3 w-3 animate-spin" />
                                                            : <Trash2 className="h-3 w-3" />
                                                        }
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Footer */}
                    {!loading && visible.length > 0 && (
                        <div className="px-5 py-3 border-t bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
                            <span>Showing {visible.length} of {users.length} users</span>
                            <ChevronDown className="h-3 w-3 opacity-40" />
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
    icon: Icon, label, value, color, urgent,
}: {
    icon: React.ElementType; label: string; value: number; color: string; urgent?: boolean;
}) {
    return (
        <div className={cn(
            "rounded-xl border bg-card p-5 flex items-center gap-4",
            urgent && "border-yellow-500/30 bg-yellow-500/5"
        )}>
            <div className={cn("h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0", urgent && "bg-yellow-500/10")}>
                <Icon className={cn("h-5 w-5", color)} />
            </div>
            <div>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
            </div>
        </div>
    );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
    return (
        <th className={cn("px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider", className)}>
            {children}
        </th>
    );
}

function RoleBadge({ role }: { role: string }) {
    const isAdmin = role === "admin";
    return (
        <span className={cn(
            "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border",
            isAdmin
                ? "bg-primary/10 text-primary border-primary/20"
                : "bg-secondary text-muted-foreground border-border"
        )}>
            {isAdmin && <Shield className="h-2.5 w-2.5 mr-1" />}
            {role}
        </span>
    );
}
