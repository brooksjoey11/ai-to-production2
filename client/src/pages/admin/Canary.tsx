import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Activity } from "lucide-react";

export default function Canary() {
    const [config, setConfig] = useState({
        enabled: false,
        percent: 5,
        model: '',
        provider: ''
    });

    const canaryConfigQuery = trpc.admin.getCanaryConfig.useQuery();
    const providersQuery = trpc.admin.getProviders.useQuery();
    const updateCanary = trpc.admin.updateCanaryConfig.useMutation();

    const providers = providersQuery.data?.providers || [];
    const selectedProvider = providers.find(p => String(p.id) === String(config.provider));
    const models = selectedProvider?.models || [];

    return (
        <div className="space-y-6">
            <div className="border-2 border-black p-4">
                <div className="flex items-center gap-2 mb-4">
                    <Activity className="h-5 w-5" />
                    <span className="font-bold uppercase tracking-widest text-xs">Canary Deployment</span>
                </div>

                <div className="space-y-4">
                    {/* Enable Toggle */}
                    <div className="flex items-center justify-between p-3 bg-gray-50">
                        <div>
                            <span className="font-medium">Enable Canary</span>
                            <p className="text-xs text-gray-500 mt-1">
                                Route a percentage of traffic to test new models
                            </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={config.enabled}
                                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-black rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
                        </label>
                    </div>

                    {/* Percentage Slider */}
                    <div>
                        <label className="text-sm font-medium mb-1 block">
                            Traffic Percentage: {config.percent}%
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={config.percent}
                            onChange={(e) => setConfig({ ...config, percent: parseInt(e.target.value) })}
                            className="w-full"
                            disabled={!config.enabled}
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>0% (off)</span>
                            <span>50%</span>
                            <span>100% (all)</span>
                        </div>
                    </div>

                    {/* Provider & Model Selection */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium mb-1 block">Provider</label>
                            <select
                                value={config.provider}
                                onChange={(e) => setConfig({ ...config, provider: e.target.value, model: '' })}
                                className="w-full px-3 py-2 border-2 border-black"
                                disabled={!config.enabled}
                            >
                                <option value="">Select Provider</option>
                                {providers.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-sm font-medium mb-1 block">Model</label>
                            <select
                                value={config.model}
                                onChange={(e) => setConfig({ ...config, model: e.target.value })}
                                className="w-full px-3 py-2 border-2 border-black"
                                disabled={!config.provider || !config.enabled}
                            >
                                <option value="">Select Model</option>
                                {models.filter(m => m.isEnabled).map(m => (
                                    <option key={m.id} value={m.modelName}>{m.displayName || m.modelName}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Save Button */}
                    <div className="flex justify-end">
                        <Button
                            onClick={() => updateCanary.mutate(config)}
                            disabled={!config.enabled || !config.provider || !config.model}
                        >
                            Save Canary Configuration
                        </Button>
                    </div>
                </div>
            </div>

            {/* Canary Status */}
            {config.enabled && (
                <div className="border-2 border-black p-4">
                    <h4 className="font-bold mb-4">Canary Status</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-gray-50">
                            <div className="text-sm text-gray-500">Active Canary</div>
                            <div className="font-mono text-lg">{config.model}</div>
                            <div className="text-xs text-gray-500 mt-1">via {selectedProvider?.name}</div>
                        </div>
                        <div className="p-3 bg-gray-50">
                            <div className="text-sm text-gray-500">Traffic Split</div>
                            <div className="font-mono text-lg">{config.percent}% canary / {100 - config.percent}% production</div>
                        </div>
                    </div>

                    {/* Metrics */}
                    <div className="mt-4">
                        <h5 className="font-medium mb-2">Canary Performance</h5>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>Success Rate</span>
                                <span className="font-mono">98.5%</span>
                            </div>
                            <div className="w-full bg-gray-200 h-2">
                                <div className="h-2 bg-green-500" style={{ width: '98.5%' }} />
                            </div>

                            <div className="flex justify-between text-sm mt-3">
                                <span>Average Latency</span>
                                <span className="font-mono">412ms</span>
                            </div>
                            <div className="w-full bg-gray-200 h-2">
                                <div className="h-2 bg-blue-500" style={{ width: '70%' }} />
                            </div>

                            <div className="flex justify-between text-sm mt-3">
                                <span>Error Rate</span>
                                <span className="font-mono">1.5%</span>
                            </div>
                            <div className="w-full bg-gray-200 h-2">
                                <div className="h-2 bg-red-500" style={{ width: '1.5%' }} />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
