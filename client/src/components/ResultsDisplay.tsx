import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useCallback } from "react";
import { Copy, Download, FileArchive, RotateCcw, Check } from "lucide-react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

interface PipelineResult {
  submissionId: number;
  forensicDossier: string;
  rebuiltCode: string;
  qualityReport: string;
  tokensUsed: number;
}

interface ResultsDisplayProps {
  result: PipelineResult;
  onNewAnalysis: () => void;
}

export default function ResultsDisplay({ result, onNewAnalysis }: ResultsDisplayProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight">
            ANALYSIS RESULTS
          </h2>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            SUBMISSION #{result.submissionId} &mdash; {result.tokensUsed.toLocaleString()} TOKENS USED
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportAll(result)}
            className="flex items-center gap-2 px-4 py-2 border-2 border-black text-xs font-bold uppercase hover:bg-black hover:text-white transition-colors"
          >
            <FileArchive className="size-4" />
            EXPORT ALL
          </button>
          <button
            onClick={onNewAnalysis}
            className="btn-brutal flex items-center gap-2 text-xs"
          >
            <RotateCcw className="size-4" />
            NEW ANALYSIS
          </button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="forensic" className="w-full">
        <TabsList className="w-full bg-transparent p-0 h-auto gap-0 rounded-none">
          <TabsTrigger
            value="forensic"
            className="flex-1 px-4 py-3 border-2 border-black font-bold uppercase tracking-wider text-xs rounded-none data-[state=active]:bg-black data-[state=active]:text-white data-[state=active]:border-black data-[state=inactive]:bg-white data-[state=inactive]:text-black -mr-[2px] first:mr-0"
          >
            FORENSIC DOSSIER
          </TabsTrigger>
          <TabsTrigger
            value="rebuilt"
            className="flex-1 px-4 py-3 border-2 border-black font-bold uppercase tracking-wider text-xs rounded-none data-[state=active]:bg-black data-[state=active]:text-white data-[state=active]:border-black data-[state=inactive]:bg-white data-[state=inactive]:text-black -mr-[2px]"
          >
            REBUILT CODE
          </TabsTrigger>
          <TabsTrigger
            value="quality"
            className="flex-1 px-4 py-3 border-2 border-black font-bold uppercase tracking-wider text-xs rounded-none data-[state=active]:bg-black data-[state=active]:text-white data-[state=active]:border-black data-[state=inactive]:bg-white data-[state=inactive]:text-black"
          >
            QUALITY REPORT
          </TabsTrigger>
        </TabsList>

        <TabsContent value="forensic" className="mt-0">
          <div className="border-2 border-black border-t-0">
            <div className="border-b-2 border-black px-4 py-2 flex items-center justify-between">
              <span className="font-bold uppercase tracking-widest text-xs">FORENSIC ANALYSIS</span>
              <CopyButton text={result.forensicDossier} />
            </div>
            <div className="p-6 prose prose-sm max-w-none font-mono [&_h1]:font-black [&_h1]:uppercase [&_h1]:tracking-tight [&_h2]:font-black [&_h2]:uppercase [&_h2]:tracking-tight [&_h3]:font-bold [&_h3]:uppercase">
              <Streamdown>{result.forensicDossier}</Streamdown>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="rebuilt" className="mt-0">
          <div className="border-2 border-black border-t-0">
            <div className="border-b-2 border-black px-4 py-2 flex items-center justify-between">
              <span className="font-bold uppercase tracking-widest text-xs">REBUILT CODE</span>
              <div className="flex items-center gap-2">
                <CopyButton text={result.rebuiltCode} />
                <button
                  onClick={() => downloadFile("rebuilt-code.txt", result.rebuiltCode)}
                  className="flex items-center gap-1 px-2 py-1 border-2 border-black text-xs font-bold uppercase hover:bg-black hover:text-white transition-colors"
                >
                  <Download className="size-3" />
                  DOWNLOAD
                </button>
              </div>
            </div>
            <pre className="p-6 overflow-x-auto bg-white">
              <code className="font-mono text-sm whitespace-pre">{result.rebuiltCode}</code>
            </pre>
          </div>
        </TabsContent>

        <TabsContent value="quality" className="mt-0">
          <div className="border-2 border-black border-t-0">
            <div className="border-b-2 border-black px-4 py-2 flex items-center justify-between">
              <span className="font-bold uppercase tracking-widest text-xs">QUALITY REPORT</span>
              <CopyButton text={result.qualityReport} />
            </div>
            <div className="p-6 prose prose-sm max-w-none font-mono [&_h1]:font-black [&_h1]:uppercase [&_h2]:font-black [&_h2]:uppercase [&_li]:marker:text-black">
              <Streamdown>{result.qualityReport}</Streamdown>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 px-2 py-1 border-2 border-black text-xs font-bold uppercase hover:bg-black hover:text-white transition-colors"
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      {copied ? "COPIED" : "COPY"}
    </button>
  );
}

function downloadFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`Downloaded ${filename}`);
}

function exportAll(result: PipelineResult) {
  const content = `=== FORENSIC DOSSIER ===\n\n${result.forensicDossier}\n\n=== REBUILT CODE ===\n\n${result.rebuiltCode}\n\n=== QUALITY REPORT ===\n\n${result.qualityReport}\n\n=== METADATA ===\nSubmission ID: ${result.submissionId}\nTokens Used: ${result.tokensUsed}`;
  downloadFile(`analysis-${result.submissionId}.txt`, content);
}
