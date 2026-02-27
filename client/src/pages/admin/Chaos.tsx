import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Zap, Shield, Activity } from "lucide-react";
import { toast } from "sonner";

export default function Chaos() {
    const [activeExperiments, setActiveExperiments] = useState<string[]>([]);

    const simulateOutage = trpc.admin.simulateOutage.useMutation({
        onSuccess: (data) => {
            toast.success(`Outage simulation started: ${data.message}`);
            setActiveExperiments(prev => [...prev, data.experimentId]);
        }
    });

    const experiments = [
        {
            id: 'openai-outage',
            name: 'OpenAI Complete Outage',
            description: 'Simulates OpenAI being completely unreachable',
            icon: <AlertTriangle className="h-5 w-5 text-red-500" />,
            action: () => simulateOutage.mutate({ provider: 'openai', type: 'outage' })
        },
        {
            id: 'openai-rate-limit',
            name: 'OpenAI Rate Limited',
            description: 'Simulates hitting OpenAI rate limits (429)',
            icon: <Activity className="h-5 w-5 text-yellow-500" />,
            action: () => simulateOutage.mutate({ provider: 'openai', type: 'rate-limit' })
        },
        {
            id: 'openai-slow',
            name: 'OpenAI Slow Responses',
            description: 'Adds 5-10 second delay to OpenAI responses',
            icon: <Zap className="h-5 w-5 text-blue-500" />,
            action: () => simulateOutage.mutate({ provider: 'openai', type: 'slow' })
        },
        {
            id: 'mistral-outage',
            name: 'Mistral Complete Outage',
            description: 'Simulates Mistral being completely unreachable',
            icon: <AlertTriangle className="h-5 w-5 text-red-500" />,
            action: () => simulateOutage.mutate({ provider: 'mistral', type: 'outage' })
        },
        {
            id: 'redis-down',
            name: 'Redis Unavailable',
            description: 'Simulates Redis being down (tests fallback)',
            icon: <Shield className="h-5 w-5 text-purple-500" />,
            action: () => simulateOutage.mutate({ provider: 'redis', type: 'down' })
        },
        {
            id: 'db-slow',
            name: 'Database Slow Queries',
            description: 'Adds 2-3 second delay to all database queries',
            icon: <Activity className="h-5 w-5 text-orange-500" />,
            action: () => simulateOutage.mutate({ provider: 'database', type: 'slow' })
        }
    ];

    return (
        <div className="space-y-6">
            <div className="border-2 border-black p-4 bg-yellow-50">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="h-6 w-6 text-yellow-600 flex-shrink-0" />
                    <div>
                        <h3 className="font-bold">Chaos Engineering Mode</h3>
                        <p className="text-sm text-gray-700 mt-1">
                            These experiments intentionally degrade system performance to test resilience.
                            Use with caution in development/staging only.
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {experiments.map(exp => (
                    <Card key={exp.id} className="border-2 border-black">
                        <CardHeader className="border-b-2 border-black py-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                                {exp.icon}
                                {exp.name}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <p className="text-sm text-gray-600 mb-4">{exp.description}</p>
                            <Button
                                onClick={exp.action}
                                variant="outline"
                                className="w-full"
                                disabled={activeExperiments.some(id => id.startsWith(exp.id))}
                            >
                                {activeExperiments.some(id => id.startsWith(exp.id)) ? 'Active' : 'Start Experiment'}
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {activeExperiments.length > 0 && (
                <div className="border-2 border-black p-4">
                    <h4 className="font-bold mb-2">Active Experiments</h4>
                    <div className="space-y-2">
                        {activeExperiments.map(id => {
                            const exp = experiments.find(e => id.startsWith(e.id));
                            return (
                                <div key={id} className="flex items-center justify-between p-2 bg-gray-50">
                                    <span>{exp?.name || id}</span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setActiveExperiments(prev => prev.filter(e => e !== id))}
                                    >
                                        Stop
                                    </Button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
