import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, CreditCard, DollarSign, Users, Eye } from "lucide-react";

export default function Billing() {
    const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);

    const customersQuery = trpc.admin.getCustomers.useQuery();
    const usageQuery = trpc.admin.getUsageSummary.useQuery();
    const invoicesQuery = trpc.admin.getInvoices.useQuery();

    const customers = customersQuery.data || [];
    const usage = usageQuery.data || { totalTokens: 0, totalSpend: 0, activeUsers: 0 };
    const invoices = invoicesQuery.data || [];

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border-2 border-black p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <CreditCard className="h-5 w-5" />
                        <span className="text-sm text-gray-600">Total Spend (MTD)</span>
                    </div>
                    <div className="text-3xl font-bold font-mono">${usage.totalSpend.toFixed(2)}</div>
                </div>
                <div className="border-2 border-black p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="h-5 w-5" />
                        <span className="text-sm text-gray-600">Tokens Used (MTD)</span>
                    </div>
                    <div className="text-3xl font-bold font-mono">{(usage.totalTokens / 1000000).toFixed(1)}M</div>
                </div>
                <div className="border-2 border-black p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Users className="h-5 w-5" />
                        <span className="text-sm text-gray-600">Active Users</span>
                    </div>
                    <div className="text-3xl font-bold font-mono">{usage.activeUsers}</div>
                </div>
            </div>

            <Tabs defaultValue="customers">
                <TabsList className="w-full bg-transparent p-0 h-auto gap-0 rounded-none mb-4">
                    <TabsTrigger
                        value="customers"
                        className="flex-1 px-4 py-2 border-2 border-black text-xs font-bold uppercase rounded-none data-[state=active]:bg-black data-[state=active]:text-white"
                    >
                        Customers
                    </TabsTrigger>
                    <TabsTrigger
                        value="invoices"
                        className="flex-1 px-4 py-2 border-2 border-black text-xs font-bold uppercase rounded-none data-[state=active]:bg-black data-[state=active]:text-white"
                    >
                        Invoices
                    </TabsTrigger>
                    <TabsTrigger
                        value="pricing"
                        className="flex-1 px-4 py-2 border-2 border-black text-xs font-bold uppercase rounded-none data-[state=active]:bg-black data-[state=active]:text-white"
                    >
                        Pricing Tiers
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="customers">
                    <div className="border-2 border-black overflow-hidden">
                        <div className="border-b-2 border-black px-4 py-3 bg-gray-50">
                            <span className="font-bold uppercase tracking-widest text-xs">Customer List</span>
                        </div>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-gray-100">
                                    <TableRow>
                                        <TableHead className="font-bold">Customer</TableHead>
                                        <TableHead className="font-bold">Plan</TableHead>
                                        <TableHead className="font-bold">Status</TableHead>
                                        <TableHead className="font-bold">Current Period</TableHead>
                                        <TableHead className="font-bold">Usage (MTD)</TableHead>
                                        <TableHead className="font-bold">Est. Cost</TableHead>
                                        <TableHead className="font-bold">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {customers.map(customer => (
                                        <TableRow key={customer.id} className="hover:bg-gray-50">
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{customer.name || customer.email}</span>
                                                    <span className="text-xs text-gray-500">ID: {customer.id}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={
                                                    customer.plan === 'enterprise' ? 'bg-purple-100 text-purple-800' :
                                                    customer.plan === 'pro' ? 'bg-blue-100 text-blue-800' :
                                                    'bg-gray-100 text-gray-800'
                                                }>
                                                    {customer.plan || 'free'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={
                                                    customer.status === 'active' ? 'bg-green-100 text-green-800' :
                                                    customer.status === 'past_due' ? 'bg-yellow-100 text-yellow-800' :
                                                    'bg-red-100 text-red-800'
                                                }>
                                                    {customer.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {new Date(customer.currentPeriodStart).toLocaleDateString()} - {new Date(customer.currentPeriodEnd).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell className="font-mono">{(customer.usage / 1000).toFixed(1)}K tokens</TableCell>
                                            <TableCell className="font-mono">${customer.estimatedCost.toFixed(2)}</TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() => {
                                                        setSelectedCustomer(customer);
                                                        setShowInvoiceModal(true);
                                                    }}
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {customers.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                                                No customers found.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="invoices">
                    <div className="border-2 border-black overflow-hidden">
                        <div className="border-b-2 border-black px-4 py-3 bg-gray-50 flex justify-between items-center">
                            <span className="font-bold uppercase tracking-widest text-xs">Recent Invoices</span>
                            <Button variant="outline" size="sm">
                                <Download className="h-4 w-4 mr-1" />
                                Export CSV
                            </Button>
                        </div>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-gray-100">
                                    <TableRow>
                                        <TableHead className="font-bold">Invoice #</TableHead>
                                        <TableHead className="font-bold">Customer</TableHead>
                                        <TableHead className="font-bold">Date</TableHead>
                                        <TableHead className="font-bold">Amount</TableHead>
                                        <TableHead className="font-bold">Status</TableHead>
                                        <TableHead className="font-bold">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {invoices.map(invoice => (
                                        <TableRow key={invoice.id}>
                                            <TableCell className="font-mono text-sm">{invoice.number}</TableCell>
                                            <TableCell>{invoice.customerName}</TableCell>
                                            <TableCell>{new Date(invoice.date).toLocaleDateString()}</TableCell>
                                            <TableCell className="font-mono">${invoice.amount.toFixed(2)}</TableCell>
                                            <TableCell>
                                                <Badge className={
                                                    invoice.status === 'paid' ? 'bg-green-100 text-green-800' :
                                                    invoice.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                                    'bg-red-100 text-red-800'
                                                }>
                                                    {invoice.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Button variant="ghost" size="sm">
                                                    <Download className="h-4 w-4 mr-1" />
                                                    PDF
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {invoices.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                                                No invoices found.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="pricing">
                    <div className="border-2 border-black p-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="border-2 border-black p-6 text-center">
                                <h3 className="font-bold text-xl mb-2">Free</h3>
                                <div className="text-3xl font-mono mb-4">$0</div>
                                <ul className="text-sm space-y-2 mb-6">
                                    <li>5 submissions per day</li>
                                    <li>Basic models only</li>
                                    <li>Community support</li>
                                </ul>
                                <Badge className="bg-gray-100">Current Default</Badge>
                            </div>
                            <div className="border-2 border-black p-6 text-center bg-gray-50">
                                <h3 className="font-bold text-xl mb-2">Pro</h3>
                                <div className="text-3xl font-mono mb-4">$20<span className="text-sm text-gray-500">/mo</span></div>
                                <ul className="text-sm space-y-2 mb-6">
                                    <li>50 submissions per day</li>
                                    <li>All models available</li>
                                    <li>Priority support</li>
                                    <li>API access</li>
                                </ul>
                                <Button variant="outline" size="sm">Configure</Button>
                            </div>
                            <div className="border-2 border-black p-6 text-center">
                                <h3 className="font-bold text-xl mb-2">Enterprise</h3>
                                <div className="text-3xl font-mono mb-4">Custom</div>
                                <ul className="text-sm space-y-2 mb-6">
                                    <li>Unlimited submissions</li>
                                    <li>Custom models</li>
                                    <li>Dedicated support</li>
                                    <li>SLA guarantees</li>
                                </ul>
                                <Button variant="outline" size="sm">Contact Sales</Button>
                            </div>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>

            {/* Customer detail modal placeholder */}
            {showInvoiceModal && selectedCustomer && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg max-w-md w-full">
                        <div className="border-b-2 border-black px-4 py-3 flex justify-between items-center">
                            <span className="font-bold uppercase tracking-widest">Customer Detail</span>
                            <Button variant="ghost" size="sm" onClick={() => setShowInvoiceModal(false)}>✕</Button>
                        </div>
                        <div className="p-6">
                            <p className="font-medium">{selectedCustomer.name || selectedCustomer.email}</p>
                            <p className="text-sm text-gray-500 mt-1">ID: {selectedCustomer.id}</p>
                        </div>
                        <div className="border-t-2 border-black px-4 py-3 flex justify-end">
                            <Button onClick={() => setShowInvoiceModal(false)}>Close</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
