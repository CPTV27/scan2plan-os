/**
 * Case Study Manager Component
 * 
 * Settings page component to manage case studies in the Evidence Vault.
 * Supports CRUD operations and snippet management.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
    Plus, Search, Edit, Trash2, FileText, Quote, BarChart3,
    ChevronDown, ChevronUp, ExternalLink, Tag
} from "lucide-react";
import type { CaseStudy, CaseStudySnippet } from "@shared/schema";

interface CaseStudyWithSnippets extends CaseStudy {
    snippets: CaseStudySnippet[];
}

const SNIPPET_TYPES = [
    { value: "stat", label: "Key Metric", icon: BarChart3 },
    { value: "quote", label: "Testimonial", icon: Quote },
    { value: "summary", label: "Summary", icon: FileText },
    { value: "result", label: "Result", icon: BarChart3 },
];

const PREDEFINED_TAGS = [
    "Healthcare", "Commercial", "Industrial", "Residential",
    "Historic", "Education", "Retail", "Hospitality",
    "Mixed-Use", "Infrastructure"
];

export function CaseStudyManager() {
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedStudy, setSelectedStudy] = useState<CaseStudyWithSnippets | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isSnippetOpen, setIsSnippetOpen] = useState(false);
    const [expandedId, setExpandedId] = useState<number | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        title: "",
        blurb: "",
        clientName: "",
        heroStat: "",
        imageUrl: "",
        pdfUrl: "",
        tags: [] as string[],
    });

    const [snippetData, setSnippetData] = useState({
        title: "",
        content: "",
        snippetType: "quote",
    });

    // Fetch case studies
    const { data: caseStudies, isLoading } = useQuery<CaseStudy[]>({
        queryKey: ["/api/case-studies", searchQuery],
        queryFn: async () => {
            const url = searchQuery
                ? `/api/case-studies?search=${encodeURIComponent(searchQuery)}`
                : "/api/case-studies";
            const res = await fetch(url, { credentials: "include" });
            if (!res.ok) throw new Error("Failed to fetch case studies");
            return res.json();
        },
    });

    // Fetch single case study with snippets
    const fetchStudyWithSnippets = async (id: number): Promise<CaseStudyWithSnippets> => {
        const res = await fetch(`/api/case-studies/${id}`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to fetch case study");
        return res.json();
    };

    // Create mutation
    const createMutation = useMutation({
        mutationFn: async (data: typeof formData) => {
            const res = await apiRequest("POST", "/api/case-studies", data);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/case-studies"] });
            toast({ title: "Case study created" });
            setIsCreateOpen(false);
            resetForm();
        },
        onError: (error: Error) => {
            toast({ title: "Failed to create", description: error.message, variant: "destructive" });
        },
    });

    // Update mutation
    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: number; data: typeof formData }) => {
            const res = await apiRequest("PUT", `/api/case-studies/${id}`, data);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/case-studies"] });
            toast({ title: "Case study updated" });
            setIsEditOpen(false);
            setSelectedStudy(null);
            resetForm();
        },
        onError: (error: Error) => {
            toast({ title: "Failed to update", description: error.message, variant: "destructive" });
        },
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            await apiRequest("DELETE", `/api/case-studies/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/case-studies"] });
            toast({ title: "Case study deleted" });
        },
        onError: (error: Error) => {
            toast({ title: "Failed to delete", description: error.message, variant: "destructive" });
        },
    });

    // Create snippet mutation
    const createSnippetMutation = useMutation({
        mutationFn: async ({ caseStudyId, data }: { caseStudyId: number; data: typeof snippetData }) => {
            const res = await apiRequest("POST", `/api/case-studies/${caseStudyId}/snippets`, data);
            return res.json();
        },
        onSuccess: async () => {
            if (selectedStudy) {
                const updated = await fetchStudyWithSnippets(selectedStudy.id);
                setSelectedStudy(updated);
            }
            toast({ title: "Snippet created" });
            setIsSnippetOpen(false);
            setSnippetData({ title: "", content: "", snippetType: "quote" });
        },
        onError: (error: Error) => {
            toast({ title: "Failed to create snippet", description: error.message, variant: "destructive" });
        },
    });

    // Delete snippet mutation
    const deleteSnippetMutation = useMutation({
        mutationFn: async (snippetId: number) => {
            await apiRequest("DELETE", `/api/case-studies/snippets/${snippetId}`);
        },
        onSuccess: async () => {
            if (selectedStudy) {
                const updated = await fetchStudyWithSnippets(selectedStudy.id);
                setSelectedStudy(updated);
            }
            toast({ title: "Snippet deleted" });
        },
    });

    const resetForm = () => {
        setFormData({
            title: "",
            blurb: "",
            clientName: "",
            heroStat: "",
            imageUrl: "",
            pdfUrl: "",
            tags: [],
        });
    };

    const openEdit = async (study: CaseStudy) => {
        const full = await fetchStudyWithSnippets(study.id);
        setSelectedStudy(full);
        setFormData({
            title: study.title,
            blurb: study.blurb,
            clientName: study.clientName || "",
            heroStat: study.heroStat || "",
            imageUrl: study.imageUrl || "",
            pdfUrl: study.pdfUrl || "",
            tags: study.tags || [],
        });
        setIsEditOpen(true);
    };

    const toggleTag = (tag: string) => {
        setFormData(prev => ({
            ...prev,
            tags: prev.tags.includes(tag)
                ? prev.tags.filter(t => t !== tag)
                : [...prev.tags, tag],
        }));
    };

    const handleExpand = async (id: number) => {
        if (expandedId === id) {
            setExpandedId(null);
            setSelectedStudy(null);
        } else {
            setExpandedId(id);
            const full = await fetchStudyWithSnippets(id);
            setSelectedStudy(full);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Case Study Manager
                </CardTitle>
                <CardDescription>
                    Manage case studies and snippets for proposal integration
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Search and Create */}
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search case studies..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <Button onClick={() => { resetForm(); setIsCreateOpen(true); }}>
                        <Plus className="h-4 w-4 mr-2" />
                        New Case Study
                    </Button>
                </div>

                {/* Case Study List */}
                <ScrollArea className="h-[400px]">
                    {isLoading ? (
                        <div className="space-y-2">
                            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
                        </div>
                    ) : caseStudies?.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                            <p>No case studies yet</p>
                            <p className="text-sm">Create your first case study to get started</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {caseStudies?.map((study) => (
                                <Card key={study.id} className="overflow-hidden">
                                    <div
                                        className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                                        onClick={() => handleExpand(study.id)}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-medium">{study.title}</h4>
                                                    {study.heroStat && (
                                                        <Badge variant="secondary" className="text-xs">
                                                            {study.heroStat}
                                                        </Badge>
                                                    )}
                                                </div>
                                                {study.clientName && (
                                                    <p className="text-sm text-muted-foreground">{study.clientName}</p>
                                                )}
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {study.tags?.slice(0, 3).map(tag => (
                                                        <Badge key={tag} variant="outline" className="text-xs">
                                                            {tag}
                                                        </Badge>
                                                    ))}
                                                    {study.tags?.length > 3 && (
                                                        <Badge variant="outline" className="text-xs">
                                                            +{study.tags.length - 3}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={(e) => { e.stopPropagation(); openEdit(study); }}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(study.id); }}
                                                >
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                                {expandedId === study.id ? (
                                                    <ChevronUp className="h-4 w-4" />
                                                ) : (
                                                    <ChevronDown className="h-4 w-4" />
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expanded Snippets */}
                                    {expandedId === study.id && selectedStudy && (
                                        <div className="border-t p-4 bg-muted/30 space-y-3">
                                            <p className="text-sm text-muted-foreground line-clamp-2">
                                                {study.blurb}
                                            </p>

                                            <Separator />

                                            <div className="flex items-center justify-between">
                                                <h5 className="text-sm font-medium">Snippets ({selectedStudy.snippets?.length || 0})</h5>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => setIsSnippetOpen(true)}
                                                >
                                                    <Plus className="h-3 w-3 mr-1" />
                                                    Add Snippet
                                                </Button>
                                            </div>

                                            {selectedStudy.snippets?.length > 0 ? (
                                                <div className="space-y-2">
                                                    {selectedStudy.snippets.map(snippet => {
                                                        const typeInfo = SNIPPET_TYPES.find(t => t.value === snippet.snippetType);
                                                        const Icon = typeInfo?.icon || Quote;
                                                        return (
                                                            <div
                                                                key={snippet.id}
                                                                className="flex items-start gap-2 p-2 bg-background rounded border"
                                                            >
                                                                <Icon className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm font-medium">{snippet.title}</p>
                                                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                                                        {snippet.content}
                                                                    </p>
                                                                </div>
                                                                <Button
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="h-6 w-6"
                                                                    onClick={() => deleteSnippetMutation.mutate(snippet.id)}
                                                                >
                                                                    <Trash2 className="h-3 w-3" />
                                                                </Button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <p className="text-sm text-muted-foreground text-center py-2">
                                                    No snippets yet. Add snippets for use in proposals.
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </Card>
                            ))}
                        </div>
                    )}
                </ScrollArea>

                {/* Create/Edit Dialog */}
                <Dialog open={isCreateOpen || isEditOpen} onOpenChange={(open) => {
                    if (!open) { setIsCreateOpen(false); setIsEditOpen(false); }
                }}>
                    <DialogContent className="max-w-lg">
                        <DialogHeader>
                            <DialogTitle>
                                {isEditOpen ? "Edit Case Study" : "Create Case Study"}
                            </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="title">Title *</Label>
                                <Input
                                    id="title"
                                    value={formData.title}
                                    onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))}
                                    placeholder="e.g., Empire State Building Renovation"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="clientName">Client Name</Label>
                                    <Input
                                        id="clientName"
                                        value={formData.clientName}
                                        onChange={(e) => setFormData(p => ({ ...p, clientName: e.target.value }))}
                                        placeholder="e.g., Empire State Realty"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="heroStat">Hero Stat</Label>
                                    <Input
                                        id="heroStat"
                                        value={formData.heroStat}
                                        onChange={(e) => setFormData(p => ({ ...p, heroStat: e.target.value }))}
                                        placeholder="e.g., 2.7M sqft scanned"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="blurb">Description *</Label>
                                <Textarea
                                    id="blurb"
                                    value={formData.blurb}
                                    onChange={(e) => setFormData(p => ({ ...p, blurb: e.target.value }))}
                                    placeholder="Describe the project and its success..."
                                    rows={4}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Tags</Label>
                                <div className="flex flex-wrap gap-2">
                                    {PREDEFINED_TAGS.map(tag => (
                                        <Badge
                                            key={tag}
                                            variant={formData.tags.includes(tag) ? "default" : "outline"}
                                            className="cursor-pointer"
                                            onClick={() => toggleTag(tag)}
                                        >
                                            <Tag className="h-3 w-3 mr-1" />
                                            {tag}
                                        </Badge>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="imageUrl">Image URL</Label>
                                    <Input
                                        id="imageUrl"
                                        value={formData.imageUrl}
                                        onChange={(e) => setFormData(p => ({ ...p, imageUrl: e.target.value }))}
                                        placeholder="https://..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="pdfUrl">PDF URL</Label>
                                    <Input
                                        id="pdfUrl"
                                        value={formData.pdfUrl}
                                        onChange={(e) => setFormData(p => ({ ...p, pdfUrl: e.target.value }))}
                                        placeholder="https://..."
                                    />
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => { setIsCreateOpen(false); setIsEditOpen(false); }}>
                                Cancel
                            </Button>
                            <Button
                                onClick={() => {
                                    if (isEditOpen && selectedStudy) {
                                        updateMutation.mutate({ id: selectedStudy.id, data: formData });
                                    } else {
                                        createMutation.mutate(formData);
                                    }
                                }}
                                disabled={!formData.title || !formData.blurb}
                            >
                                {isEditOpen ? "Save Changes" : "Create"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Add Snippet Dialog */}
                <Dialog open={isSnippetOpen} onOpenChange={setIsSnippetOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add Snippet</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="snippetTitle">Snippet Title</Label>
                                <Input
                                    id="snippetTitle"
                                    value={snippetData.title}
                                    onChange={(e) => setSnippetData(p => ({ ...p, title: e.target.value }))}
                                    placeholder="e.g., Client Testimonial"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Type</Label>
                                <div className="flex flex-wrap gap-2">
                                    {SNIPPET_TYPES.map(type => (
                                        <Badge
                                            key={type.value}
                                            variant={snippetData.snippetType === type.value ? "default" : "outline"}
                                            className="cursor-pointer"
                                            onClick={() => setSnippetData(p => ({ ...p, snippetType: type.value }))}
                                        >
                                            <type.icon className="h-3 w-3 mr-1" />
                                            {type.label}
                                        </Badge>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="snippetContent">Content</Label>
                                <Textarea
                                    id="snippetContent"
                                    value={snippetData.content}
                                    onChange={(e) => setSnippetData(p => ({ ...p, content: e.target.value }))}
                                    placeholder="The snippet content that will be inserted into proposals..."
                                    rows={5}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsSnippetOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                onClick={() => {
                                    if (selectedStudy) {
                                        createSnippetMutation.mutate({
                                            caseStudyId: selectedStudy.id,
                                            data: snippetData,
                                        });
                                    }
                                }}
                                disabled={!snippetData.title || !snippetData.content}
                            >
                                Add Snippet
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    );
}
