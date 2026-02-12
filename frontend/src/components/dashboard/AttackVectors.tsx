import { Card } from "@/components/ui/card";
import { attackVectorsData } from "@/data/mockData";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

const AttackVectors = () => (
  <Card className="p-5 animate-fade-in animate-fade-in-delay-3">
    <h3 className="text-sm font-semibold mb-4">Attack Vectors Overview</h3>
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={attackVectorsData} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,92%)" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(0,0%,64%)" tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(0,0%,64%)" tickLine={false} axisLine={false} width={90} />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(0,0%,100%)",
              border: "1px solid hsl(0,0%,90%)",
              borderRadius: "0.5rem",
              fontSize: 12,
            }}
          />
          <Bar dataKey="count" fill="hsl(0,72%,51%)" radius={[0, 4, 4, 0]} barSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </Card>
);

export default AttackVectors;
