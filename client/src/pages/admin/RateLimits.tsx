import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, RefreshCw, Edit2, Save, X } from "lucide-react";

export default function RateLimits() {
    const [searchTerm, setSearchTerm] = useState('');
    const [editingUser, setEditingUser] = useState<number | null>(null);
    const [overrideValue, setOverrideValue] = useState('');

    const rateLimitsQuery = trpc.admin.getRateLimits.useQuery(
        { search: searchTerm || undefined },
        { refetchInterval: 30000 }
    );
    const updateLimit = trpc.admin.updateUserRateLimit.useMutation({
        onSuccess: () => {
            rateLimitsQuery.refetch();
            setEditingUser(null);
        }
    });

    const userList = rateLimitsQuery.data || [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div className="relative w-64">
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="Search users..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8"
                    />
                </div>
                <Button variant="outline" onClick={() => rateLimitsQuery.refetch()}>
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Refresh
                </Button>
            </div>

            {/* Rate Limits Table */}
            <div className="border-2 border-black overflow-hidden">
                <div className="border-b-2 border-black px-4 py-3 bg-gray-50">
                    <span className="font-bold uppercase tracking-widest text-xs">
                        User Rate Limits
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-gray-100">
                            <TableRow>
                                <TableHead className="font-bold">User</TableHead>
                                <TableHead className="font-bold">Tier</TableHead>
                                <TableHead className="font-bold">Daily Limit</TableHead>
                                <TableHead className="font-bold">Used Today</TableHead>
                                <TableHead className="font-bold">Remaining</TableHead>
                                <TableHead className="font-bold">Reset At</TableHead>
                                <TableHead className="font-bold">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {userList.map(user => (
                                <TableRow key={user.id} className="hover:bg-gray-50">
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium">{user.name || 'Unknown'}</span>
                                            <span className="text-xs text-gray-500">{user.email}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={
                                            user.tier === 'enterprise' ? 'bg-purple-100 text-purple-800' :
                                            user.tier === 'pro' ? 'bg-blue-100 text-blue-800' :
                                            'bg-gray-100 text-gray-800'
                                        }>
                                            {user.tier || 'free'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="font-mono">
                                        {editingUser === user.id ? (
                                            <Input
                                                type="number"
                                                value={overrideValue}
                                                onChange={(e) => setOverrideValue(e.target.value)}
                                                className="w-20 h-8"
                                                min={1}
                                            />
                                        ) : (
                                            user.limit
                                        )}
                                    </TableCell>
                                    <TableCell className="font-mono">{user.used}</TableCell>
                                    <TableCell>
                                        <Badge variant={user.remaining > 0 ? 'default' : 'destructive'}>
                                            {user.remaining}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="font-mono text-xs">
                                        {new Date(user.resetAt).toLocaleString()}
                                    </TableCell>
                                    <TableCell>
                                        {editingUser === user.id ? (
                                            <div className="flex gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-green-600"
                                                    onClick={() => updateLimit.mutate({
                                                        userId: user.id,
                                                        overrideLimit: parseInt(overrideValue)
                                                    })}
                                                >
                                                    <Save className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() => setEditingUser(null)}
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => {
                                                    setEditingUser(user.id);
                                                    setOverrideValue(user.limit.toString());
                                                }}
                                            >
                                                <Edit2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {userList.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                                        No users found.
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
