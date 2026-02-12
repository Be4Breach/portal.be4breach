import { Card } from "@/components/ui/card";
import { severityData } from "@/data/mockData";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

const total = severityData.reduce((s, d) => s + d.value, 0);

const SeverityBreakdown = () => (
  <Card className="p-5 animate-fade-in animate-fade-in-delay-2">
    <h3 className="text-sm font-semibold mb-4">Threat Severity Breakdown</h3>
    <div className="h-52 relative">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={severityData}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={80}
            paddingAngle={3}
            dataKey="value"
            stroke="none"
          >
            {severityData.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(0,0%,100%)",
              border: "1px solid hsl(0,0%,90%)",
              borderRadius: "0.5rem",
              fontSize: 12,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center">
          <p className="text-2xl font-bold">{total}</p>
          <p className="text-[10px] text-muted-foreground">Total</p>
        </div>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-2 mt-2">
      {severityData.map((d) => (
        <div key={d.name} className="flex items-center gap-2 text-xs">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
          <span className="text-muted-foreground">{d.name}</span>
          <span className="ml-auto font-medium">{((d.value / total) * 100).toFixed(0)}%</span>
        </div>
      ))}
    </div>
  </Card>
);

export default SeverityBreakdown;
