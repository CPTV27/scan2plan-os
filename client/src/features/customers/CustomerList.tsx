import React, { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import {
    Loader2, Search, Building2, MapPin, RefreshCw,
    MoreHorizontal, Filter
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Sidebar, MobileHeader } from "@/components/Sidebar";
import {
    Card,
    CardContent,
    CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function CustomerList() {
    const [search, setSearch] = useState("");
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const syncMutation = useMutation({
        mutationFn: async () => {
            const res = await apiRequest("POST", "/api/quickbooks/sync-customers");
            return res.json();
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["customers"] });
            toast({
                title: "Customers synced",
                description: `Successfully synced ${data.synced} customers from QuickBooks.`,
            });
        },
        onError: (error: Error) => {
            toast({
                title: "Sync failed",
                description: error.message || "Failed to sync customers from QuickBooks",
                variant: "destructive",
            });
        },
    });

    const { data, isLoading, error } = useQuery({
        queryKey: ["customers", search],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (search) params.append("q", search);
            const res = await fetch(`/api/crm/customers?${params}`, { credentials: "include" });
            if (!res.ok) throw new Error("Failed to fetch customers");
            return res.json();
        },
    });

    const formatCurrency = (amount: string | number | null) => {
        if (!amount) return "$0.00";
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
        }).format(Number(amount));
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "Customer": return "bg-green-100 text-green-800 border-green-200";
            case "Lead": return "bg-blue-100 text-blue-800 border-blue-200";
            case "Partner": return "bg-purple-100 text-purple-800 border-purple-200";
            case "Churned": return "bg-gray-100 text-gray-800 border-gray-200";
            default: return "bg-gray-100 text-gray-800 border-gray-200";
        }
    };

    if (error) {
        return (
            <div className="flex min-h-screen bg-background text-foreground">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0">
                    <MobileHeader />
                    <main className="flex-1 p-4 md:p-8 overflow-auto">
                        <div className="p-8 text-center text-red-500">
                            Error loading customers: {error instanceof Error ? error.message : "Unknown error"}
                        </div>
                    </main>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-background text-foreground">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
                <MobileHeader />
                <main className="flex-1 p-4 md:p-8 overflow-auto">
                    <div className="max-w-7xl mx-auto animate-in fade-in duration-500">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                            <div>
                                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                                    Customer Database
                                </h1>
                                <p className="text-muted-foreground mt-1">
                                    Manage relationships, track interactions, and drive growth.
                                </p>
                            </div>
                            <div className="flex gap-2 w-full md:w-auto">
                                <Button variant="outline">
                                    <Filter className="w-4 h-4 mr-2" />
                                    Filter
                                </Button>
                                <Button 
                                    onClick={() => syncMutation.mutate()}
                                    disabled={syncMutation.isPending}
                                    data-testid="button-sync-customers"
                                >
                                    {syncMutation.isPending ? (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                        <RefreshCw className="w-4 h-4 mr-2" />
                                    )}
                                    {syncMutation.isPending ? "Syncing..." : "Sync from QuickBooks"}
                                </Button>
                            </div>
                        </div>

                        <Card className="border-t-4 border-t-blue-500 shadow-md">
                            <CardHeader className="pb-4">
                                <div className="flex items-center gap-2 relative">
                                    <Search className="w-4 h-4 absolute left-3 text-muted-foreground" />
                                    <Input
                                        placeholder="Search companies, emails, names..."
                                        className="pl-9 max-w-md"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                    />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader className="bg-muted/50">
                                            <TableRow>
                                                <TableHead className="w-[300px]">Company / Contact</TableHead>
                                                <TableHead>Industry</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Balance</TableHead>
                                                <TableHead>Location</TableHead>
                                                <TableHead className="w-[50px]"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {isLoading ? (
                                                Array.from({ length: 5 }).map((_, i) => (
                                                    <TableRow key={i}>
                                                        <TableCell><div className="h-10 bg-gray-100 rounded w-full animate-pulse" /></TableCell>
                                                        <TableCell><div className="h-6 bg-gray-100 rounded w-20 animate-pulse" /></TableCell>
                                                        <TableCell><div className="h-6 bg-gray-100 rounded w-16 animate-pulse" /></TableCell>
                                                        <TableCell><div className="h-6 bg-gray-100 rounded w-24 animate-pulse" /></TableCell>
                                                        <TableCell><div className="h-6 bg-gray-100 rounded w-32 animate-pulse" /></TableCell>
                                                        <TableCell />
                                                    </TableRow>
                                                ))
                                            ) : data?.customers?.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                                                        No customers found. Try syncing from QuickBooks.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                data?.customers?.map((customer: any) => (
                                                    <TableRow key={customer.id} className="group hover:bg-muted/30 transition-colors">
                                                        <TableCell>
                                                            <div className="flex flex-col">
                                                                <Link href={`/customers/${customer.id}`} className="font-semibold text-blue-600 hover:text-blue-800 hover:underline">
                                                                    {customer.displayName}
                                                                </Link>
                                                                {customer.companyName && customer.companyName !== customer.displayName && (
                                                                    <span className="text-xs text-muted-foreground">{customer.companyName}</span>
                                                                )}
                                                                <span className="text-xs text-muted-foreground truncate max-w-[200px]">{customer.email}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            {customer.industry ? (
                                                                <Badge variant="outline" className="font-normal">
                                                                    <Building2 className="w-3 h-3 mr-1 opacity-50" />
                                                                    {customer.industry}
                                                                </Badge>
                                                            ) : (
                                                                <span className="text-muted-foreground text-sm italic">--</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge className={`${getStatusColor(customer.marketingStatus)} border`}>
                                                                {customer.marketingStatus || "Lead"}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className={`font-medium ${Number(customer.balance) > 0 ? "text-red-500" : "text-gray-600"}`}>
                                                                {formatCurrency(customer.balance)}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center text-sm text-muted-foreground">
                                                                {customer.billingCity && (
                                                                    <>
                                                                        <MapPin className="w-3 h-3 mr-1" />
                                                                        {customer.billingCity}, {customer.billingState}
                                                                    </>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        <span className="sr-only">Open menu</span>
                                                                        <MoreHorizontal className="h-4 w-4" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end">
                                                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                                    <DropdownMenuItem asChild>
                                                                        <Link href={`/customers/${customer.id}`}>View Profile</Link>
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem>Create New Project</DropdownMenuItem>
                                                                    <DropdownMenuItem>Create Invoice</DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </main>
            </div>
        </div>
    );
}
