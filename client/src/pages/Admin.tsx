import { useAuth } from "@/_core/hooks/useAuth";
import Header from "@/components/Header";
import { trpc } from "@/lib/trpc";
import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Save, Loader2, RefreshCw, Database } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { APP_CONFIG } from "@shared/config";

const PIPELINE_STEPS = ["forensic", "rebuilder", "quality"] as const;
type StepName = (typeof PIPELINE_STEPS)[number];

const STEP_LABELS: Record<StepName, string> = {
  forensic: "FORENSIC ANALYSIS",
  rebuilder: "CODE REBUILDER",
  quality: "QUALITY CHECK",
};

export default function Admin() {
  const { user, loading } = useAuth({ redirectOnUnauthenticated: true });

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="border-4 border-black p-8 animate-pulse">
            <span className="font-mono text-lg uppercase tracking-widest">Loading...</span>
          </div>
        </main>
      </div>
    );
  }

  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="border-4 border-black p-8">
            <h1 className="text-2xl font-black uppercase tracking-tight mb-2">ACCESS DENIED</h1>
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

// ─── Prompt Editor ───

function PromptEditor() {
  const [activeStep, setActiveStep] = useState<StepName>("forensic");
  const [editedPrompts, setEditedPrompts] = useState<Record<string, string>>({});
  const utils = trpc.useUtils();

  const promptsQuery = trpc.admin.getPrompts.useQuery();
  const updateMutation = trpc.admin.updatePrompt.useMutation({
    onSuccess: () => {
      utils.admin.getPrompts.invalidate();
      toast.success("Prompt updated successfully");
    },
    onError: (err) => toast.error(err.message),
  });

  const seedMutation = trpc.admin.seedDefaults.useMutation({
    onSuccess: () => {
      utils.admin.getPrompts.invalidate();
      utils.admin.getModels.invalidate();
      setEditedPrompts({});
      toast.success("Defaults seeded successfully");
    },
    onError: (err) => toast.error(err.message),
  });

  const currentPrompt = editedPrompts[activeStep] ?? promptsQuery.data?.[activeStep] ?? "";

  const handleSave = useCallback(() => {
    updateMutation.mutate({ step: activeStep, promptText: currentPrompt });
  }, [activeStep, currentPrompt, updateMutation]);

  const hasChanges = editedPrompts[activeStep] !== undefined &&
    editedPrompts[activeStep] !== (promptsQuery.data?.[activeStep] ?? "");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-0">
          {PIPELINE_STEPS.map((step) => (
            <button
              key={step}
              onClick={() => setActiveStep(step)}
              className={`px-4 py-2 border-2 border-black text-xs font-bold uppercase tracking-wider -mr-[2px] transition-colors ${
                activeStep === step ? "bg-black text-white" : "bg-white text-black hover:bg-muted"
              }`}
            >
              {STEP_LABELS[step]}
            </button>
          ))}
        </div>
        <button
          onClick={() => seedMutation.mutate()}
          disabled={seedMutation.isPending}
          className="flex items-center gap-2 px-3 py-2 border-2 border-black text-xs font-bold uppercase hover:bg-black hover:text-white transition-colors"
        >
          <Database className="size-3" />
          {seedMutation.isPending ? "SEEDING..." : "SEED DEFAULTS"}
        </button>
      </div>

      <div className="border-2 border-black">
        <div className="border-b-2 border-black px-4 py-2 flex items-center justify-between">
          <span className="font-bold uppercase tracking-widest text-xs">
            {STEP_LABELS[activeStep]} PROMPT
          </span>
          {hasChanges && (
            <span className="text-xs font-mono bg-black text-white px-2 py-0.5">UNSAVED</span>
          )}
        </div>
        {promptsQuery.isLoading ? (
          <div className="p-8 flex items-center justify-center">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : (
          <textarea
            value={currentPrompt}
            onChange={(e) => setEditedPrompts((prev) => ({ ...prev, [activeStep]: e.target.value }))}
            className="w-full min-h-[400px] p-4 font-mono text-sm bg-white resize-y focus:outline-none"
            spellCheck={false}
          />
        )}
      </div>

      <button
        onClick={handleSave}
        disabled={!hasChanges || updateMutation.isPending}
        className="btn-brutal flex items-center gap-2 text-xs"
      >
        {updateMutation.isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Save className="size-4" />
        )}
        SAVE PROMPT
      </button>
    </div>
  );
}

// ─── Model Config ───

function ModelConfig() {
  const utils = trpc.useUtils();
  const modelsQuery = trpc.admin.getModels.useQuery();
  const availableModelsQuery = trpc.admin.getAvailableModels.useQuery();
  const updateMutation = trpc.admin.updateModel.useMutation({
    onSuccess: () => {
      utils.admin.getModels.invalidate();
      toast.success("Model updated successfully");
    },
    onError: (err) => toast.error(err.message),
  });

  const availableModels = availableModelsQuery.data ?? [];

  return (
    <div className="space-y-4">
      <p className="font-mono text-sm text-muted-foreground">
        Select the LLM model for each pipeline step. Changes take effect immediately (cache is invalidated on save).
      </p>

      {PIPELINE_STEPS.map((step) => {
        const currentModel = modelsQuery.data?.[step] ?? APP_CONFIG.defaultModel;
        return (
          <div key={step} className="border-2 border-black">
            <div className="border-b-2 border-black px-4 py-3 flex items-center justify-between">
              <span className="font-bold uppercase tracking-widest text-xs">{STEP_LABELS[step]}</span>
              <span className="font-mono text-xs bg-black text-white px-2 py-0.5">
                {currentModel.toUpperCase()}
              </span>
            </div>
            <div className="p-4">
              <select
                value={currentModel}
                onChange={(e) => updateMutation.mutate({ step, model: e.target.value })}
                disabled={updateMutation.isPending}
                className="w-full px-4 py-3 border-2 border-black font-mono text-sm bg-white focus:outline-none appearance-none cursor-pointer"
              >
                {availableModels.map((model) => (
                  <option key={model} value={model}>
                    {model.toUpperCase()}
                  </option>
                ))}
                {!(availableModels as readonly string[]).includes(currentModel) && (
                  <option value={currentModel}>{currentModel.toUpperCase()}</option>
                )}
              </select>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Submission History ───

function SubmissionHistory() {
  const submissionsQuery = trpc.admin.getSubmissions.useQuery({ limit: 50, offset: 0 });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-mono text-sm text-muted-foreground">
          Recent code submissions across all users.
        </p>
        <button
          onClick={() => submissionsQuery.refetch()}
          className="flex items-center gap-2 px-3 py-2 border-2 border-black text-xs font-bold uppercase hover:bg-black hover:text-white transition-colors"
        >
          <RefreshCw className="size-3" />
          REFRESH
        </button>
      </div>

      <div className="border-2 border-black overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-black bg-black text-white">
              <th className="p-3 text-left font-bold uppercase tracking-widest text-xs">ID</th>
              <th className="p-3 text-left font-bold uppercase tracking-widest text-xs">USER</th>
              <th className="p-3 text-left font-bold uppercase tracking-widest text-xs">LANGUAGE</th>
              <th className="p-3 text-left font-bold uppercase tracking-widest text-xs">DATE</th>
            </tr>
          </thead>
          <tbody>
            {submissionsQuery.isLoading ? (
              <tr>
                <td colSpan={4} className="p-8 text-center">
                  <Loader2 className="size-6 animate-spin mx-auto" />
                </td>
              </tr>
            ) : submissionsQuery.data?.submissions.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center font-mono text-sm text-muted-foreground">
                  NO SUBMISSIONS YET
                </td>
              </tr>
            ) : (
              submissionsQuery.data?.submissions.map((sub) => (
                <tr key={sub.id} className="border-b-2 border-black last:border-b-0 hover:bg-muted transition-colors">
                  <td className="p-3 font-mono text-sm font-bold">#{sub.id}</td>
                  <td className="p-3 font-mono text-sm">{sub.userName || sub.userEmail || `User #${sub.userId}`}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 border-2 border-black font-mono text-xs font-bold uppercase">
                      {sub.language}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-sm">
                    {new Date(sub.createdAt).toLocaleDateString()} {new Date(sub.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
