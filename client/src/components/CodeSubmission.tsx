import { trpc } from "@/lib/trpc";
import { useState, useCallback, useRef, useMemo } from "react";
import { Upload, Loader2, Clock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { APP_CONFIG } from "@shared/config";

const LANGUAGES = APP_CONFIG.supportedLanguages;
type Language = (typeof LANGUAGES)[number];

export interface CodeSubmissionProps {
  onSubmitted: (data: { submissionId: number; jobId: string }) => void;
}

export default function CodeSubmission({ onSubmitted }: CodeSubmissionProps) {
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState<Language>("javascript");
  const [comments, setComments] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const rateLimitQuery = trpc.code.getRateLimit.useQuery(undefined, {
    refetchOnWindowFocus: true,
  });

  const submitMutation = trpc.code.submit.useMutation({
    onSuccess: (data) => {
      onSubmitted({ submissionId: data.submissionId, jobId: data.jobId });
      rateLimitQuery.refetch();
      toast.success("Code submitted! Analysis is running...");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const rateLimit = rateLimitQuery.data;
  const isSubmitting = submitMutation.isPending;

  const canSubmit = useMemo(() => {
    return code.trim().length > 0 && !isSubmitting && (rateLimit?.remaining ?? 1) > 0;
  }, [code, isSubmitting, rateLimit]);

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;

    // Client-side code size check
    const codeBytes = new Blob([code.trim()]).size;
    if (codeBytes > APP_CONFIG.maxCodeSizeBytes) {
      toast.error(`Code exceeds maximum size of ${Math.round(APP_CONFIG.maxCodeSizeBytes / 1000)}KB`);
      return;
    }

    submitMutation.mutate({
      code: code.trim(),
      language,
      userComments: comments.trim() || undefined,
    });
  }, [canSubmit, code, language, comments, submitMutation]);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readFile(file);
  }, []);

  const readFile = (file: File) => {
    if (file.size > APP_CONFIG.maxCodeSizeBytes) {
      toast.error(`File too large (${Math.round(APP_CONFIG.maxCodeSizeBytes / 1000)}KB max)`);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCode(text);
      // Auto-detect language from extension
      const ext = file.name.split(".").pop()?.toLowerCase();
      const langMap: Record<string, Language> = {
        js: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript",
        py: "python", java: "java", cs: "csharp", go: "go", rs: "rust",
        rb: "ruby", php: "php", swift: "swift", kt: "kotlin", c: "c",
        cpp: "cpp", h: "c", sql: "sql", html: "html", css: "css",
        sh: "shell", bash: "shell",
      };
      if (ext && langMap[ext]) setLanguage(langMap[ext]);
      toast.success(`Loaded ${file.name}`);
    };
    reader.readAsText(file);
  };

  const resetTimestamp = rateLimit?.resetAt ? new Date(rateLimit.resetAt) : null;

  return (
    <div className="space-y-6">
      {/* Rate Limit Banner */}
      <div className="border-2 border-black p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`px-3 py-1 border-2 border-black font-mono text-sm font-bold ${
            (rateLimit?.remaining ?? 5) === 0 ? "bg-black text-white" : "bg-white text-black"
          }`}>
            {rateLimit?.remaining ?? "..."} / {rateLimit?.total ?? APP_CONFIG.maxDailySubmissions}
          </div>
          <span className="font-mono text-xs uppercase tracking-wider">
            SUBMISSIONS REMAINING
          </span>
        </div>
        {resetTimestamp && (
          <div className="flex items-center gap-2 font-mono text-xs">
            <Clock className="size-3" />
            <span>RESETS {resetTimestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        )}
      </div>

      {(rateLimit?.remaining ?? 5) === 0 && (
        <div className="border-2 border-black bg-black text-white p-4 flex items-center gap-3">
          <AlertTriangle className="size-5 shrink-0" />
          <span className="font-mono text-sm">
            Daily limit reached. Resets at UTC midnight.
          </span>
        </div>
      )}

      {/* Code Input */}
      <div
        className={`border-2 border-black transition-colors ${isDragging ? "bg-muted" : "bg-white"}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleFileDrop}
      >
        <div className="border-b-2 border-black px-4 py-3 flex items-center justify-between">
          <span className="font-bold uppercase tracking-widest text-xs">CODE INPUT</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-1 border-2 border-black text-xs font-bold uppercase hover:bg-black hover:text-white transition-colors"
            >
              <Upload className="size-3" />
              UPLOAD FILE
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".js,.jsx,.ts,.tsx,.py,.java,.cs,.go,.rs,.rb,.php,.swift,.kt,.c,.cpp,.h,.sql,.html,.css,.sh"
              onChange={handleFileSelect}
            />
          </div>
        </div>
        <textarea
          ref={textareaRef}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Paste your code here or drag & drop a file..."
          className="w-full min-h-[300px] p-4 font-mono text-sm bg-transparent resize-y focus:outline-none placeholder:text-muted-foreground"
          spellCheck={false}
        />
      </div>

      {/* Options Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Language Selector */}
        <div className="border-2 border-black">
          <div className="border-b-2 border-black px-4 py-2">
            <label className="font-bold uppercase tracking-widest text-xs">LANGUAGE</label>
          </div>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="w-full px-4 py-3 font-mono text-sm bg-white focus:outline-none appearance-none cursor-pointer"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {lang.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        {/* Comments */}
        <div className="border-2 border-black">
          <div className="border-b-2 border-black px-4 py-2">
            <label className="font-bold uppercase tracking-widest text-xs">CONTEXT (OPTIONAL)</label>
          </div>
          <input
            type="text"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Known issues, focus areas..."
            className="w-full px-4 py-3 font-mono text-sm bg-white focus:outline-none placeholder:text-muted-foreground"
            maxLength={2000}
          />
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="btn-brutal w-full flex items-center justify-center gap-3 py-4 text-sm"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="size-5 animate-spin" />
            SUBMITTING...
          </>
        ) : (
          <>
            RUN FORENSIC ANALYSIS
          </>
        )}
      </button>
    </div>
  );
}
