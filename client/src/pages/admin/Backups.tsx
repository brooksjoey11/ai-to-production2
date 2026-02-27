import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, RefreshCw, Play, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function Backups() {
    const [schedule, setSchedule] = useState('0 2 * * *');

    const backupsQuery = trpc.admin.getBackups.useQuery(undefined, { refetchInterval: 30000 });
    const createBackup = trpc.admin.createBackup.useMutation({
        onSuccess: () => backupsQuery.refetch()
    });
    const updateSchedule = trpc.admin.updateBackupSchedule.useMutation();

    return (
        <div className="space-y-6">
            {/* Backup Schedule */}
            <div className="border-2 border-black p-4">
                <div className="flex items-center gap-2 mb-4">
                    <Clock className="h-5 w-5" />
                    <span className="font-bold uppercase tracking-widest text-xs">Backup Schedule</span>
                </div>
                <div className="flex items-end gap-4">
                    <div className="flex-1">
                        <label className="text-sm font-medium mb-1 block">Cron Expression</label>
                        <Input
                            value={schedule}
                            onChange={(e) => setSchedule(e.target.value)}
                            placeholder="0 2 * * *"
                            className="font-mono"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Daily at 2am = "0 2 * * *"
                        </p>
                    </div>
                    <Button
                        onClick={() => updateSchedule.mutate({ schedule })}
                        className="mb-1"
                    >
                        Save Schedule
                    </Button>
                </div>
            </div>

            {/* Manual Backup */}
            <div className="flex justify-end">
                <Button
                    onClick={() => createBackup.mutate()}
                    disabled={createBackup.isPending}
                    className="flex items-center gap-2"
                >
                    <Play className="h-4 w-4" />
                    Create Backup Now
                </Button>
            </div>

            {/* Backup List */}
            <div className="border-2 border-black overflow-hidden">
                <div className="border-b-2 border-black px-4 py-3 bg-gray-50 flex justify-between items-center">
                    <span className="font-bold uppercase tracking-widest text-xs">
                        Recent Backups
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => backupsQuery.refetch()}>
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Refresh
                    </Button>
                </div>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-gray-100">
                            <TableRow>
                                <TableHead className="font-bold">Filename</TableHead>
                                <TableHead className="font-bold">Size</TableHead>
                                <TableHead className="font-bold">Created</TableHead>
                                <TableHead className="font-bold">Status</TableHead>
                                <TableHead className="font-bold">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {backupsQuery.data?.backups.map(backup => (
                                <TableRow key={backup.id} className="hover:bg-gray-50">
                                    <TableCell className="font-mono text-sm">{backup.filename}</TableCell>
                                    <TableCell>{backup.size}</TableCell>
                                    <TableCell>
                                        {backup.createdAt ? formatDistanceToNow(new Date(backup.createdAt), { addSuffix: true }) : '-'}
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={
                                            backup.status === 'completed' ? 'bg-green-100 text-green-800' :
                                            backup.status === 'failed' ? 'bg-red-100 text-red-800' :
                                            'bg-yellow-100 text-yellow-800'
                                        }>
                                            {backup.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => backup.downloadUrl && window.open(backup.downloadUrl)}
                                            disabled={backup.status !== 'completed' || !backup.downloadUrl}
                                        >
                                            <Download className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {(!backupsQuery.data?.backups || backupsQuery.data.backups.length === 0) && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                                        No backups found. Create your first backup.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}
