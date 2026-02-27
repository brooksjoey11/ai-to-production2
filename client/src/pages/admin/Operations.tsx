import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, RefreshCw, Trash2, Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function Operations() {
    const [activeTab, setActiveTab] = useState("failed-jobs");
    const [selectedJob, setSelectedJob] = useState<any>(null);
    const [showPayload, setShowPayload] = useState(false);

    const failedJobsQuery = trpc.admin.getFailedJobs.useQuery({ limit: 50, offset: 0 }, { refetchInterval: 10000 });
    const idempotencyQuery = trpc.admin.getIdempotencyKeys.useQuery({ limit: 50, offset: 0 });

    const retryJob = trpc.admin.retryJob.useMutation({ onSuccess: () => failedJobsQuery.refetch() });
    const deleteJob = trpc.admin.deleteDeadLetter.useMutation({ onSuccess: () => failedJobsQuery.refetch() });

    return (
        <div className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="w-full bg-transparent p-0 h-auto gap-0 rounded-none mb-6">
                    <TabsTrigger value="failed-jobs" className="flex-1 px-4 py-3 border-2 border-black font-bold uppercase tracking-wider text-xs rounded-none data-[state=active]:bg-black data-[state=active]:text-white">
                        Failed Jobs
                        {(failedJobsQuery.data?.total ?? 0) > 0 && (
                            <Badge className="ml-2 bg-red-500 text-white">{failedJobsQuery.data?.total}</Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="idempotency" className="flex-1 px-4 py-3 border-2 border-black font-bold uppercase tracking-wider text-xs rounded-none data-[state=active]:bg-black data-[state=active]:text-white">
                        Idempotency Keys
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="failed-jobs">
                    <div className="border-2 border-black">
                        <div className="border-b-2 border-black px-4 py-3 bg-gray-50 flex items-center justify-between">
                            <span className="font-bold uppercase tracking-widest text-xs">Dead Letter Queue</span>
                            <Button variant="ghost" size="sm" onClick={() => failedJobsQuery.refetch()}>
                                <RefreshCw className="h-4 w-4 mr-1" />Refresh
                            </Button>
                        </div>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-gray-100">
                                    <TableRow>
                                        <TableHead className="font-bold">Time</TableHead>
                                        <TableHead className="font-bold">Job ID</TableHead>
                                        <TableHead className="font-bold">Step</TableHead>
                                        <TableHead className="font-bold">Provider</TableHead>
                                        <TableHead className="font-bold">Error</TableHead>
                                        <TableHead className="font-bold">Retries</TableHead>
                                        <TableHead className="font-bold">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {failedJobsQuery.data?.jobs.map(job => (
                                        <TableRow key={job.id} className="hover:bg-gray-50">
                                            <TableCell className="font-mono text-xs">
                                                {job.failedAt ? formatDistanceToNow(new Date(job.failedAt), { addSuffix: true }) : '-'}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs">{job.jobId.substring(0, 8)}...</TableCell>
                                            <TableCell><Badge variant="outline" className="font-mono text-xs">{job.step || 'unknown'}</Badge></TableCell>
                                            <TableCell>{job.provider || '-'}</TableCell>
                                            <TableCell className="max-w-xs">
                                                <div className="flex items-center gap-1">
                                                    <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                                                    <span className="text-sm truncate">{job.errorMessage}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">{job.retryCount}</TableCell>
                                            <TableCell>
                                                <div className="flex gap-1">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelectedJob(job); setShowPayload(true); }}>
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" onClick={() => retryJob.mutate({ jobId: job.id })}>
                                                        <RefreshCw className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => deleteJob.mutate({ jobId: job.id })}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {(!failedJobsQuery.data?.jobs?.length) && (
                                        <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-500">No failed jobs. Everything is running smoothly.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                    {showPayload && selectedJob && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
                                <div className="border-b-2 border-black px-4 py-3 flex justify-between items-center">
                                    <span className="font-bold uppercase tracking-widest">Job Payload</span>
                                    <Button variant="ghost" size="sm" onClick={() => setShowPayload(false)}>✕</Button>
                                </div>
                                <div className="p-4 overflow-auto max-h-[60vh]">
                                    <pre className="text-xs font-mono bg-gray-50 p-4 rounded border">{JSON.stringify(selectedJob.payload, null, 2)}</pre>
                                </div>
                                <div className="border-t-2 border-black px-4 py-3 flex justify-end">
                                    <Button onClick={() => setShowPayload(false)}>Close</Button>
                                </div>
                            </div>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="idempotency">
                    <div className="border-2 border-black">
                        <div className="border-b-2 border-black px-4 py-3 bg-gray-50">
                            <span className="font-bold uppercase tracking-widest text-xs">Recent Idempotent Requests</span>
                        </div>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-gray-100">
                                    <TableRow>
                                        <TableHead className="font-bold">Key</TableHead>
                                        <TableHead className="font-bold">User</TableHead>
                                        <TableHead className="font-bold">Submission</TableHead>
                                        <TableHead className="font-bold">Created</TableHead>
                                        <TableHead className="font-bold">Expires</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {idempotencyQuery.data?.keys.map(key => (
                                        <TableRow key={key.id}>
                                            <TableCell className="font-mono text-xs">{key.idempotencyKey.substring(0, 16)}...</TableCell>
                                            <TableCell>User #{key.userId}</TableCell>
                                            <TableCell>#{key.submissionId || '-'}</TableCell>
                                            <TableCell>{key.createdAt ? new Date(key.createdAt).toLocaleString() : '-'}</TableCell>
                                            <TableCell>{new Date(key.expiresAt).toLocaleString()}</TableCell>
                                        </TableRow>
                                    ))}
                                    {(!idempotencyQuery.data?.keys?.length) && (
                                        <TableRow><TableCell colSpan={5} className="text-center py-8 text-gray-500">No idempotency keys in recent history.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
