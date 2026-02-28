import Header from "@/components/Header";
import { trpc } from "@/lib/trpc";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Save, RotateCcw, Eye, Copy } from "lucide-react";

type StepName = "forensic" | "rebuilder" | "quality";

const STEP_LABELS: Record<StepName, string> = {
  forensic: "FORENSIC",
  rebuilder: "REBUILDER",
  quality: "QUALITY",
};

const STEP_HELP: Record<StepName, string> = {
  forensic: "Forensic analysis of the submission and system context.",
  rebuilder: "Code reconstruction / remediation output step.",
  quality: "Final polish / validation / quality assurance step.",
};

function StepPills({
  value,
  onChange,
}: {
  value: StepName;
  onChange: (v: StepName) => void;
}) {
  const steps: StepName[] = ["forensic", "rebuilder", "quality"];
  return (
    <div className="flex flex-wrap gap-2">
      {steps.map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          className={`px-4 py-2 border-2 border-black font-bold uppercase tracking-wider text-xs transition-colors ${
            value === s
              ? "bg-black text-white"
              : "bg-white text-black hover:bg-black hover:text-white"
          }`}
        >
          {STEP_LABELS[s]}
        </button>
      ))}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  return (
    <button
      className="inline-flex items-center gap-2 px-3 py-2 border-2 border-black bg-white text-black font-bold uppercase tracking-wider text-[10px] hover:bg-black hover:text-white transition-colors"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          toast.success("Copied");
        } catch {
          toast.error("Copy failed");
        }
      }}
      type="button"
    >
      <Copy className="size-3.5" />
      COPY
    </button>
  );
}

export default function Admin() {
  const meQuery = trpc.auth.me.useQuery(undefined, {
    refetchOnWindowFocus: true,
  });

  const user = meQuery.data;
  const loading = meQuery.isLoading;

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <Header />
        <main className="flex-1 container py-10">
          <div className="border-4 border-black p-8">
            <div className="h-8 w-64 border-2 border-black animate-pulse bg-muted" />
            <div className="h-4 w-96 border-2 border-black animate-pulse bg-muted mt-4" />
            <div className="h-64 border-2 border-black animate-pulse bg-muted mt-8" />
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="border-4 border-black p-8">
            <h1 className="text-2xl font-black uppercase tracking-tight mb-2">
              UNAUTHORIZED
            </h1>
            <p className="font-mono text-sm">Authentication required.</p>
          </div>
        </main>
      </div>
    );
  }

  if (user.role !== "admin") {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="border-4 border-black p-8">
            <h1 className="text-2xl font-black uppercase tracking-tight mb-2">
              ACCESS DENIED
            </h1>
            <p className="font-mono text-sm">Admin privileges required.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <main className="flex-1 container py-8">
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight">
            ADMIN DASHBOARD
          </h1>
          <p className="font-mono text-sm text-muted-foreground mt-2">
            Configure pipeline prompts, models, and view submission history.
          </p>
        </div>

        <Tabs defaultValue="prompts" className="w-full">
          <TabsList className="w-full bg-transparent p-0 h-auto gap-0 rounded-none mb-6">
            <TabsTrigger
              value="prompts"
              className="flex-1 px-4 py-3 border-2 border-black font-bold uppercase tracking-wider text-xs rounded-none data-[state=active]:bg-black data-[state=active]:text-white -mr-[2px]"
            >
              SYSTEM PROMPTS
            </TabsTrigger>
            <TabsTrigger
              value="models"
              className="flex-1 px-4 py-3 border-2 border-black font-bold uppercase tracking-wider text-xs rounded-none data-[state=active]:bg-black data-[state=active]:text-white -mr-[2px]"
            >
              MODEL CONFIG
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="flex-1 px-4 py-3 border-2 border-black font-bold uppercase tracking-wider text-xs rounded-none data-[state=active]:bg-black data-[state=active]:text-white"
            >
              SUBMISSIONS
            </TabsTrigger>
          </TabsList>

          <TabsContent value="prompts">
            <PromptEditor />
          </TabsContent>
          <TabsContent value="models">
            <ModelConfig />
          </TabsContent>
          <TabsContent value="history">
            <SubmissionHistory />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="border-t-4 border-black py-6">
        <div className="container">
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest text-center">
            AI TO PRODUCTION &mdash; ADMIN PANEL
          </p>
        </div>
      </footer>
    </div>
  );
}

function PromptEditor() {
  const [activeStep, setActiveStep] = useState<StepName>("forensic");
  const [editedPrompts, setEditedPrompts] = useState<Record<string, string>>({});
  const utils = trpc.useUtils();

  const promptsQuery = trpc.admin.getPrompts.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const updatePromptMutation = trpc.admin.updatePrompt.useMutation({
    onSuccess: async () => {
      toast.success("Prompt updated");
      await utils.admin.getPrompts.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update prompt");
    },
  });

  const seedDefaultsMutation = trpc.admin.seedDefaults.useMutation({
    onSuccess: async () => {
      toast.success("Defaults seeded");
      await utils.admin.getPrompts.invalidate();
      await utils.admin.getModels.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to seed defaults");
    },
  });

  const isBusy =
    promptsQuery.isLoading ||
    updatePromptMutation.isPending ||
    seedDefaultsMutation.isPending;

  const currentPromptText = useMemo(() => {
    const serverPrompts = promptsQuery.data;
    const edited = editedPrompts[activeStep];
    if (typeof edited === "string") return edited;
    if (!serverPrompts) return "";
    return serverPrompts[activeStep] ?? "";
  }, [activeStep, editedPrompts, promptsQuery.data]);

  const hasLocalEdits = useMemo(() => {
    const serverPrompts = promptsQuery.data;
    if (!serverPrompts) return false;
    const server = serverPrompts[activeStep] ?? "";
    const edited = editedPrompts[activeStep];
    return typeof edited === "string" && edited !== server;
  }, [activeStep, editedPrompts, promptsQuery.data]);

  return (
    <div className="border-4 border-black p-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight">
              PROMPT EDITOR
            </h2>
            <p className="font-mono text-xs text-muted-foreground mt-1">
              {STEP_HELP[activeStep]}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="border-2 border-black rounded-none font-bold uppercase tracking-wider text-xs"
              onClick={() => promptsQuery.refetch()}
              disabled={isBusy}
            >
              {promptsQuery.isFetching ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 size-4" />
              )}
              REFRESH
            </Button>
            <Button
              className="border-2 border-black rounded-none font-bold uppercase tracking-wider text-xs bg-black text-white hover:bg-white hover:text-black"
              onClick={() => seedDefaultsMutation.mutate()}
              disabled={isBusy}
            >
              {seedDefaultsMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <RotateCcw className="mr-2 size-4" />
              )}
              SEED DEFAULTS
            </Button>
          </div>
        </div>

        <Separator className="bg-black h-[2px]" />

        <StepPills value={activeStep} onChange={setActiveStep} />

        <div className="grid gap-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Badge className="rounded-none border-2 border-black bg-white text-black font-mono text-[10px] uppercase tracking-widest">
                STEP: {STEP_LABELS[activeStep]}
              </Badge>
              {hasLocalEdits && (
                <Badge className="rounded-none border-2 border-black bg-black text-white font-mono text-[10px] uppercase tracking-widest">
                  UNSAVED
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <CopyButton text={currentPromptText} />
              <Button
                className="border-2 border-black rounded-none font-bold uppercase tracking-wider text-xs bg-black text-white hover:bg-white hover:text-black"
                onClick={() =>
                  updatePromptMutation.mutate({
                    step: activeStep,
                    promptText: currentPromptText,
                  })
                }
                disabled={isBusy || currentPromptText.trim().length === 0}
              >
                {updatePromptMutation.isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Save className="mr-2 size-4" />
                )}
                SAVE
              </Button>
            </div>
          </div>

          <Textarea
            value={currentPromptText}
            onChange={(e) =>
              setEditedPrompts((prev) => ({
                ...prev,
                [activeStep]: e.target.value,
              }))
            }
            className="min-h-[340px] border-2 border-black rounded-none font-mono text-xs leading-5"
            placeholder="Enter system prompt..."
            disabled={promptsQuery.isLoading}
          />

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="font-mono text-xs text-muted-foreground">
              {promptsQuery.data
                ? `Loaded from server. Edits tracked per-step locally until saved.`
                : `Loading prompts...`}
            </p>

            <Button
              variant="outline"
              className="border-2 border-black rounded-none font-bold uppercase tracking-wider text-xs"
              onClick={() =>
                setEditedPrompts((prev) => {
                  const copy = { ...prev };
                  delete copy[activeStep];
                  return copy;
                })
              }
              disabled={!hasLocalEdits || isBusy}
            >
              <RotateCcw className="mr-2 size-4" />
              DISCARD LOCAL CHANGES
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModelConfig() {
  const [activeStep, setActiveStep] = useState<StepName>("forensic");
  const utils = trpc.useUtils();

  const modelsQuery = trpc.admin.getModels.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const availableModelsQuery = trpc.admin.getAvailableModels.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const updateModelMutation = trpc.admin.updateModel.useMutation({
    onSuccess: async () => {
      toast.success("Model updated");
      await utils.admin.getModels.invalidate();
      await utils.admin.getAvailableModels.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update model");
    },
  });

  const isBusy =
    modelsQuery.isLoading ||
    availableModelsQuery.isLoading ||
    updateModelMutation.isPending;

  const currentModel = modelsQuery.data?.[activeStep] ?? "";
  const availableModels = availableModelsQuery.data ?? [];

  return (
    <div className="border-4 border-black p-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight">
              MODEL CONFIG
            </h2>
            <p className="font-mono text-xs text-muted-foreground mt-1">
              Select which model each pipeline step uses for LLM execution.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="border-2 border-black rounded-none font-bold uppercase tracking-wider text-xs"
              onClick={() => {
                modelsQuery.refetch();
                availableModelsQuery.refetch();
              }}
              disabled={isBusy}
            >
              {(modelsQuery.isFetching || availableModelsQuery.isFetching) ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 size-4" />
              )}
              REFRESH
            </Button>
          </div>
        </div>

        <Separator className="bg-black h-[2px]" />

        <StepPills value={activeStep} onChange={setActiveStep} />

        <div className="grid gap-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Badge className="rounded-none border-2 border-black bg-white text-black font-mono text-[10px] uppercase tracking-widest">
              STEP: {STEP_LABELS[activeStep]}
            </Badge>
            <div className="flex items-center gap-2">
              <CopyButton text={currentModel} />
            </div>
          </div>

          <div className="border-2 border-black p-4">
            <div className="grid gap-2">
              <p className="font-mono text-xs text-muted-foreground">
                Current model:
              </p>
              <p className="font-mono text-sm font-bold break-all">
                {currentModel || "—"}
              </p>
            </div>
          </div>

          <div className="grid gap-2">
            <p className="font-mono text-xs text-muted-foreground">
              Select a model:
            </p>
            <Select
              value={currentModel || undefined}
              onValueChange={(v) =>
                updateModelMutation.mutate({ step: activeStep, model: v })
              }
              disabled={isBusy || availableModels.length === 0}
            >
              <SelectTrigger className="border-2 border-black rounded-none font-mono text-xs">
                <SelectValue placeholder="Choose model..." />
              </SelectTrigger>
              <SelectContent className="border-2 border-black rounded-none">
                {availableModels.map((m) => (
                  <SelectItem
                    key={m}
                    value={m}
                    className="rounded-none font-mono text-xs"
                  >
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="font-mono text-xs text-muted-foreground">
                {availableModels.length > 0
                  ? `${availableModels.length} available model(s) loaded.`
                  : "No models available."}
              </p>
              {updateModelMutation.isPending && (
                <p className="font-mono text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 className="size-3.5 animate-spin" />
                  Applying update...
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type AdminSubmissionRow = {
  id: number;
  userId: number;
  userEmail?: string | null;
  userName?: string | null;
  language: string;
  createdAt: Date;
  hasResult: boolean;
};

type AdminSubmissionResult = {
  submission: {
    id: number;
    userId: number;
    originalCode: string;
    language: string;
    userComments?: string | null;
    createdAt: Date;
  };
  result: null | {
    id: number;
    submissionId: number;
    jobId: string;
    forensicAnalysis: string;
    rebuiltCode: string;
    qualityNotes: string;
    createdAt: Date;
  };
};

function SubmissionHistory() {
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const limit = 20;
  const offset = page * limit;

  const utils = trpc.useUtils();
  const submissionsQuery = trpc.admin.getSubmissions.useQuery(
    { limit, offset },
    { refetchOnWindowFocus: false, keepPreviousData: true }
  );

  const selectedResultQuery = trpc.admin.getSubmissionResult.useQuery(
    { submissionId: selectedId ?? 0 },
    { enabled: selectedId != null, refetchOnWindowFocus: false }
  );

  const rows: AdminSubmissionRow[] = submissionsQuery.data?.items ?? [];
  const total = submissionsQuery.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / limit));

  const isBusy = submissionsQuery.isLoading || submissionsQuery.isFetching;

  const viewResult = (id: number) => {
    setSelectedId(id);
  };

  const closeDialog = () => {
    setSelectedId(null);
  };

  const renderRowMeta = (r: AdminSubmissionRow) => {
    const displayUser =
      (r.userName && r.userName.trim()) ||
      (r.userEmail && r.userEmail.trim()) ||
      `User ${r.userId}`;
    return (
      <div className="grid gap-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs">
            <span className="font-bold">ID:</span> {r.id}
          </span>
          <span className="font-mono text-xs text-muted-foreground">—</span>
          <span className="font-mono text-xs">
            <span className="font-bold">LANG:</span> {r.language}
          </span>
          <span className="font-mono text-xs text-muted-foreground">—</span>
          <span className="font-mono text-xs">
            <span className="font-bold">USER:</span> {displayUser}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            className={`rounded-none border-2 border-black font-mono text-[10px] uppercase tracking-widest ${
              r.hasResult
                ? "bg-black text-white"
                : "bg-white text-black"
            }`}
          >
            {r.hasResult ? "RESULT READY" : "PENDING"}
          </Badge>
          <span className="font-mono text-xs text-muted-foreground">
            {new Date(r.createdAt).toLocaleString()}
          </span>
        </div>
      </div>
    );
  };

  const resultData: AdminSubmissionResult | undefined =
    selectedResultQuery.data ?? undefined;

  return (
    <div className="border-4 border-black p-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight">
              SUBMISSIONS
            </h2>
            <p className="font-mono text-xs text-muted-foreground mt-1">
              View submissions across all users (admin-only).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="border-2 border-black rounded-none font-bold uppercase tracking-wider text-xs"
              onClick={() => {
                submissionsQuery.refetch();
                if (selectedId != null) {
                  utils.admin.getSubmissionResult.invalidate({
                    submissionId: selectedId,
                  } as any);
                }
              }}
              disabled={isBusy}
            >
              {submissionsQuery.isFetching ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 size-4" />
              )}
              REFRESH
            </Button>
          </div>
        </div>

        <Separator className="bg-black h-[2px]" />

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Badge className="rounded-none border-2 border-black bg-white text-black font-mono text-[10px] uppercase tracking-widest">
              TOTAL: {total}
            </Badge>
            <Badge className="rounded-none border-2 border-black bg-white text-black font-mono text-[10px] uppercase tracking-widest">
              PAGE: {page + 1}/{pageCount}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="border-2 border-black rounded-none font-bold uppercase tracking-wider text-xs"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page <= 0 || isBusy}
            >
              PREV
            </Button>
            <Button
              variant="outline"
              className="border-2 border-black rounded-none font-bold uppercase tracking-wider text-xs"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={page >= pageCount - 1 || isBusy}
            >
              NEXT
            </Button>
          </div>
        </div>

        <div className="grid gap-3">
          {rows.length === 0 && !submissionsQuery.isLoading ? (
            <div className="border-2 border-black p-6">
              <p className="font-mono text-sm">No submissions found.</p>
            </div>
          ) : (
            rows.map((r) => (
              <div
                key={r.id}
                className="border-2 border-black p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                {renderRowMeta(r)}
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <CopyButton text={String(r.id)} />
                  <Dialog open={selectedId === r.id} onOpenChange={(o) => (o ? viewResult(r.id) : closeDialog())}>
                    <DialogTrigger asChild>
                      <Button
                        className="border-2 border-black rounded-none font-bold uppercase tracking-wider text-xs bg-black text-white hover:bg-white hover:text-black"
                        onClick={() => viewResult(r.id)}
                      >
                        <Eye className="mr-2 size-4" />
                        VIEW
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl border-4 border-black rounded-none p-0 overflow-hidden">
                      <div className="p-6 bg-white">
                        <DialogHeader>
                          <DialogTitle className="text-xl font-black uppercase tracking-tight">
                            SUBMISSION {r.id}
                          </DialogTitle>
                          <div className="flex items-center gap-2 flex-wrap mt-2">
                            <Badge className="rounded-none border-2 border-black bg-white text-black font-mono text-[10px] uppercase tracking-widest">
                              LANG: {r.language}
                            </Badge>
                            <Badge className="rounded-none border-2 border-black bg-white text-black font-mono text-[10px] uppercase tracking-widest">
                              USER ID: {r.userId}
                            </Badge>
                            <Badge
                              className={`rounded-none border-2 border-black font-mono text-[10px] uppercase tracking-widest ${
                                r.hasResult ? "bg-black text-white" : "bg-white text-black"
                              }`}
                            >
                              {r.hasResult ? "RESULT READY" : "PENDING"}
                            </Badge>
                          </div>
                        </DialogHeader>

                        <Separator className="bg-black h-[2px] my-4" />

                        <div className="grid gap-4">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                className="border-2 border-black rounded-none font-bold uppercase tracking-wider text-xs"
                                onClick={() => selectedResultQuery.refetch()}
                                disabled={selectedResultQuery.isFetching}
                              >
                                {selectedResultQuery.isFetching ? (
                                  <Loader2 className="mr-2 size-4 animate-spin" />
                                ) : (
                                  <RefreshCw className="mr-2 size-4" />
                                )}
                                REFRESH
                              </Button>
                            </div>
                            <div className="flex items-center gap-2">
                              <CopyButton
                                text={
                                  resultData
                                    ? JSON.stringify(resultData, null, 2)
                                    : `submissionId:${r.id}`
                                }
                              />
                            </div>
                          </div>

                          {selectedResultQuery.isLoading ? (
                            <div className="border-2 border-black p-6">
                              <p className="font-mono text-sm flex items-center gap-2">
                                <Loader2 className="size-4 animate-spin" />
                                Loading details...
                              </p>
                            </div>
                          ) : selectedResultQuery.isError ? (
                            <div className="border-2 border-black p-6">
                              <p className="font-mono text-sm">
                                Failed to load: {selectedResultQuery.error.message}
                              </p>
                            </div>
                          ) : !resultData ? (
                            <div className="border-2 border-black p-6">
                              <p className="font-mono text-sm">No data.</p>
                            </div>
                          ) : (
                            <div className="grid gap-4">
                              <div className="grid gap-2">
                                <h3 className="font-black uppercase tracking-tight">
                                  INPUT
                                </h3>
                                <div className="border-2 border-black p-4">
                                  <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <Badge className="rounded-none border-2 border-black bg-white text-black font-mono text-[10px] uppercase tracking-widest">
                                        CREATED:{" "}
                                        {new Date(
                                          resultData.submission.createdAt
                                        ).toLocaleString()}
                                      </Badge>
                                      {resultData.submission.userComments ? (
                                        <Badge className="rounded-none border-2 border-black bg-black text-white font-mono text-[10px] uppercase tracking-widest">
                                          HAS COMMENTS
                                        </Badge>
                                      ) : (
                                        <Badge className="rounded-none border-2 border-black bg-white text-black font-mono text-[10px] uppercase tracking-widest">
                                          NO COMMENTS
                                        </Badge>
                                      )}
                                    </div>
                                    <CopyButton text={resultData.submission.originalCode} />
                                  </div>
                                  {resultData.submission.userComments ? (
                                    <div className="mb-3 border-2 border-black p-3">
                                      <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                                        USER COMMENTS
                                      </p>
                                      <p className="font-mono text-xs mt-1 whitespace-pre-wrap">
                                        {resultData.submission.userComments}
                                      </p>
                                    </div>
                                  ) : null}
                                  <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-5">
                                    {resultData.submission.originalCode}
                                  </pre>
                                </div>
                              </div>

                              <div className="grid gap-2">
                                <h3 className="font-black uppercase tracking-tight">
                                  OUTPUT
                                </h3>
                                {!resultData.result ? (
                                  <div className="border-2 border-black p-6">
                                    <p className="font-mono text-sm">
                                      Result not available yet.
                                    </p>
                                  </div>
                                ) : (
                                  <div className="grid gap-3">
                                    <div className="border-2 border-black p-4">
                                      <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <Badge className="rounded-none border-2 border-black bg-white text-black font-mono text-[10px] uppercase tracking-widest">
                                            JOB: {resultData.result.jobId}
                                          </Badge>
                                          <Badge className="rounded-none border-2 border-black bg-white text-black font-mono text-[10px] uppercase tracking-widest">
                                            GENERATED:{" "}
                                            {new Date(
                                              resultData.result.createdAt
                                            ).toLocaleString()}
                                          </Badge>
                                        </div>
                                        <CopyButton text={resultData.result.jobId} />
                                      </div>

                                      <Separator className="bg-black h-[2px] my-3" />

                                      <div className="grid gap-3">
                                        <div className="grid gap-1">
                                          <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                                            FORENSIC ANALYSIS
                                          </p>
                                          <div className="border-2 border-black p-3">
                                            <div className="flex justify-end mb-2">
                                              <CopyButton text={resultData.result.forensicAnalysis} />
                                            </div>
                                            <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-5">
                                              {resultData.result.forensicAnalysis}
                                            </pre>
                                          </div>
                                        </div>

                                        <div className="grid gap-1">
                                          <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                                            REBUILT CODE
                                          </p>
                                          <div className="border-2 border-black p-3">
                                            <div className="flex justify-end mb-2">
                                              <CopyButton text={resultData.result.rebuiltCode} />
                                            </div>
                                            <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-5">
                                              {resultData.result.rebuiltCode}
                                            </pre>
                                          </div>
                                        </div>

                                        <div className="grid gap-1">
                                          <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                                            QUALITY NOTES
                                          </p>
                                          <div className="border-2 border-black p-3">
                                            <div className="flex justify-end mb-2">
                                              <CopyButton text={resultData.result.qualityNotes} />
                                            </div>
                                            <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-5">
                                              {resultData.result.qualityNotes}
                                            </pre>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="font-mono text-xs text-muted-foreground">
            Showing {rows.length} row(s). Limit {limit}. Offset {offset}.
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="border-2 border-black rounded-none font-bold uppercase tracking-wider text-xs"
              onClick={() => setPage(0)}
              disabled={page === 0 || isBusy}
            >
              FIRST
            </Button>
            <Button
              variant="outline"
              className="border-2 border-black rounded-none font-bold uppercase tracking-wider text-xs"
              onClick={() => setPage(pageCount - 1)}
              disabled={page === pageCount - 1 || isBusy}
            >
              LAST
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
