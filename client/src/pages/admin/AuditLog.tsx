import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Search, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const actionColors: Record<string, string> = {
    'UPDATE_PROMPT': 'bg-blue-100 text-blue-800',
    'UPDATE_MODEL': 'bg-green-100 text-green-800',
    'UPDATE_CONFIG': 'bg-purple-100 text-purple-800',
    'ADD_PROVIDER': 'bg-indigo-100 text-indigo-800',
    'UPDATE_PROVIDER': 'bg-yellow-100 text-yellow-800',
    'DELETE_PROVIDER': 'bg-red-100 text-red-800',
    'TEST_CONNECTION': 'bg-gray-100 text-gray-800',
    'SYNC_MODELS': 'bg-teal-100 text-teal-800',
    'RETRY_JOB': 'bg-orange-100 text-orange-800',
    'DELETE_JOB': 'bg-red-100 text-red-800',
    'UPDATE_USER': 'bg-pink-100 text-pink-800',
    'DELETE_USER': 'bg-red-100 text-red-800',
};

export default function AuditLog() {
    const [expandedRow, setExpandedRow] = useState<number | null>(null);
    const [filters, setFilters] = useState({
        user: '',
        action: '',
        entityType: '',
        dateFrom: '',
        dateTo: ''
    });

    const auditLogQuery = trpc.admin.getAuditLogs.useQuery(
        { limit: 100, offset: 0, action: filters.action || undefined, entityType: filters.entityType || undefined, dateFrom: filters.dateFrom || undefined, dateTo: filters.dateTo || undefined },
        { refetchInterval: 30000 }
    );

    return (
        <div className="space-y-6">
            {/* Filters */}
            <div className="border-2 border-black p-4">
                <div className="flex items-center justify-between mb-4">
                    <span className="font-bold uppercase tracking-widest text-xs">Filters</span>
                    <Button variant="ghost" size="sm" onClick={() => setFilters({ user: '', action: '', entityType: '', dateFrom: '', dateTo: '' })}>
                        Clear All
                    </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div>
                        <label className="text-xs font-medium mb-1 block">Action</label>
                        <select
                            className="w-full px-3 py-2 border-2 border-black font-mono text-sm"
                            value={filters.action}
                            onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                        >
                            <option value="">All Actions</option>
                            <option value="UPDATE_PROMPT">UPDATE_PROMPT</option>
                            <option value="UPDATE_MODEL">UPDATE_MODEL</option>
                            <option value="UPDATE_CONFIG">UPDATE_CONFIG</option>
                            <option value="ADD_PROVIDER">ADD_PROVIDER</option>
                            <option value="UPDATE_PROVIDER">UPDATE_PROVIDER</option>
                            <option value="TEST_CONNECTION">TEST_CONNECTION</option>
                            <option value="SYNC_MODELS">SYNC_MODELS</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-medium mb-1 block">Entity Type</label>
                        <select
                            className="w-full px-3 py-2 border-2 border-black font-mono text-sm"
                            value={filters.entityType}
                            onChange={(e) => setFilters({ ...filters, entityType: e.target.value })}
                        >
                            <option value="">All Types</option>
                            <option value="prompt">prompt</option>
                            <option value="model">model</option>
                            <option value="provider">provider</option>
                            <option value="runtime_config">runtime_config</option>
                            <option value="dead_letter">dead_letter</option>
                            <option value="user">user</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-medium mb-1 block">From</label>
                        <Input
                            type="date"
                            value={filters.dateFrom}
                            onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium mb-1 block">To</label>
                        <Input
                            type="date"
                            value={filters.dateTo}
                            onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                        />
                    </div>
                    <div className="flex items-end">
                        <Button onClick={() => auditLogQuery.refetch()} className="flex items-center gap-2 w-full">
                            <Search className="h-4 w-4" />
                            Apply Filters
                        </Button>
                    </div>
                </div>
            </div>

            {/* Audit Log Table */}
            <div className="border-2 border-black overflow-hidden">
                <div className="border-b-2 border-black px-4 py-3 bg-gray-50 flex justify-between items-center">
                    <span className="font-bold uppercase tracking-widest text-xs">
                        Audit Log ({auditLogQuery.data?.total || 0} entries)
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => auditLogQuery.refetch()}>
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Refresh
                    </Button>
                </div>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-gray-100">
                            <TableRow>
                                <TableHead className="font-bold w-8"></TableHead>
                                <TableHead className="font-bold">Time</TableHead>
                                <TableHead className="font-bold">User</TableHead>
                                <TableHead className="font-bold">Action</TableHead>
                                <TableHead className="font-bold">Entity</TableHead>
                                <TableHead className="font-bold">ID</TableHead>
                                <TableHead className="font-bold">IP Address</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {auditLogQuery.data?.logs.map(log => (
                                <>
                                    <TableRow
                                        key={log.id}
                                        className="hover:bg-gray-50 cursor-pointer"
                                        onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}
                                    >
                                        <TableCell>
                                            {expandedRow === log.id ?
                                                <ChevronUp className="h-4 w-4" /> :
                                                <ChevronDown className="h-4 w-4" />
                                            }
                                        </TableCell>
                                        <TableCell className="font-mono text-xs">
                                            {log.createdAt ? formatDistanceToNow(new Date(log.createdAt), { addSuffix: true }) : '-'}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{log.userName || `User #${log.userId}`}</span>
                                                <span className="text-xs text-gray-500">{log.userEmail}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={actionColors[log.action] || 'bg-gray-100'}>
                                                {log.action}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{log.entityType}</TableCell>
                                        <TableCell className="font-mono text-xs">{log.entityId || '-'}</TableCell>
                                        <TableCell className="font-mono text-xs">{log.ipAddress || '-'}</TableCell>
                                    </TableRow>
                                    {expandedRow === log.id && (
                                        <TableRow key={`${log.id}-expanded`} className="bg-gray-50">
                                            <TableCell colSpan={7} className="p-4">
                                                <div className="space-y-4">
                                                    {!!log.beforeValue && (
                                                        <div>
                                                            <span className="text-xs font-bold uppercase tracking-wider">Before:</span>
                                                            <pre className="mt-1 p-2 bg-white border rounded text-xs font-mono overflow-auto max-h-40">
                                                                {JSON.stringify(log.beforeValue, null, 2)}
                                                            </pre>
                                                        </div>
                                                    )}
                                                    {!!log.afterValue && (
                                                        <div>
                                                            <span className="text-xs font-bold uppercase tracking-wider">After:</span>
                                                            <pre className="mt-1 p-2 bg-white border rounded text-xs font-mono overflow-auto max-h-40">
                                                                {JSON.stringify(log.afterValue, null, 2)}
                                                            </pre>
                                                        </div>
                                                    )}
                                                    {log.userAgent && (
                                                        <div className="text-xs text-gray-500">
                                                            User Agent: {log.userAgent}
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </>
                            ))}
                            {(!auditLogQuery.data?.logs || auditLogQuery.data.logs.length === 0) && (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                                        No audit log entries found.
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
