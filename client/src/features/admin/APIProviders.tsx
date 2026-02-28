import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Loader2, Plus, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

type Provider = {
  id: number;
  name: string;
  baseUrl: string;
  authType: "bearer" | "header" | "custom";
  authHeaderName: string;
  authPrefix: string;
  isActive: boolean;
  lastTested?: string | null;
  lastTestStatus?: string | null;
  lastTestMessage?: string | null;
};

export default function APIProviders() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    baseUrl: "",
    apiKey: "",
  });

  const utils = trpc.useUtils();

  const providersQuery = trpc.admin.getProviders.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const createProvider = trpc.admin.createProvider.useMutation({
    onSuccess: async () => {
      toast.success("Provider created");
      setOpen(false);
      setForm({ name: "", baseUrl: "", apiKey: "" });
      await utils.admin.getProviders.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const testProvider = trpc.admin.testProvider.useMutation({
    onSuccess: async (res, vars) => {
      if (res.success) {
        toast.success("Connection OK");
      } else {
        toast.error(res.message);
      }
      await utils.admin.getProviders.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const isBusy =
    providersQuery.isLoading ||
    createProvider.isPending ||
    testProvider.isPending;

  const providers: Provider[] = providersQuery.data ?? [];

  return (
    <div className="border-4 border-black p-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight">
              API PROVIDERS
            </h2>
            <p className="font-mono text-xs text-muted-foreground mt-1">
              Configure external LLM providers and credentials.
            </p>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="border-2 border-black rounded-none font-bold uppercase text-xs">
                <Plus className="mr-2 size-4" />
                ADD PROVIDER
              </Button>
            </DialogTrigger>
            <DialogContent className="border-4 border-black rounded-none">
              <DialogHeader>
                <DialogTitle className="font-black uppercase">
                  NEW PROVIDER
                </DialogTitle>
              </DialogHeader>

              <div className="grid gap-3">
                <Input
                  placeholder="Provider name (openrouter)"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className="border-2 border-black rounded-none font-mono text-xs"
                />
                <Input
                  placeholder="Base URL"
                  value={form.baseUrl}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, baseUrl: e.target.value }))
                  }
                  className="border-2 border-black rounded-none font-mono text-xs"
                />
                <Input
                  placeholder="API Key"
                  value={form.apiKey}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, apiKey: e.target.value }))
                  }
                  className="border-2 border-black rounded-none font-mono text-xs"
                />

                <Button
                  onClick={() =>
                    createProvider.mutate({
                      name: form.name,
                      baseUrl: form.baseUrl,
                      apiKey: form.apiKey,
                      authType: "bearer",
                      authHeaderName: "Authorization",
                      authPrefix: "Bearer ",
                    })
                  }
                  disabled={
                    isBusy ||
                    !form.name.trim() ||
                    !form.baseUrl.trim() ||
                    !form.apiKey.trim()
                  }
                  className="border-2 border-black rounded-none font-bold uppercase text-xs bg-black text-white"
                >
                  {createProvider.isPending ? (
                    <Loader2 className="animate-spin size-4 mr-2" />
                  ) : null}
                  SAVE
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Separator className="bg-black h-[2px]" />

        <div className="grid gap-3">
          {providers.length === 0 && !providersQuery.isLoading ? (
            <div className="border-2 border-black p-4">
              <p className="font-mono text-sm">No providers configured.</p>
            </div>
          ) : (
            providers.map((p) => (
              <div
                key={p.id}
                className="border-2 border-black p-4 grid gap-3"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold uppercase">
                      {p.name}
                    </span>
                    <Badge className="border-2 border-black rounded-none text-[10px] font-mono uppercase">
                      {p.isActive ? "ACTIVE" : "INACTIVE"}
                    </Badge>
                  </div>

                  <Button
                    variant="outline"
                    onClick={() =>
                      testProvider.mutate({ providerId: p.id })
                    }
                    disabled={isBusy}
                    className="border-2 border-black rounded-none text-xs font-bold uppercase"
                  >
                    {testProvider.isPending ? (
                      <Loader2 className="animate-spin size-4 mr-2" />
                    ) : (
                      <RefreshCw className="size-4 mr-2" />
                    )}
                    TEST
                  </Button>
                </div>

                <div className="grid gap-1">
                  <p className="font-mono text-xs">
                    URL: {p.baseUrl}
                  </p>
                  <p className="font-mono text-xs">
                    Auth: {p.authType}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {p.lastTestStatus === "ok" ? (
                    <Badge className="border-2 border-black bg-black text-white text-[10px] font-mono">
                      <CheckCircle2 className="size-3 mr-1" />
                      CONNECTED
                    </Badge>
                  ) : p.lastTestStatus === "failed" ? (
                    <Badge className="border-2 border-black bg-white text-black text-[10px] font-mono">
                      <XCircle className="size-3 mr-1" />
                      FAILED
                    </Badge>
                  ) : (
                    <Badge className="border-2 border-black text-[10px] font-mono">
                      UNTESTED
                    </Badge>
                  )}

                  {p.lastTested && (
                    <span className="font-mono text-xs text-muted-foreground">
                      {new Date(p.lastTested).toLocaleString()}
                    </span>
                  )}
                </div>

                {p.lastTestMessage && (
                  <div className="border-2 border-black p-2">
                    <p className="font-mono text-xs">
                      {p.lastTestMessage}
                    </p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
