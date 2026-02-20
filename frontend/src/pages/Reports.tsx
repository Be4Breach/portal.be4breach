import { useRef, useState, type ChangeEvent } from "react";
import { ReportDashboard } from "@/components/reports/ReportDashboard";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import BACKEND_URL from "@/lib/api";
import type { PentestReport } from "@/types/pentest-report";
import { Loader2, UploadCloud, FileText, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const Reports = () => {
  const { token } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [report, setReport] = useState<PentestReport | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${BACKEND_URL}/api/reports/pentest-report`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData,
      });

      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        const message = payload?.detail || payload?.message || "Failed to parse the report";
        throw new Error(message);
      }

      setReport(payload.report as PentestReport);
      setFileName(file.name);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to upload file";
      setError(message);
    } finally {
      setUploading(false);
    }
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUpload(file);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-6 w-full max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Pentest Report Dashboard</h1>
          <p className="text-sm text-muted-foreground">Upload a pentest report (.docx) to generate a live dashboard with the same layout as the main console.</p>
        </div>
        {fileName && (
          <Badge variant="secondary" className="text-[11px]">
            Loaded: {fileName}
          </Badge>
        )}
      </div>

      <Card
        className="p-6 border-dashed border-2 border-muted hover:border-destructive transition-colors bg-card"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file) handleUpload(file);
        }}
      >
        <div className="flex flex-col md:flex-row items-center md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center">
              <UploadCloud className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <p className="text-sm font-semibold">Upload pentest report</p>
              <p className="text-xs text-muted-foreground">Drop a .docx file or browse to generate a dashboard that mirrors the main view.</p>
              {error && <p className="text-xs text-destructive mt-2">Error: {error}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx"
              className="hidden"
              onChange={onFileChange}
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Parsing...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Browse
                </>
              )}
            </Button>
            {report && (
              <Button
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Replace file
              </Button>
            )}
          </div>
        </div>
      </Card>

      {uploading && (
        <Card className="p-4 flex items-center gap-3 border border-destructive/30 bg-secondary">
          <Loader2 className="h-5 w-5 animate-spin text-destructive" />
          <p className="text-sm font-medium">Parsing report and building dashboard...</p>
        </Card>
      )}

      {!report && !uploading && (
        <Card className="p-6 text-center text-muted-foreground space-y-2">
          <FileText className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="text-sm">Upload a DOCX pentest report to see findings rendered with the same widgets as your live dashboard.</p>
        </Card>
      )}

      {report && <ReportDashboard report={report} />}
    </div>
  );
};

export default Reports;
