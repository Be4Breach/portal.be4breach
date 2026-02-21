import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { DEMO_MODE } from "@/api/demoConfig";
import { MOCK_GRAPH_DATA } from "@/mocks/identityMockData";

function getNodeColor(source: string) {
    const map: Record<string, string> = {
        aws: "#ff9900", azure: "#0078d4", gcp: "#4285f4",
        okta: "#007dc1", github: "#f0f6fc", gitlab: "#fc6d26",
    };
    return map[source] ?? "#888";
}


export default function IdentityGraphViz() {
    const { token } = useAuth();
    const { data } = useQuery({
        queryKey: ["identity-graph"],
        queryFn: async () => {
            if (DEMO_MODE) return MOCK_GRAPH_DATA;
            try {
                const resp = await fetch("/api/identity-risk-intelligence/graph", {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                if (!resp.ok) return MOCK_GRAPH_DATA;
                return resp.json();
            } catch (err) {
                console.warn("API Error, falling back to mock:", err);
                return MOCK_GRAPH_DATA;
            }
        },
        enabled: !!token,
    });

    const nodes = data?.nodes ?? [];
    const edges = data?.edges ?? [];

    // Simple force-directed layout simulation
    const positions = useMemo(() => {
        if (!nodes.length) return {};
        const pos: Record<string, { x: number; y: number }> = {};
        const cx = 300, cy = 140;
        const r = Math.min(120, nodes.length * 15);
        nodes.forEach((n: Record<string, unknown>, i: number) => {
            const angle = (i / nodes.length) * 2 * Math.PI - Math.PI / 2;
            pos[n.id as string] = {
                x: cx + r * Math.cos(angle) + (Math.random() - 0.5) * 30,
                y: cy + r * Math.sin(angle) + (Math.random() - 0.5) * 20,
            };
        });
        return pos;
    }, [nodes]);

    return (
        <Card className="border border-border/50 lg:col-span-2">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Identity Relationship Graph</CardTitle>
                <CardDescription className="text-xs">Cross-provider identity mapping &amp; relationship visualization</CardDescription>
            </CardHeader>
            <CardContent className="relative">
                {nodes.length === 0 ? (
                    <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
                        Loading graph data...
                    </div>
                ) : (
                    <div className="relative h-[280px] w-full overflow-hidden">
                        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 600 280">
                            {/* Edges */}
                            {edges.map((e: Record<string, unknown>, i: number) => {
                                const from = positions[e.source as string];
                                const to = positions[e.target as string];
                                if (!from || !to) return null;
                                const rel = (e.relationship as string) ?? "";
                                const isCross = rel.includes("cross_provider");
                                return (
                                    <line
                                        key={i}
                                        x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                                        stroke={isCross ? "hsl(280,60%,50%)" : "hsl(var(--border))"}
                                        strokeWidth={isCross ? 1.5 : 0.8}
                                        strokeDasharray={isCross ? "" : "4 2"}
                                        opacity={0.5}
                                    />
                                );
                            })}
                            {/* Nodes */}
                            {nodes.map((n: Record<string, unknown>) => {
                                const p = positions[n.id as string];
                                if (!p) return null;
                                const risk = (n.riskScore as number) ?? 0;
                                return (
                                    <g key={n.id as string}>
                                        <circle cx={p.x} cy={p.y} r={16} fill={getNodeColor(n.source as string)} opacity={0.15} />
                                        <circle cx={p.x} cy={p.y} r={10} fill={getNodeColor(n.source as string)} opacity={0.8} stroke={risk >= 60 ? "#f87171" : "transparent"} strokeWidth={risk >= 60 ? 2 : 0} />
                                        <text x={p.x} y={p.y + 24} textAnchor="middle" className="fill-muted-foreground" fontSize={8}>
                                            {(n.email as string).split("@")[0]}
                                        </text>
                                        <text x={p.x} y={p.y + 33} textAnchor="middle" className="fill-muted-foreground/60" fontSize={7}>
                                            {(n.source as string).toUpperCase()}
                                        </text>
                                    </g>
                                );
                            })}
                        </svg>
                    </div>
                )}
                {/* Legend */}
                <div className="flex flex-wrap gap-3 mt-2 justify-center">
                    {["aws", "azure", "gcp", "okta", "github", "gitlab"].map((s) => (
                        <div key={s} className="flex items-center gap-1">
                            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: getNodeColor(s) }} />
                            <span className="text-[9px] text-muted-foreground uppercase">{s}</span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
