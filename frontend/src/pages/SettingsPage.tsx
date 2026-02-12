import { Settings } from "lucide-react";

const SettingsPage = () => (
  <div className="flex flex-col items-center justify-center h-96 text-muted-foreground">
    <Settings className="h-12 w-12 mb-4" />
    <h2 className="text-lg font-semibold text-foreground">Settings</h2>
    <p className="text-sm">Configuration options coming soon.</p>
  </div>
);

export default SettingsPage;
