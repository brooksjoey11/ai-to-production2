import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Activity, Zap, Clock, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

export default function Metrics() {
    const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('1h');
    const metricsQuery = trpc.admin.getMetrics.useQuery({ range: timeRange });
    const healthQuery = trpc.admin.getSystemHealth.useQuery(undefined, { refetchInterval: 30000 });

    const data = metricsQuery.data || {
        requestsPerMinute: 0,
        errorRate: 0,
        queueDepth: 0,
        tokenUsage: 0,
        avgLatency: 0,
        providerStats: [] as Array<{ name: string; successRate: number; avgLatency: number }>,
        tokenUsageByStep: {} as Record<string, number>,
    };

    return (
        <div className="space-y-6">
            {/* Time Range Selector */}
            <div className="flex justify-end gap-2">
                {(['1h', '6h', '24h', '7d'] as const).map(range => (
                    <button
                        key={range}
                        onClick={() => setTimeRange(range)}
                        className={`px-3 py-1 border-2 border-black text-xs font-bold uppercase transition-colors ${
                            timeRange === range ? 'bg-black text-white' : 'bg-white text-black hover:bg-gray-100'
                        }`}
                    >
                        {range}
                    </button>
                ))}
            </div>

            {/* System Health Widget */}
            <div className="border-2 border-black p-4">
                <div className="flex items-center justify-between mb-4">
                    <span className="font-bold uppercase tracking-widest text-xs">System Health</span>
                    <Badge variant="outline" className="font-mono text-xs">
                        Last check: {healthQuery.data?.timestamp || 'N/A'}
                    </Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="border p-3">
                        <div className="text-xs text-gray-500 mb-1">Database</div>
                        <div className="flex items-center gap-2">
                            {healthQuery.data?.database.status === 'ok' ? (
                                <CheckCircle className="h-5 w-5 text-green-500" />
                            ) : (
                                <XCircle className="h-5 w-5 text-red-500" />
                            )}
                            <span className="font-mono text-sm">
                                {healthQuery.data?.database.latencyMs ?? '-'}ms
                            </span>
                        </div>
                    </div>
                    <div className="border p-3">
                        <div className="text-xs text-gray-500 mb-1">Redis</div>
                        <div className="flex items-center gap-2">
                            {healthQuery.data?.redis.status === 'ok' ? (
                                <CheckCircle className="h-5 w-5 text-green-500" />
                            ) : (
                                <XCircle className="h-5 w-5 text-red-500" />
                            )}
                            <span className="font-mono text-sm">
                                {healthQuery.data?.redis.latencyMs ?? '-'}ms
                            </span>
                        </div>
                    </div>
                    {healthQuery.data?.providers.map(provider => (
                        <div key={provider.name} className="border p-3">
                            <div className="text-xs text-gray-500 mb-1">{provider.name}</div>
                            <div className="flex items-center gap-2">
                                {provider.status === 'ok' ? (
                                    <CheckCircle className="h-5 w-5 text-green-500" />
                                ) : provider.status === 'degraded' ? (
                                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                                ) : (
                                    <XCircle className="h-5 w-5 text-red-500" />
                                )}
                                <span className="font-mono text-sm">
                                    {provider.latencyMs ?? '-'}ms
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="border-2 border-black">
                    <CardHeader className="border-b-2 border-black py-3">
                        <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                            <Activity className="h-4 w-4" />
                            Requests / min
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <div className="text-3xl font-bold font-mono">{data.requestsPerMinute}</div>
                        <div className="text-xs text-gray-500 mt-1">
                            {data.errorRate}% error rate
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-2 border-black">
                    <CardHeader className="border-b-2 border-black py-3">
                        <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Queue Depth
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <div className="text-3xl font-bold font-mono">{data.queueDepth}</div>
                        <div className="text-xs text-gray-500 mt-1">
                            jobs waiting
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-2 border-black">
                    <CardHeader className="border-b-2 border-black py-3">
                        <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                            <Zap className="h-4 w-4" />
                            Token Usage
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <div className="text-3xl font-bold font-mono">{(data.tokenUsage / 1000).toFixed(1)}K</div>
                        <div className="text-xs text-gray-500 mt-1">
                            past {timeRange}
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-2 border-black">
                    <CardHeader className="border-b-2 border-black py-3">
                        <CardTitle className="text-xs font-bold uppercase tracking-widest">Avg Latency</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <div className="text-3xl font-bold font-mono">{data.avgLatency}ms</div>
                        <div className="text-xs text-gray-500 mt-1">
                            per request
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Provider Performance */}
            <Tabs defaultValue="success-rate">
                <TabsList className="w-full bg-transparent p-0 h-auto gap-0 rounded-none mb-4">
                    <TabsTrigger
                        value="success-rate"
                        className="flex-1 px-4 py-2 border-2 border-black text-xs font-bold uppercase rounded-none data-[state=active]:bg-black data-[state=active]:text-white"
                    >
                        Success Rate by Provider
                    </TabsTrigger>
                    <TabsTrigger
                        value="latency"
                        className="flex-1 px-4 py-2 border-2 border-black text-xs font-bold uppercase rounded-none data-[state=active]:bg-black data-[state=active]:text-white"
                    >
                        Latency by Provider
                    </TabsTrigger>
                    <TabsTrigger
                        value="tokens"
                        className="flex-1 px-4 py-2 border-2 border-black text-xs font-bold uppercase rounded-none data-[state=active]:bg-black data-[state=active]:text-white"
                    >
                        Token Usage by Step
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="success-rate">
                    <div className="border-2 border-black p-4">
                        <div className="space-y-4">
                            {data.providerStats.map(provider => (
                                <div key={provider.name}>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="font-medium">{provider.name}</span>
                                        <span className="font-mono">{provider.successRate}%</span>
                                    </div>
                                    <div className="w-full bg-gray-200 h-2">
                                        <div
                                            className="h-2 bg-black"
                                            style={{ width: `${provider.successRate}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="latency">
                    <div className="border-2 border-black p-4">
                        <div className="space-y-4">
                            {data.providerStats.map(provider => (
                                <div key={provider.name} className="flex justify-between items-center">
                                    <span className="font-medium">{provider.name}</span>
                                    <span className="font-mono text-lg">{provider.avgLatency}ms</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="tokens">
                    <div className="border-2 border-black p-4">
                        <div className="space-y-4">
                            {['forensic', 'rebuilder', 'quality'].map(step => (
                                <div key={step} className="flex justify-between items-center">
                                    <span className="font-medium uppercase">{step}</span>
                                    <span className="font-mono text-lg">{data.tokenUsageByStep?.[step] || 0}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
