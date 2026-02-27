import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Plus,
    Edit,
    RefreshCw,
    CheckCircle,
    XCircle,
    AlertCircle,
    Eye,
    EyeOff,
    ChevronDown,
    ChevronUp,
    Search
} from "lucide-react";
import { toast } from "sonner";

export default function Providers() {
    const [expandedProvider, setExpandedProvider] = useState<number | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showKeyModal, setShowKeyModal] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const providersQuery = trpc.admin.getProviders.useQuery(undefined, { refetchInterval: 30000 });
    const testConnection = trpc.admin.testProviderConnection.useMutation({
        onSuccess: (data) => {
            toast.success(data.message || 'Connection test completed');
            providersQuery.refetch();
        },
        onError: (error) => toast.error(error.message)
    });
    const syncModels = trpc.admin.syncProviderModels.useMutation({
        onSuccess: (data) => {
            toast.success(`Synced ${data.count} models`);
            providersQuery.refetch();
        }
    });
    const toggleProvider = trpc.admin.toggleProvider.useMutation({
        onSuccess: () => providersQuery.refetch()
    });

    const filteredProviders = providersQuery.data?.providers.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div className="relative w-64">
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="Search providers..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8"
                    />
                </div>
                <Button onClick={() => setShowAddModal(true)} className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Add Provider
                </Button>
            </div>

            {/* Providers List */}
            <div className="space-y-4">
                {filteredProviders.map(provider => (
                    <div key={provider.id} className="border-2 border-black">
                        {/* Provider Header */}
                        <div
                            className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                            onClick={() => setExpandedProvider(expandedProvider === provider.id ? null : provider.id)}
                        >
                            <div className="flex items-center gap-4">
                                {expandedProvider === provider.id ?
                                    <ChevronUp className="h-5 w-5" /> :
                                    <ChevronDown className="h-5 w-5" />
                                }
                                <div>
                                    <span className="font-bold text-lg">{provider.name}</span>
                                    <Badge variant="outline" className="ml-2 font-mono text-xs">
                                        v{provider.version || '1'}
                                    </Badge>
                                </div>
                                <Badge className={
                                    provider.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                }>
                                    {provider.isActive ? 'Active' : 'Inactive'}
                                </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                                {provider.apiKey?.lastTestStatus === 'ok' && (
                                    <Badge className="bg-green-100 text-green-800 flex items-center gap-1">
                                        <CheckCircle className="h-3 w-3" />
                                        Connected
                                    </Badge>
                                )}
                                {provider.apiKey?.lastTestStatus === 'failed' && (
                                    <Badge className="bg-red-100 text-red-800 flex items-center gap-1">
                                        <XCircle className="h-3 w-3" />
                                        Failed
                                    </Badge>
                                )}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowKeyModal(provider);
                                    }}
                                >
                                    <Edit className="h-4 w-4 mr-1" />
                                    API Key
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleProvider.mutate({ providerId: provider.id });
                                    }}
                                >
                                    {provider.isActive ? 'Disable' : 'Enable'}
                                </Button>
                            </div>
                        </div>

                        {/* Expanded Content */}
                        {expandedProvider === provider.id && (
                            <div className="border-t-2 border-black p-4 bg-gray-50">
                                <div className="grid grid-cols-2 gap-6">
                                    {/* Provider Details */}
                                    <div>
                                        <h4 className="font-bold uppercase tracking-widest text-xs mb-3">Configuration</h4>
                                        <div className="space-y-2">
                                            <div className="flex justify-between">
                                                <span className="text-sm text-gray-600">Base URL:</span>
                                                <span className="font-mono text-sm">{provider.baseUrl}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-sm text-gray-600">Auth Type:</span>
                                                <span className="font-mono text-sm uppercase">{provider.authType}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-sm text-gray-600">Header:</span>
                                                <span className="font-mono text-sm">{provider.authHeaderName}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-sm text-gray-600">Prefix:</span>
                                                <span className="font-mono text-sm">"{provider.authPrefix}"</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-sm text-gray-600">Last Test:</span>
                                                <span className="font-mono text-sm">
                                                    {provider.apiKey?.lastTested
                                                        ? new Date(provider.apiKey.lastTested).toLocaleString()
                                                        : 'Never'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex gap-2 mt-4">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => testConnection.mutate({ providerId: provider.id })}
                                                disabled={!provider.apiKey?.hasKey}
                                                className="flex items-center gap-1"
                                            >
                                                <RefreshCw className="h-3 w-3" />
                                                Test Connection
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => syncModels.mutate({ providerId: provider.id })}
                                                disabled={!provider.apiKey?.hasKey}
                                                className="flex items-center gap-1"
                                            >
                                                <RefreshCw className="h-3 w-3" />
                                                Sync Models
                                            </Button>
                                        </div>

                                        {provider.apiKey?.lastTestStatus === 'failed' && provider.apiKey.lastTestMessage && (
                                            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded flex items-start gap-2">
                                                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                                                <div>
                                                    <span className="text-sm font-medium text-red-800">Test Failed:</span>
                                                    <p className="text-sm text-red-700 mt-1">{provider.apiKey.lastTestMessage}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Models List */}
                                    <div>
                                        <div className="flex justify-between items-center mb-3">
                                            <h4 className="font-bold uppercase tracking-widest text-xs">Available Models</h4>
                                            <span className="text-xs bg-black text-white px-2 py-1">
                                                {provider.models?.filter(m => m.isEnabled).length || 0} / {provider.models?.length || 0} enabled
                                            </span>
                                        </div>
                                        <div className="max-h-80 overflow-y-auto border">
                                            {provider.models?.map(model => (
                                                <div key={model.id} className="flex items-center justify-between p-2 border-b last:border-b-0 hover:bg-white">
                                                    <div>
                                                        <div className="font-mono text-sm">{model.modelName}</div>
                                                        {model.displayName && (
                                                            <div className="text-xs text-gray-500">{model.displayName}</div>
                                                        )}
                                                        {model.contextLength && (
                                                            <Badge variant="outline" className="text-xs mt-1">
                                                                {model.contextLength.toLocaleString()} ctx
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <input
                                                        type="checkbox"
                                                        checked={model.isEnabled ?? false}
                                                        onChange={() => { /* Toggle model mutation */ }}
                                                        className="h-4 w-4"
                                                    />
                                                </div>
                                            ))}
                                            {(!provider.models || provider.models.length === 0) && (
                                                <div className="p-4 text-center text-gray-500">
                                                    No models synced yet. Click "Sync Models" to fetch.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ))}

                {filteredProviders.length === 0 && (
                    <div className="border-2 border-black p-8 text-center">
                        <p className="text-gray-500">No providers configured yet.</p>
                        <Button onClick={() => setShowAddModal(true)} className="mt-4">
                            Add Your First Provider
                        </Button>
                    </div>
                )}
            </div>

            {/* Add Provider Modal */}
            {showAddModal && (
                <AddProviderModal onClose={() => setShowAddModal(false)} onSuccess={() => providersQuery.refetch()} />
            )}

            {/* API Key Modal */}
            {showKeyModal && (
                <ApiKeyModal
                    provider={showKeyModal}
                    onClose={() => setShowKeyModal(null)}
                    onSuccess={() => providersQuery.refetch()}
                />
            )}
        </div>
    );
}

function AddProviderModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
    const [formData, setFormData] = useState({
        name: '',
        baseUrl: '',
        authType: 'bearer' as 'bearer' | 'header' | 'basic' | 'custom',
        authHeaderName: 'Authorization',
        authPrefix: 'Bearer ',
        version: 'v1',
        testPrompt: 'test'
    });

    const addProvider = trpc.admin.addProvider.useMutation({
        onSuccess: () => {
            toast.success('Provider added successfully');
            onSuccess();
            onClose();
        },
        onError: (error) => toast.error(error.message)
    });

    const commonProviders = [
        { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', authPrefix: 'Bearer ' },
        { name: 'Anthropic', baseUrl: 'https://api.anthropic.com/v1', authPrefix: 'Bearer ' },
        { name: 'Mistral', baseUrl: 'https://api.mistral.ai/v1', authPrefix: 'Bearer ' },
        { name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', authPrefix: 'Bearer ' },
        { name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', authPrefix: 'Bearer ' },
        { name: 'Together', baseUrl: 'https://api.together.xyz/v1', authPrefix: 'Bearer ' }
    ];

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden">
                <div className="border-b-2 border-black px-4 py-3 flex justify-between items-center">
                    <span className="font-bold uppercase tracking-widest">Add API Provider</span>
                    <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
                </div>
                <div className="p-6 overflow-auto max-h-[70vh]">
                    <div className="mb-6">
                        <label className="text-xs font-medium mb-2 block">Quick Fill (optional)</label>
                        <select
                            className="w-full px-3 py-2 border-2 border-black"
                            onChange={(e) => {
                                const provider = commonProviders.find(p => p.name === e.target.value);
                                if (provider) {
                                    setFormData({ ...formData, name: provider.name, baseUrl: provider.baseUrl, authPrefix: provider.authPrefix });
                                }
                            }}
                        >
                            <option value="">Select a provider template...</option>
                            {commonProviders.map(p => (
                                <option key={p.name} value={p.name}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium mb-1 block">Provider Name *</label>
                            <Input
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g., OpenRouter, Mistral, OpenAI"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium mb-1 block">Base URL *</label>
                            <Input
                                value={formData.baseUrl}
                                onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                                placeholder="https://api.openrouter.ai/v1"
                                className="font-mono text-sm"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium mb-1 block">Auth Type</label>
                                <select
                                    value={formData.authType}
                                    onChange={(e) => setFormData({ ...formData, authType: e.target.value as 'bearer' | 'header' | 'basic' | 'custom' })}
                                    className="w-full px-3 py-2 border-2 border-black"
                                >
                                    <option value="bearer">Bearer Token</option>
                                    <option value="header">Custom Header</option>
                                    <option value="basic">Basic Auth</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1 block">Version</label>
                                <Input
                                    value={formData.version}
                                    onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                                    placeholder="v1"
                                    className="font-mono"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium mb-1 block">Header Name</label>
                                <Input
                                    value={formData.authHeaderName}
                                    onChange={(e) => setFormData({ ...formData, authHeaderName: e.target.value })}
                                    placeholder="Authorization"
                                    className="font-mono"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1 block">Header Prefix</label>
                                <Input
                                    value={formData.authPrefix}
                                    onChange={(e) => setFormData({ ...formData, authPrefix: e.target.value })}
                                    placeholder="Bearer "
                                    className="font-mono"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-medium mb-1 block">Test Prompt (optional)</label>
                            <Input
                                value={formData.testPrompt}
                                onChange={(e) => setFormData({ ...formData, testPrompt: e.target.value })}
                                placeholder="test"
                                className="font-mono"
                            />
                        </div>
                    </div>
                </div>
                <div className="border-t-2 border-black px-4 py-3 flex justify-end gap-2">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button
                        onClick={() => addProvider.mutate(formData)}
                        disabled={!formData.name || !formData.baseUrl}
                    >
                        Add Provider
                    </Button>
                </div>
            </div>
        </div>
    );
}

function ApiKeyModal({ provider, onClose, onSuccess }: { provider: any; onClose: () => void; onSuccess: () => void }) {
    const [apiKey, setApiKey] = useState('');
    const [showKey, setShowKey] = useState(false);

    const updateKey = trpc.admin.updateProviderKey.useMutation({
        onSuccess: () => {
            toast.success('API key updated');
            onSuccess();
            onClose();
        },
        onError: (error) => toast.error(error.message)
    });

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg max-w-lg w-full">
                <div className="border-b-2 border-black px-4 py-3 flex justify-between items-center">
                    <span className="font-bold uppercase tracking-widest">API Key - {provider.name}</span>
                    <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="text-sm font-medium mb-1 block">API Key</label>
                        <div className="relative">
                            <Input
                                type={showKey ? 'text' : 'password'}
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="sk-..."
                                className="font-mono pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => setShowKey(!showKey)}
                                className="absolute right-2 top-1/2 transform -translate-y-1/2"
                            >
                                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            Key will be encrypted before storage. Never logged.
                        </p>
                    </div>

                    {provider.apiKey?.lastTestMessage && (
                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                            <span className="text-xs font-medium">Previous test result:</span>
                            <p className="text-sm mt-1">{provider.apiKey.lastTestMessage}</p>
                        </div>
                    )}
                </div>
                <div className="border-t-2 border-black px-4 py-3 flex justify-end gap-2">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button
                        onClick={() => updateKey.mutate({ providerId: provider.id, keyValue: apiKey })}
                        disabled={!apiKey}
                    >
                        Save Key
                    </Button>
                </div>
            </div>
        </div>
    );
}
