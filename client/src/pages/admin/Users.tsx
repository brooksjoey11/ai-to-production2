import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Trash2, Download, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function Users() {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const usersQuery = trpc.admin.getUsers.useQuery({ search: searchTerm || undefined });
    const deleteUser = trpc.admin.deleteUser.useMutation({
        onSuccess: () => {
            toast.success('User deleted successfully');
            usersQuery.refetch();
            setShowDeleteConfirm(false);
            setSelectedUser(null);
        }
    });
    const exportUserData = trpc.admin.exportUserData.useMutation({
        onSuccess: (data) => {
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `user-${data.user?.id}-export.json`;
            a.click();
            URL.revokeObjectURL(url);
        }
    });

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
            </div>

            {/* Users Table */}
            <div className="border-2 border-black overflow-hidden">
                <div className="border-b-2 border-black px-4 py-3 bg-gray-50">
                    <span className="font-bold uppercase tracking-widest text-xs">
                        User Management
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-gray-100">
                            <TableRow>
                                <TableHead className="font-bold">User</TableHead>
                                <TableHead className="font-bold">Role</TableHead>
                                <TableHead className="font-bold">Joined</TableHead>
                                <TableHead className="font-bold">Last Active</TableHead>
                                <TableHead className="font-bold">Submissions</TableHead>
                                <TableHead className="font-bold">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {usersQuery.data?.users.map(user => (
                                <TableRow key={user.id} className="hover:bg-gray-50">
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium">{user.name || 'Unknown'}</span>
                                            <span className="text-xs text-gray-500">{user.email}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={
                                            user.role === 'admin' ? 'bg-black text-white' : 'bg-gray-100'
                                        }>
                                            {user.role}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                                    <TableCell>{new Date(user.lastSignedIn).toLocaleDateString()}</TableCell>
                                    <TableCell>{user.submissionCount}</TableCell>
                                    <TableCell>
                                        <div className="flex gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => exportUserData.mutate({ userId: user.id })}
                                                title="Export User Data"
                                            >
                                                <Download className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-red-600 hover:text-red-700"
                                                onClick={() => {
                                                    setSelectedUser(user);
                                                    setShowDeleteConfirm(true);
                                                }}
                                                title="Delete User"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {(!usersQuery.data?.users || usersQuery.data.users.length === 0) && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                                        No users found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && selectedUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg max-w-md w-full">
                        <div className="border-b-2 border-black px-4 py-3">
                            <span className="font-bold uppercase tracking-widest">Confirm Deletion</span>
                        </div>
                        <div className="p-6">
                            <div className="flex items-start gap-3 mb-4">
                                <AlertTriangle className="h-6 w-6 text-red-500 flex-shrink-0" />
                                <div>
                                    <p className="font-medium">Delete user {selectedUser.email}?</p>
                                    <p className="text-sm text-gray-600 mt-2">
                                        This will permanently delete:
                                    </p>
                                    <ul className="list-disc list-inside text-sm text-gray-600 mt-1">
                                        <li>User profile and all personal data</li>
                                        <li>{selectedUser.submissionCount} code submissions</li>
                                        <li>All analysis results</li>
                                    </ul>
                                    <p className="text-sm font-medium text-red-600 mt-3">
                                        This action cannot be undone.
                                    </p>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                                    Cancel
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={() => deleteUser.mutate({ userId: selectedUser.id })}
                                >
                                    Permanently Delete User
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
