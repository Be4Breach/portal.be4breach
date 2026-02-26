import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Maximize2, ZoomIn, ZoomOut } from "lucide-react";

import type { GraphData } from "../../types/identity";
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

function getNodeColor(source: string) {
    const map: Record<string, string> = {
        aws: "#ff9900", azure: "#0078d4", gcp: "#4285f4",
        okta: "#007dc1", github: "#f0f6fc", gitlab: "#fc6d26",
    };
    return map[source] ?? "#888";
}

// Deterministic "jitter" - pure function, avoids Math.random during render
function seededOffset(index: number, charCode: number, scale: number) {
    return (((index * 9301 + charCode * 49297) % 233280) / 233280 - 0.5) * scale;
}

export default function IdentityGraphViz() {
    const { token } = useAuth();
    const { data } = useQuery<GraphData>({
        queryKey: ["identity-graph"],
        queryFn: async () => {
            const resp = await fetch(`${BACKEND_URL}/api/identity-risk-intelligence/graph`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (!resp.ok) throw new Error("Failed to fetch graph data");
            return resp.json();
        },
        enabled: !!token,
    });

    const nodes = useMemo(() => data?.nodes ?? [], [data]);
    const edges = useMemo(() => data?.edges ?? [], [data]);

    // Graph Interaction State
    const INITIAL_TRANSFORM = { x: -150, y: -90, scale: 1.3 };
    const [transform, setTransform] = useState(INITIAL_TRANSFORM);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

    // Find all directly connected nodes for highlight
    const connectedNodes = useMemo(() => {
        if (!hoveredNodeId) return new Set<string>();
        const connected = new Set<string>([hoveredNodeId]);
        edges.forEach((e: any) => {
            if (e.source === hoveredNodeId) connected.add(e.target as string);
            if (e.target === hoveredNodeId) connected.add(e.source as string);
        });
        return connected;
    }, [edges, hoveredNodeId]);

    // Clustered layout simulation by source provider
    const positions = useMemo(() => {
        if (!nodes.length) return {};
        const pos: Record<string, { x: number; y: number }> = {};

        const nodesBySource: Record<string, typeof nodes> = {};
        nodes.forEach((n: any) => {
            const s = (n.source as string)?.toLowerCase() || "unknown";
            if (!nodesBySource[s]) nodesBySource[s] = [];
            nodesBySource[s].push(n);
        });

        const sources = Object.keys(nodesBySource);
        const mainCx = 500, mainCy = 300;
        const clusterRadius = 380; // MUCH WIDER Spread

        const sourceCenters: Record<string, { cx: number, cy: number }> = {};

        sources.forEach((source, index) => {
            if (source === 'okta') {
                sourceCenters[source] = { cx: mainCx, cy: mainCy }; // Hub at center
            } else {
                const otherSourcesCount = sources.includes('okta') ? sources.length - 1 : sources.length;
                let angleIndex = index;
                if (sources.includes('okta')) {
                    angleIndex = index > sources.indexOf('okta') ? index - 1 : index;
                }
                const angle = (angleIndex / Math.max(1, otherSourcesCount)) * 2 * Math.PI - Math.PI / 2;
                sourceCenters[source] = {
                    cx: mainCx + clusterRadius * Math.cos(angle),
                    cy: mainCy + clusterRadius * Math.sin(angle)
                };
            }
        });

        Object.entries(nodesBySource).forEach(([source, sourceNodes]) => {
            const center = sourceCenters[source] || { cx: mainCx, cy: mainCy };
            const rBase = Math.min(180, sourceNodes.length * 20); // More space per node
            const sortedNodes = [...sourceNodes].sort((a: any, b: any) => (a.id as string).localeCompare(b.id as string));

            sortedNodes.forEach((n: any, i) => {
                const golden_ratio = (Math.sqrt(5) + 1) / 2 - 1;
                const golden_angle = golden_ratio * 2 * Math.PI;
                const ratio = i / sourceNodes.length;
                const angle = i * golden_angle;
                const seed = (n.id as string).charCodeAt(0) || 65;
                const r = rBase * Math.sqrt(ratio) + seededOffset(i, seed, 25);

                pos[n.id as string] = {
                    x: center.cx + r * Math.cos(angle),
                    y: center.cy + r * Math.sin(angle),
                };
            });
        });

        return pos;
    }, [nodes]);

    return (
        <Card className="border border-border/50 lg:col-span-2 h-full flex flex-col min-h-[500px] relative">
            <CardHeader className="pb-2 flex-none z-10 bg-card/80 backdrop-blur-md">
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-sm font-semibold">Interactive Identity Network</CardTitle>
                        <CardDescription className="text-xs">Scroll to zoom • Click & Drag to pan • Hover nodes to explore</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setTransform(p => ({ ...p, scale: p.scale * 1.2 }))} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"><ZoomIn className="w-4 h-4" /></button>
                        <button onClick={() => setTransform(p => ({ ...p, scale: p.scale / 1.2 }))} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"><ZoomOut className="w-4 h-4" /></button>
                        <button onClick={() => setTransform(INITIAL_TRANSFORM)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"><Maximize2 className="w-4 h-4" /></button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="relative flex-1 p-0 overflow-hidden min-h-[400px]">
                {nodes.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="relative h-40 w-40 flex items-center justify-center">
                            <div className="absolute inset-0 rounded-full border-4 border-primary/10 animate-ping" />
                            <div className="h-20 w-20 rounded-full border-4 border-primary/20 animate-pulse flex items-center justify-center">
                                <div className="h-10 w-10 rounded-full bg-primary/20" />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
                        onWheel={(e) => {
                            const ds = e.deltaY > 0 ? 0.9 : 1.1;
                            setTransform(p => ({ ...p, scale: Math.max(0.1, Math.min(5, p.scale * ds)) }));
                        }}
                        onMouseDown={(e) => {
                            setIsDragging(true);
                            setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
                        }}
                        onMouseMove={(e) => {
                            if (isDragging) {
                                setTransform(p => ({ ...p, x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }));
                            }
                        }}
                        onMouseUp={() => setIsDragging(false)}
                        onMouseLeave={() => setIsDragging(false)}
                    >

                        <svg className="w-full h-full pointer-events-none" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid meet">
                            <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`} className="pointer-events-auto">
                                {/* Edges */}
                                <g className="edges">
                                    {edges.map((e: Record<string, unknown>, i: number) => {
                                        const from = positions[e.source as string];
                                        const to = positions[e.target as string];
                                        if (!from || !to) return null;
                                        const rel = (e.relationship as string) ?? "";
                                        const isCross = rel.includes("cross_provider");

                                        const isHovered = hoveredNodeId && (e.source === hoveredNodeId || e.target === hoveredNodeId);
                                        const isActive = isHovered || !hoveredNodeId;

                                        return (
                                            <line
                                                key={`edge-${i}`}
                                                x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                                                stroke={isHovered ? (isCross ? "hsl(280, 80%, 65%)" : "hsl(var(--primary))") : (isCross ? "hsl(280,30%,40%)" : "hsl(var(--border))")}
                                                strokeWidth={isHovered ? 2.5 : (isCross ? 1.5 : 0.6)}
                                                strokeDasharray={isCross ? "" : (isHovered ? "4 2" : "6 4")}
                                                opacity={isActive ? (isHovered ? 0.9 : 0.2) : 0.05}
                                                className="transition-all duration-300"
                                            />
                                        );
                                    })}
                                </g>

                                {/* Nodes */}
                                <g className="nodes">
                                    {nodes.map((n: Record<string, unknown>) => {
                                        const p = positions[n.id as string];
                                        if (!p) return null;
                                        const risk = (n.riskScore as number) ?? 0;
                                        const isCritical = risk >= 60;
                                        const isHovered = n.id === hoveredNodeId;
                                        const isConnected = hoveredNodeId && connectedNodes.has(n.id as string);
                                        const isActive = !hoveredNodeId || isConnected;
                                        const nodeColor = getNodeColor(n.source as string);

                                        return (
                                            <g
                                                key={`node-${n.id}`}
                                                transform={`translate(${p.x}, ${p.y})`}
                                                onMouseEnter={() => setHoveredNodeId(n.id as string)}
                                                onMouseLeave={() => setHoveredNodeId(null)}
                                                className="cursor-pointer transition-opacity duration-300"
                                                opacity={isActive ? 1 : 0.15}
                                            >
                                                {/* Node Glow (Critical) */}
                                                {isCritical && isActive && (
                                                    <circle r={isHovered ? 28 : 22} fill="#f87171" opacity={isHovered ? 0.3 : 0.1} className="animate-pulse" />
                                                )}

                                                {/* Base Node */}
                                                <circle r={18} fill={nodeColor} opacity={0.15} />
                                                <circle
                                                    r={isHovered ? 14 : 10}
                                                    fill={nodeColor}
                                                    opacity={0.85}
                                                    stroke={isCritical ? "#f87171" : "white"}
                                                    strokeWidth={isCritical ? 3 : (isHovered ? 2 : 0)}
                                                    className="transition-all duration-200"
                                                />

                                                {/* Conditional Labels - Only show when hovered OR when graph has very few nodes */}
                                                {(isHovered || (nodes.length < 15 && isActive)) && (
                                                    <g className="pointer-events-none transition-all duration-200">
                                                        <rect x="-60" y="20" width="120" height="32" rx="4" fill="hsl(var(--card))" opacity="0.9" stroke="hsl(var(--border))" strokeWidth="1" />
                                                        <text y="34" textAnchor="middle" className="fill-foreground font-bold" fontSize="10">
                                                            {(n.email as string).split("@")[0]}
                                                        </text>
                                                        <text y="46" textAnchor="middle" className="fill-muted-foreground font-semibold uppercase tracking-wider" fontSize="8">
                                                            {(n.source as string)} {isCritical ? " • CRITICAL" : ""}
                                                        </text>
                                                    </g>
                                                )}
                                            </g>
                                        );
                                    })}
                                </g>
                            </g>
                        </svg>
                    </div>
                )}

                {/* Fixed Control Background gradients for premium feel */}
                <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background/40 to-transparent pointer-events-none" />
                <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background/40 to-transparent pointer-events-none" />
                <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-background/40 to-transparent pointer-events-none" />
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background/60 to-transparent pointer-events-none z-0" />

                {/* Legend */}
                <div className="absolute bottom-4 left-0 right-0 flex flex-wrap gap-4 justify-center pointer-events-none z-10">
                    <div className="bg-card/80 backdrop-blur-md px-4 py-2 rounded-full border border-border/50 shadow-lg flex gap-4">
                        {["aws", "azure", "gcp", "okta", "github", "gitlab"].map((s) => (
                            <div key={s} className="flex items-center gap-1.5">
                                <div className="h-2.5 w-2.5 rounded-full shadow-inner" style={{ backgroundColor: getNodeColor(s) }} />
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{s}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
