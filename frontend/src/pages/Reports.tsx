import { useRef, useState, type ChangeEvent } from "react";
import { ReportDashboard } from "@/components/reports/ReportDashboard";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PentestReport } from "@/types/pentest-report";
import { parseDocxFile } from "@/lib/docx-parser";
import { Loader2, UploadCloud, FileText, RefreshCw } from "lucide-react";

const MAX_SIZE_MB = 50; // effectively no limit since parsing is client-side

const Reports = () => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [report, setReport] = useState<PentestReport | null>(null);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".docx")) {
      setError("Only .docx files are supported.");
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`File is too large (max ${MAX_SIZE_MB} MB).`);
      return;
    }

    setParsing(true);
    setError(null);

    try {
      const result = await parseDocxFile(file);
      if (!result.findings.length) {
        setError(
          "Parsed report but found 0 findings. Ensure the DOCX uses the standard summary and detail table format."
        );
        return;
      }
      setReport(result);
      setFileName(file.name);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to parse the file";
      setError(msg);
    } finally {
      setParsing(false);
    }
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-6 w-full max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Pentest Report Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Upload a pentest report (.docx) to generate a live dashboard.
            Files are parsed entirely in-browser — nothing is uploaded to the server.
          </p>
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
          if (file) handleFile(file);
        }}
      >
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center">
              <UploadCloud className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <p className="text-sm font-semibold">Upload pentest report</p>
              <p className="text-xs text-muted-foreground">
                Drop a .docx file here or browse. Parsed locally — no size limits, no uploads.
              </p>
              {error && (
                <p className="text-xs text-destructive mt-2">⚠ {error}</p>
              )}
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
              disabled={parsing}
            >
              {parsing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Parsing…
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
                disabled={parsing}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Replace
              </Button>
            )}
          </div>
        </div>
      </Card>

      {parsing && (
        <Card className="p-4 flex items-center gap-3 border border-destructive/30 bg-secondary">
          <Loader2 className="h-5 w-5 animate-spin text-destructive" />
          <p className="text-sm font-medium">Parsing report in browser…</p>
        </Card>
      )}

      {!report && !parsing && (
        <Card className="p-6 text-center text-muted-foreground space-y-2">
          <FileText className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="text-sm">
            Upload a DOCX pentest report to see findings rendered as an interactive dashboard.
          </p>
        </Card>
      )}

      {report && <ReportDashboard report={report} />}
    </div>
  );
};

export default Reports;
