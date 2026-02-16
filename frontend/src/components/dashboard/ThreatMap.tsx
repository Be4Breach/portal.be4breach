import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useState } from "react";
import worldMap from "@/assets/world-map.jpg";

// Map dimensions must match the SVG viewBox
const MAP_WIDTH = 800;
const MAP_HEIGHT = 400;
// Calibrate padding to align dots with the background image (tweak if you change the map asset)
const PAD_X = 24;
const PAD_Y = 12;
const OFFSET_X = -6; // fine-tune horizontal alignment (negative = left)
const OFFSET_Y = 6;  // fine-tune vertical alignment (positive = down)

const mapToSvg = (lat: number, lng: number) => {
  const x = PAD_X + ((lng + 180) / 360) * (MAP_WIDTH - PAD_X * 2) + OFFSET_X;
  const y = PAD_Y + ((90 - lat) / 180) * (MAP_HEIGHT - PAD_Y * 2) + OFFSET_Y;
  return { x, y };
};

const ThreatMap = () => {
  const { data, loading } = useDashboardData();
  const [hovered, setHovered] = useState<string | null>(null);

  if (loading || !data) {
    return (
      <Card className="p-5 animate-fade-in animate-fade-in-delay-4">
        <h3 className="text-sm font-semibold mb-4">Geographical Threat Origins</h3>
        <div className="h-64 flex items-center justify-center">
          <Skeleton className="h-full w-full" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5 animate-fade-in animate-fade-in-delay-4">
      <h3 className="text-sm font-semibold mb-4">Geographical Threat Origins</h3>
      <div className="relative overflow-hidden rounded-lg bg-secondary/40">
        <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} className="w-full h-auto">
          <defs>
            <pattern id="mapTexture" patternUnits="userSpaceOnUse" width={MAP_WIDTH} height={MAP_HEIGHT}>
              <image
                href={worldMap}
                x="0"
                y="0"
                width={MAP_WIDTH}
                height={MAP_HEIGHT}
                opacity="0.35"
                preserveAspectRatio="xMidYMid slice"
              />
            </pattern>
          </defs>

          {/* Map background */}
          <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#mapTexture)" />

          {data.geoThreatData.map((point) => {
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
                  opacity={0.85}
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
