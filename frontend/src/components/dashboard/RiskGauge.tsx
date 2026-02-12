import { Card } from "@/components/ui/card";
import { statsData } from "@/data/mockData";

const score = statsData.riskScore;

const getColor = (s: number) => {
  if (s <= 40) return "hsl(142, 71%, 45%)";
  if (s <= 70) return "hsl(45, 93%, 47%)";
  return "hsl(0, 72%, 51%)";
};

const getLabel = (s: number) => {
  if (s <= 40) return "Excellent";
  if (s <= 60) return "Good";
  if (s <= 80) return "Moderate";
  return "Critical";
};

const RiskGauge = () => {
  const angle = (score / 100) * 180;
  const color = getColor(score);
  const r = 70;
  const cx = 90;
  const cy = 90;

  const endX = cx + r * Math.cos(Math.PI - (angle * Math.PI) / 180);
  const endY = cy - r * Math.sin((angle * Math.PI) / 180);
  const largeArc = angle > 180 ? 1 : 0;

  return (
    <Card className="p-5 animate-fade-in animate-fade-in-delay-4 flex flex-col items-center">
      <h3 className="text-sm font-semibold mb-2 self-start">Risk Score</h3>
      <svg viewBox="0 0 180 110" className="w-48 h-auto">
        {/* Background arc */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="hsl(0,0%,90%)"
          strokeWidth={12}
          strokeLinecap="round"
        />
        {/* Score arc */}
        <path
          d={`M ${cx + r} ${cy} A ${r} ${r} 0 ${largeArc} 0 ${endX} ${endY}`}
          fill="none"
          stroke={color}
          strokeWidth={12}
          strokeLinecap="round"
        />
        <text x={cx} y={cy - 8} textAnchor="middle" fontSize={28} fontWeight={700} fill="currentColor">
          {score}
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize={10} fill="hsl(0,0%,45%)">
          / 100
        </text>
      </svg>
      <p className="text-sm font-medium mt-1" style={{ color }}>
        {getLabel(score)}
      </p>
      <p className="text-xs text-muted-foreground text-center mt-1">
        Your security posture requires attention
      </p>
    </Card>
  );
};

export default RiskGauge;
