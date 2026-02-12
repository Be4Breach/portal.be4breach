import { AlertTriangle } from "lucide-react";

const Alerts = () => (
  <div className="flex flex-col items-center justify-center h-96 text-muted-foreground">
    <AlertTriangle className="h-12 w-12 mb-4" />
    <h2 className="text-lg font-semibold text-foreground">Alerts</h2>
    <p className="text-sm">Full alert feed coming soon.</p>
  </div>
);

export default Alerts;
