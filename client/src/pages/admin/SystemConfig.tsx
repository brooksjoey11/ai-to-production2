import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Save, History } from "lucide-react";
import { toast } from "sonner";

export default function SystemConfig() {
    const [editedValues, setEditedValues] = useState<Record<string, any>>({});
    const [showHistory, setShowHistory] = useState<any>(null);

    const configQuery = trpc.admin.getRuntimeConfig.useQuery();
    const updateConfig = trpc.admin.updateRuntimeConfig.useMutation({
        onSuccess: () => {
            toast.success('Configuration updated');
            configQuery.refetch();
            setEditedValues({});
        }
    });

    const configs = configQuery.data || [];

    const handleSave = (key: string) => {
        updateConfig.mutate({
            key,
            value: editedValues[key],
            description: configs.find(c => c.key === key)?.description ?? undefined,
        });
    };

    return (
        <div className="space-y-6">
            <div className="border-2 border-black">
                <div className="border-b-2 border-black px-4 py-3 bg-gray-50">
                    <span className="font-bold uppercase tracking-widest text-xs">
                        Runtime Configuration
                    </span>
                </div>
                <div className="divide-y-2 divide-black">
                    {configs.map(config => (
                        <div key={config.key} className="p-4 hover:bg-gray-50">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-mono text-sm font-bold">{config.key}</span>
                                        <Badge variant="outline" className="text-xs">
                                            v{config.version}
                                        </Badge>
                                        {config.updatedBy && (
                                            <span className="text-xs text-gray-500">
                                                Last updated by User #{config.updatedBy}
                                            </span>
                                        )}
                                    </div>
                                    {config.description && (
                                        <p className="text-sm text-gray-600 mb-2">{config.description}</p>
                                    )}

                                    <div className="flex items-start gap-2">
                                        {typeof config.value === 'boolean' ? (
                                            <select
                                                value={String(editedValues[config.key] ?? config.value)}
                                                onChange={(e) => setEditedValues({
                                                    ...editedValues,
                                                    [config.key]: e.target.value === 'true'
                                                })}
                                                className="px-3 py-2 border-2 border-black font-mono text-sm"
                                            >
                                                <option value="true">true</option>
                                                <option value="false">false</option>
                                            </select>
                                        ) : typeof config.value === 'number' ? (
                                            <Input
                                                type="number"
                                                value={editedValues[config.key] ?? config.value}
                                                onChange={(e) => setEditedValues({
                                                    ...editedValues,
                                                    [config.key]: Number(e.target.value)
                                                })}
                                                className="w-64 font-mono"
                                            />
                                        ) : (
                                            <Input
                                                value={editedValues[config.key] ?? String(config.value)}
                                                onChange={(e) => setEditedValues({
                                                    ...editedValues,
                                                    [config.key]: e.target.value
                                                })}
                                                className="w-96 font-mono"
                                            />
                                        )}

                                        <Button
                                            onClick={() => handleSave(config.key)}
                                            disabled={editedValues[config.key] === undefined}
                                            className="flex items-center gap-1"
                                        >
                                            <Save className="h-4 w-4" />
                                            Save
                                        </Button>

                                        <Button
                                            variant="ghost"
                                            onClick={() => {
                                                const newEdited = { ...editedValues };
                                                delete newEdited[config.key];
                                                setEditedValues(newEdited);
                                            }}
                                            disabled={editedValues[config.key] === undefined}
                                        >
                                            Cancel
                                        </Button>

                                        <Button
                                            variant="ghost"
                                            onClick={() => setShowHistory(config)}
                                        >
                                            <History className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                    {configs.length === 0 && (
                        <div className="p-8 text-center text-gray-500">
                            No runtime configuration entries found.
                        </div>
                    )}
                </div>
            </div>

            {showHistory && (
                <ConfigHistoryModal
                    config={showHistory}
                    onClose={() => setShowHistory(null)}
                />
            )}
        </div>
    );
}

function ConfigHistoryModal({ config, onClose }: { config: any; onClose: () => void }) {
    const historyQuery = trpc.admin.getConfigHistory.useQuery({ key: config.key });

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg max-w-3xl w-full max-h-[80vh] overflow-hidden">
                <div className="border-b-2 border-black px-4 py-3 flex justify-between items-center">
                    <span className="font-bold uppercase tracking-widest">Change History - {config.key}</span>
                    <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
                </div>
                <div className="p-4 overflow-auto max-h-[60vh]">
                    <div className="space-y-4">
                        {historyQuery.data?.map(entry => (
                            <div key={entry.id} className="border p-4">
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="font-mono">{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : '-'}</span>
                                    <span className="font-mono text-xs text-gray-500">{entry.action}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <span className="text-xs font-medium">Before:</span>
                                        <pre className="mt-1 p-2 bg-gray-50 rounded text-xs font-mono overflow-auto">
                                            {JSON.stringify(entry.beforeValue, null, 2)}
                                        </pre>
                                    </div>
                                    <div>
                                        <span className="text-xs font-medium">After:</span>
                                        <pre className="mt-1 p-2 bg-gray-50 rounded text-xs font-mono overflow-auto">
                                            {JSON.stringify(entry.afterValue, null, 2)}
                                        </pre>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {(!historyQuery.data || historyQuery.data.length === 0) && (
                            <div className="text-center py-8 text-gray-500">No history found.</div>
                        )}
                    </div>
                </div>
                <div className="border-t-2 border-black px-4 py-3 flex justify-end">
                    <Button onClick={onClose}>Close</Button>
                </div>
            </div>
        </div>
    );
}
