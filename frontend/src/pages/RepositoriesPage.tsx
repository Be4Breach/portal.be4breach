import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
    Github,
    Lock,
    Unlock,
    Star,
    GitFork,
    AlertCircle,
    Search,
    RefreshCw,
    ExternalLink,
    Code2,
    Clock,
    ChevronDown,
    Shield,
    Settings,
    ArrowRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import BACKEND_URL from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Repo {
    id: number;
    name: string;
    full_name: string;
    description: string | null;
    private: boolean;
    html_url: string;
    language: string | null;
    stargazers_count: number;
    forks_count: number;
    open_issues_count: number;
    default_branch: string;
    updated_at: string;
    created_at: string;
    topics: string[];
    visibility: string;
    size: number;
}

// ─── Language colour map ──────────────────────────────────────────────────────

const LANG_COLORS: Record<string, string> = {
    TypeScript: "#3178c6",
    JavaScript: "#f1e05a",
    Python: "#3572A5",
    Go: "#00ADD8",
    Rust: "#dea584",
    Java: "#b07219",
    "C#": "#178600",
    "C++": "#f34b7d",
    C: "#555555",
    Ruby: "#701516",
    PHP: "#4F5D95",
    Swift: "#F05138",
    Kotlin: "#A97BFF",
    Dart: "#00B4AB",
    HTML: "#e34c26",
    CSS: "#563d7c",
    Shell: "#89e051",
    Vue: "#41b883",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.floor(months / 12)}y ago`;
}

// ─── Fetch ────────────────────────────────────────────────────────────────────


async function fetchRepos(token: string): Promise<Repo[]> {
    const res = await fetch(`${BACKEND_URL}/api/github/repos`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `Error ${res.status}`);
    }
    return res.json();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RepoCard({ repo }: { repo: Repo }) {
    const langColor = repo.language ? (LANG_COLORS[repo.language] ?? "#8b949e") : null;
    const navigate = useNavigate();
    const [owner, repoName] = repo.full_name.split("/");

    return (
        <div className="group relative flex flex-col gap-3 p-5 rounded-xl border bg-card hover:border-primary/30 hover:shadow-md transition-all duration-200">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    {repo.private ? (
                        <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    ) : (
                        <Unlock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}
                    <a
                        href={repo.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-sm text-foreground hover:text-primary truncate transition-colors"
                    >
                        {repo.name}
                    </a>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    <Badge
                        variant="outline"
                        className={cn(
                            "text-[10px] px-1.5 py-0 h-5",
                            repo.private
                                ? "border-amber-500/30 text-amber-600 bg-amber-500/5"
                                : "border-emerald-500/30 text-emerald-600 bg-emerald-500/5"
                        )}
                    >
                        {repo.private ? "Private" : "Public"}
                    </Badge>
                    <a
                        href={repo.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                    >
                        <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                </div>
            </div>

            {/* Description */}
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed min-h-[2.5rem]">
                {repo.description ?? (
                    <span className="italic opacity-60">No description provided</span>
                )}
            </p>

            {/* Topics */}
            {repo.topics.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {repo.topics.slice(0, 4).map((t) => (
                        <span
                            key={t}
                            className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20"
                        >
                            {t}
                        </span>
                    ))}
                    {repo.topics.length > 4 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
                            +{repo.topics.length - 4}
                        </span>
                    )}
                </div>
            )}

            {/* Footer stats + scan button */}
            <div className="flex items-center gap-4 text-[11px] text-muted-foreground mt-auto pt-1 border-t border-border/50">
                {langColor && (
                    <span className="flex items-center gap-1.5">
                        <span
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: langColor }}
                        />
                        {repo.language}
                    </span>
                )}
                {repo.stargazers_count > 0 && (
                    <span className="flex items-center gap-1">
                        <Star className="h-3 w-3" />
                        {repo.stargazers_count}
                    </span>
                )}
                {repo.forks_count > 0 && (
                    <span className="flex items-center gap-1">
                        <GitFork className="h-3 w-3" />
                        {repo.forks_count}
                    </span>
                )}
                {repo.open_issues_count > 0 && (
                    <span className="flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {repo.open_issues_count}
                    </span>
                )}
                <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {timeAgo(repo.updated_at)}
                </span>
                <button
                    id={`scan-btn-${repo.id}`}
                    onClick={() => navigate(`/scan/${owner}/${repoName}`)}
                    className="ml-auto flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-[11px] font-medium"
                >
                    <Shield className="h-3 w-3" />
                    Scan
                </button>
            </div>
        </div>
    );
}

function SkeletonCard() {
    return (
        <div className="flex flex-col gap-3 p-5 rounded-xl border bg-card animate-pulse">
            <div className="flex items-center gap-2">
                <div className="h-3.5 w-3.5 rounded bg-muted" />
                <div className="h-4 w-32 rounded bg-muted" />
                <div className="ml-auto h-5 w-14 rounded bg-muted" />
            </div>
            <div className="space-y-1.5">
                <div className="h-3 w-full rounded bg-muted" />
                <div className="h-3 w-3/4 rounded bg-muted" />
            </div>
            <div className="flex gap-3 pt-1 border-t border-border/50">
                <div className="h-3 w-16 rounded bg-muted" />
                <div className="h-3 w-10 rounded bg-muted" />
                <div className="h-3 w-12 rounded bg-muted ml-auto" />
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type SortKey = "updated" | "name" | "stars" | "forks";
type VisibilityFilter = "all" | "public" | "private";

export default function RepositoriesPage() {
    const { token, user, hasGitHub } = useAuth();
    const [search, setSearch] = useState("");
    const [sort, setSort] = useState<SortKey>("updated");
    const [visibility, setVisibility] = useState<VisibilityFilter>("all");
    const [langFilter, setLangFilter] = useState<string>("all");

    const {
        data: repos,
        isLoading,
        isError,
        error,
        refetch,
        isFetching,
    } = useQuery<Repo[], Error>({
        queryKey: ["github-repos"],
        queryFn: () => fetchRepos(token!),
        enabled: !!token && hasGitHub,   // don't fetch at all if GitHub not connected
        staleTime: 5 * 60 * 1000,
        retry: 1,
    });

    // ── No GitHub connected gate ──────────────────────────────────────────────
    if (!hasGitHub) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
                <div className="relative">
                    <div className="h-20 w-20 rounded-2xl bg-secondary border flex items-center justify-center">
                        <Github className="h-10 w-10 text-muted-foreground/50" />
                    </div>
                    <div className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center">
                        <AlertCircle className="h-4 w-4 text-yellow-500" />
                    </div>
                </div>

                <div className="text-center space-y-2 max-w-sm">
                    <h2 className="text-xl font-bold">GitHub not connected</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        To browse and scan your repositories, you need to connect your GitHub
                        account first. Head over to Settings to link it.
                    </p>
                </div>

                <Link
                    to="/settings"
                    className="flex items-center gap-2 h-10 px-6 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                >
                    <Settings className="h-4 w-4" />
                    Go to Settings
                    <ArrowRight className="h-4 w-4" />
                </Link>

                <p className="text-xs text-muted-foreground">
                    Already connected?{" "}
                    <button
                        onClick={() => window.location.reload()}
                        className="text-primary underline hover:no-underline"
                    >
                        Refresh the page
                    </button>
                </p>
            </div>
        );
    }

    // Unique languages for filter
    const languages = useMemo(() => {
        if (!repos) return [];
        const langs = [...new Set(repos.map((r) => r.language).filter(Boolean))] as string[];
        return langs.sort();
    }, [repos]);

    // Filtered + sorted repos
    const filtered = useMemo(() => {
        if (!repos) return [];
        let result = repos;

        if (visibility !== "all") {
            result = result.filter((r) =>
                visibility === "private" ? r.private : !r.private
            );
        }
        if (langFilter !== "all") {
            result = result.filter((r) => r.language === langFilter);
        }
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(
                (r) =>
                    r.name.toLowerCase().includes(q) ||
                    r.description?.toLowerCase().includes(q) ||
                    r.topics.some((t) => t.toLowerCase().includes(q))
            );
        }

        return [...result].sort((a, b) => {
            switch (sort) {
                case "name":
                    return a.name.localeCompare(b.name);
                case "stars":
                    return b.stargazers_count - a.stargazers_count;
                case "forks":
                    return b.forks_count - a.forks_count;
                case "updated":
                default:
                    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
            }
        });
    }, [repos, search, sort, visibility, langFilter]);

    // Stats
    const stats = useMemo(() => {
        if (!repos) return null;
        return {
            total: repos.length,
            public: repos.filter((r) => !r.private).length,
            private: repos.filter((r) => r.private).length,
            languages: new Set(repos.map((r) => r.language).filter(Boolean)).size,
            totalStars: repos.reduce((s, r) => s + r.stargazers_count, 0),
        };
    }, [repos]);

    return (
        <div className="space-y-6">
            {/* ── Page header ─────────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    {user?.github_avatar && (
                        <img
                            src={user.github_avatar}
                            alt={user.github_name ?? undefined}
                            className="h-10 w-10 rounded-full border-2 border-border"
                        />
                    )}
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <Github className="h-5 w-5" />
                            {user?.github_name ?? user?.github_login ?? "Your"} Repositories
                        </h1>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {isLoading
                                ? "Loading repositories…"
                                : stats
                                    ? `${stats.total} repos · ${stats.languages} languages`
                                    : ""}
                        </p>
                    </div>
                </div>

                <button
                    id="refresh-repos-btn"
                    onClick={() => refetch()}
                    disabled={isFetching}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card hover:bg-secondary text-sm font-medium transition-colors disabled:opacity-50 self-start sm:self-auto"
                >
                    <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
                    Refresh
                </button>
            </div>
            {/* ── Filters & search ────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row gap-3">
                {/* Search */}
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        id="repo-search-input"
                        placeholder="Search repositories…"
                        className="pl-9 h-9 bg-secondary border-none"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                {/* Language filter */}
                {languages.length > 0 && (
                    <div className="relative">
                        <Code2 className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                        <select
                            id="language-filter"
                            value={langFilter}
                            onChange={(e) => setLangFilter(e.target.value)}
                            className="h-9 pl-8 pr-8 rounded-md border bg-secondary text-sm appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                            <option value="all">All languages</option>
                            {languages.map((l) => (
                                <option key={l} value={l}>
                                    {l}
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    </div>
                )}

                {/* Sort */}
                <div className="relative">
                    <select
                        id="sort-repos"
                        value={sort}
                        onChange={(e) => setSort(e.target.value as SortKey)}
                        className="h-9 px-3 pr-8 rounded-md border bg-secondary text-sm appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                        <option value="updated">Recently updated</option>
                        <option value="name">Name A–Z</option>
                        <option value="stars">Most stars</option>
                        <option value="forks">Most forks</option>
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                </div>
            </div>

            {/* ── Content ─────────────────────────────────────────────────────── */}

            {/* Loading skeletons */}
            {isLoading && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {Array.from({ length: 9 }).map((_, i) => (
                        <SkeletonCard key={i} />
                    ))}
                </div>
            )}

            {/* Error state */}
            {isError && (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <div className="h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center">
                        <AlertCircle className="h-7 w-7 text-destructive" />
                    </div>
                    <div className="text-center space-y-1">
                        <p className="font-semibold">Failed to load repositories</p>
                        <p className="text-sm text-muted-foreground max-w-sm">
                            {(error as Error)?.message ?? "An unexpected error occurred."}
                        </p>
                    </div>
                    <button
                        onClick={() => refetch()}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                    >
                        <RefreshCw className="h-4 w-4" />
                        Try again
                    </button>
                </div>
            )}

            {/* Empty state */}
            {!isLoading && !isError && filtered.length === 0 && repos && (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <Github className="h-12 w-12 text-muted-foreground/30" />
                    <p className="font-medium text-muted-foreground">
                        {repos.length === 0
                            ? "No repositories found on your GitHub account."
                            : "No repositories match your filters."}
                    </p>
                    {repos.length > 0 && (
                        <button
                            onClick={() => {
                                setSearch("");
                                setVisibility("all");
                                setLangFilter("all");
                            }}
                            className="text-sm text-primary hover:underline"
                        >
                            Clear filters
                        </button>
                    )}
                </div>
            )}

            {/* Repo grid */}
            {!isLoading && !isError && filtered.length > 0 && (
                <>
                    <p className="text-xs text-muted-foreground">
                        Showing {filtered.length} of {repos?.length ?? 0} repositories
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {filtered.map((repo) => (
                            <RepoCard key={repo.id} repo={repo} />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
