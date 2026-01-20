import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute } from "wouter";
import {
    Building2, Globe, Users, Mail, Phone, MapPin,
    DollarSign, Briefcase, FileText, ArrowLeft, Loader2, Save, Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Sidebar, MobileHeader } from "@/components/Sidebar";

function getCsrfToken(): string | null {
    const match = document.cookie.match(/csrf-token=([^;]+)/);
    return match ? match[1] : null;
}

function getHeaders(includeContentType = true): Record<string, string> {
    const headers: Record<string, string> = {};
    if (includeContentType) {
        headers["Content-Type"] = "application/json";
    }
    const csrfToken = getCsrfToken();
    if (csrfToken) {
        headers["x-csrf-token"] = csrfToken;
    }
    return headers;
}

export function CustomerDetail() {
    const [, params] = useRoute("/customers/:id");
    const id = params?.id;
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<any>({});

    const { data, isLoading, error } = useQuery({
        queryKey: ["customer", id],
        queryFn: async () => {
            const res = await fetch(`/api/crm/customers/${id}`, { credentials: "include" });
            if (!res.ok) throw new Error("Failed to fetch customer");
            return res.json();
        },
    });

    const updateMutation = useMutation({
        mutationFn: async (newData: any) => {
            const res = await fetch(`/api/crm/customers/${id}`, {
                method: "PATCH",
                headers: getHeaders(),
                body: JSON.stringify(newData),
                credentials: "include",
            });
            if (!res.ok) throw new Error("Failed to update customer");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["customer", id] });
            setIsEditing(false);
            toast({ title: "Updated", description: "Customer profile updated successfully." });
        },
        onError: (err) => {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        },
    });

    const enrichMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/crm/customers/${id}/enrich`, {
                method: "POST",
                headers: getHeaders(false),
                credentials: "include",
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || "Enrichment failed");
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["customer", id] });
            toast({ title: "Enriched", description: "Customer data enriched by AI." });
        },
        onError: (err) => {
            toast({ title: "Enrichment Failed", description: err.message, variant: "destructive" });
        },
    });

    if (isLoading) return (
        <div className="flex min-h-screen bg-background text-foreground">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
                <MobileHeader />
                <main className="flex-1 p-4 md:p-8 overflow-auto">
                    <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
                </main>
            </div>
        </div>
    );
    if (error || !data) return (
        <div className="flex min-h-screen bg-background text-foreground">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
                <MobileHeader />
                <main className="flex-1 p-4 md:p-8 overflow-auto">
                    <div className="p-8 text-red-500">Error loading customer.</div>
                </main>
            </div>
        </div>
    );

    const { customer, leads, stats } = data;

    const handleEdit = () => {
        setFormData({
            website: customer.website,
            industry: customer.industry,
            employeeCount: customer.employeeCount,
            linkedinUrl: customer.linkedinUrl,
            marketingStatus: customer.marketingStatus,
        });
        setIsEditing(true);
    };

    const handleSave = () => {
        updateMutation.mutate(formData);
    };

    return (
        <div className="flex min-h-screen bg-background text-foreground">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
                <MobileHeader />
                <main className="flex-1 p-4 md:p-8 overflow-auto">
                    <div className="max-w-7xl mx-auto animate-in fade-in duration-500">
                        <Link href="/customers" className="inline-flex items-center text-muted-foreground hover:text-blue-600 mb-6 transition-colors">
                            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Customers
                        </Link>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left Column: Profile Card */}
                <div className="md:col-span-1 space-y-6">
                    <Card className="border-t-4 border-t-indigo-500 shadow-md">
                        <CardContent className="pt-6">
                            <div className="text-center mb-6">
                                <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-white shadow-sm">
                                    <Building2 className="w-10 h-10 text-indigo-600" />
                                </div>
                                <h1 className="text-2xl font-bold text-gray-900">{customer.displayName}</h1>
                                {customer.companyName && customer.companyName !== customer.displayName && (
                                    <p className="text-muted-foreground">{customer.companyName}</p>
                                )}
                                <div className="mt-3 flex justify-center gap-2">
                                    <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100">
                                        {customer.marketingStatus || "Lead"}
                                    </Badge>
                                </div>
                            </div>

                            <Separator className="my-6" />

                            <div className="space-y-4">
                                <div className="flex items-center">
                                    <Mail className="w-4 h-4 text-muted-foreground mr-3" />
                                    <span className="text-sm">{customer.email || "No email"}</span>
                                </div>
                                <div className="flex items-center">
                                    <Phone className="w-4 h-4 text-muted-foreground mr-3" />
                                    <span className="text-sm">{customer.phone || customer.mobile || "No phone"}</span>
                                </div>
                                <div className="flex items-start">
                                    <MapPin className="w-4 h-4 text-muted-foreground mr-3 mt-1" />
                                    <div className="text-sm">
                                        <p>{customer.billingLine1}</p>
                                        <p>{customer.billingCity} {customer.billingState} {customer.billingPostalCode}</p>
                                    </div>
                                </div>
                            </div>

                            <Separator className="my-6" />

                            <div className="space-y-4">
                                <h3 className="font-semibold text-sm uppercase text-muted-foreground tracking-wider mb-3 flex justify-between items-center">
                                    <span>Enrichment Data</span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-xs text-indigo-600 hover:text-indigo-800"
                                        onClick={() => enrichMutation.mutate()}
                                        disabled={enrichMutation.isPending}
                                    >
                                        {enrichMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Sparkles className="w-3 h-3 mr-1" />}
                                        Auto-Enrich
                                    </Button>
                                </h3>
                                {isEditing ? (
                                    <div className="space-y-3">
                                        <div className="space-y-1">
                                            <label className="text-xs text-muted-foreground">Website</label>
                                            <Input
                                                value={formData.website || ""}
                                                onChange={e => setFormData({ ...formData, website: e.target.value })}
                                                placeholder="https://example.com"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs text-muted-foreground">Industry</label>
                                            <Input
                                                value={formData.industry || ""}
                                                onChange={e => setFormData({ ...formData, industry: e.target.value })}
                                                placeholder="e.g. Architecture"
                                            />
                                        </div>
                                        <Button onClick={handleSave} className="w-full" disabled={updateMutation.isPending}>
                                            {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                            Save Changes
                                        </Button>
                                        <Button variant="ghost" onClick={() => setIsEditing(false)} className="w-full">Cancel</Button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center text-sm">
                                                <Globe className="w-4 h-4 text-muted-foreground mr-3" />
                                                {customer.website ? (
                                                    <a href={customer.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                                        {customer.website}
                                                    </a>
                                                ) : <span className="text-muted-foreground italic">Add website</span>}
                                            </div>
                                        </div>
                                        <div className="flex items-center text-sm">
                                            <Briefcase className="w-4 h-4 text-muted-foreground mr-3" />
                                            <span>{customer.industry || "Add industry"}</span>
                                        </div>
                                        <div className="flex items-center text-sm">
                                            <Users className="w-4 h-4 text-muted-foreground mr-3" />
                                            <span>{customer.employeeCount || "Add size"}</span>
                                        </div>
                                        <Button variant="outline" size="sm" className="w-full mt-2" onClick={handleEdit}>
                                            Edit Profile
                                        </Button>
                                    </>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Stats & Projects */}
                <div className="md:col-span-2 space-y-6">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-4">
                        <Card>
                            <CardContent className="pt-6">
                                <div className="text-sm text-muted-foreground mb-1">Total Revenue</div>
                                <div className="text-2xl font-bold flex items-center text-green-600">
                                    <DollarSign className="w-5 h-5 mr-1" />{stats.totalRevenue}
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6">
                                <div className="text-sm text-muted-foreground mb-1">Active Pipeline</div>
                                <div className="text-2xl font-bold flex items-center text-blue-600">
                                    <DollarSign className="w-5 h-5 mr-1" />{stats.activePipeline}
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6">
                                <div className="text-sm text-muted-foreground mb-1">Projects</div>
                                <div className="text-2xl font-bold flex items-center text-purple-600">
                                    <FileText className="w-5 h-5 mr-1" />{stats.projectCount}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Related Projects Tab */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Engagements & Projects</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {leads.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">No projects found.</div>
                            ) : (
                                <div className="space-y-4">
                                    {leads.map((lead: any) => (
                                        <div key={lead.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                                            <div>
                                                <div className="font-semibold text-blue-600">{lead.projectName || "Unnamed Project"}</div>
                                                <div className="text-sm text-muted-foreground">{lead.projectAddress}</div>
                                            </div>
                                            <div className="text-right">
                                                <Badge variant="outline" className="mb-1">{lead.dealStage}</Badge>
                                                <div className="text-sm font-medium">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(lead.value))}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
