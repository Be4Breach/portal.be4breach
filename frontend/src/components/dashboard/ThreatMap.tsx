import { Card } from "@/components/ui/card";
import { geoThreatData } from "@/data/mockData";
import { useState } from "react";

const mapToSvg = (lat: number, lng: number) => {
  const x = ((lng + 180) / 360) * 800;
  const y = ((90 - lat) / 180) * 400;
  return { x, y };
};

const ThreatMap = () => {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <Card className="p-5 animate-fade-in animate-fade-in-delay-4">
      <h3 className="text-sm font-semibold mb-4">Geographical Threat Origins</h3>
      <div className="relative overflow-hidden rounded-lg bg-secondary/50">
        <svg viewBox="0 0 800 400" className="w-full h-auto">
          {/* Simplified continent outlines */}
          <ellipse cx="200" cy="180" rx="90" ry="70" fill="hsl(0,0%,88%)" opacity={0.6} />
          <ellipse cx="380" cy="160" rx="70" ry="80" fill="hsl(0,0%,88%)" opacity={0.6} />
          <ellipse cx="420" cy="280" rx="40" ry="50" fill="hsl(0,0%,88%)" opacity={0.6} />
          <ellipse cx="530" cy="180" rx="100" ry="70" fill="hsl(0,0%,88%)" opacity={0.6} />
          <ellipse cx="650" cy="280" rx="50" ry="40" fill="hsl(0,0%,88%)" opacity={0.6} />
          <ellipse cx="270" cy="300" rx="50" ry="60" fill="hsl(0,0%,88%)" opacity={0.6} />

          {geoThreatData.map((point) => {
            const { x, y } = mapToSvg(point.lat, point.lng);
            const r = 4 + point.intensity * 12;
            return (
              <g key={point.country}>
                <circle cx={x} cy={y} r={r + 6} fill="hsl(0,72%,51%)" opacity={0.1}>
                  <animate attributeName="r" values={`${r + 2};${r + 10};${r + 2}`} dur="3s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.15;0.05;0.15" dur="3s" repeatCount="indefinite" />
                </circle>
                <circle
                  cx={x}
                  cy={y}
                  r={r}
                  fill={`hsl(0, 72%, ${60 - point.intensity * 25}%)`}
                  opacity={0.8}
                  className="cursor-pointer transition-all"
                  onMouseEnter={() => setHovered(point.country)}
                  onMouseLeave={() => setHovered(null)}
                />
                {hovered === point.country && (
                  <g>
                    <rect x={x + r + 4} y={y - 18} width={120} height={32} rx={4} fill="hsl(0,0%,10%)" opacity={0.9} />
                    <text x={x + r + 12} y={y - 2} fill="white" fontSize={10} fontWeight={600}>{point.country}</text>
                    <text x={x + r + 12} y={y + 10} fill="hsl(0,0%,70%)" fontSize={9}>{point.count.toLocaleString()} threats</text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </Card>
  );
};

export default ThreatMap;
