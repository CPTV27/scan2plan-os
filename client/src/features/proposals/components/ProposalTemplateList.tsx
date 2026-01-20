/**
 * Proposal Template List
 * 
 * Displays all proposal templates grouped by category with edit/preview actions.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
    FileText,
    Edit,
    Eye,
    Plus,
    Search,
    Star,
    Copy,
    Trash2,
    Save,
} from "lucide-react";

interface ProposalTemplate {
    id: number;
    name: string;
    slug: string;
    category: string;
    content: string;
    description: string | null;
    version: number;
    isDefault: boolean;
    isActive: boolean;
    sortOrder: number;
    variables: string[];
    createdAt: string;
    updatedAt: string;
}

const CATEGORY_LABELS: Record<string, string> = {
    intro: "Introduction",
    company: "Company",
    scope: "Scope",
    pricing: "Pricing",
    terms: "Terms",
    legal: "Legal",
    appendix: "Appendix",
};

const CATEGORY_ORDER = ["intro", "company", "scope", "pricing", "terms", "legal", "appendix"];

export function ProposalTemplateList() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [editingTemplate, setEditingTemplate] = useState<ProposalTemplate | null>(null);
    const [previewTemplate, setPreviewTemplate] = useState<ProposalTemplate | null>(null);
    const [editContent, setEditContent] = useState("");
    const [editName, setEditName] = useState("");
    const [editDescription, setEditDescription] = useState("");

    // Fetch templates
    const { data: templates = [], isLoading } = useQuery<ProposalTemplate[]>({
        queryKey: ["/api/proposal-templates"],
        queryFn: async () => {
            const response = await fetch("/api/proposal-templates");
            if (!response.ok) throw new Error("Failed to fetch templates");
            return response.json();
        },
    });

    // Update template mutation
    const updateMutation = useMutation({
        mutationFn: async (data: { id: number; updates: Partial<ProposalTemplate> }) => {
            return apiRequest("PATCH", `/api/proposal-templates/${data.id}`, data.updates);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/proposal-templates"] });
            toast({ title: "Template updated", description: "Your changes have been saved." });
            setEditingTemplate(null);
        },
        onError: (error: any) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });

    // Group templates by category
    const groupedTemplates = templates.reduce<Record<string, ProposalTemplate[]>>((acc, template) => {
        const cat = template.category || "other";
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(template);
        return acc;
    }, {});

    // Filter templates
    const filteredTemplates = templates.filter((t) => {
        const matchesSearch = !searchQuery ||
            t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.content.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === "all" || t.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    // Categories with counts
    const categoryCounts = templates.reduce<Record<string, number>>((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + 1;
        return acc;
    }, {});

    const handleEdit = (template: ProposalTemplate) => {
        setEditingTemplate(template);
        setEditContent(template.content);
        setEditName(template.name);
        setEditDescription(template.description || "");
    };

    const handleSave = () => {
        if (!editingTemplate) return;
        updateMutation.mutate({
            id: editingTemplate.id,
            updates: {
                name: editName,
                content: editContent,
                description: editDescription,
            },
        });
    };

    const handlePreview = (template: ProposalTemplate) => {
        setPreviewTemplate(template);
    };

    // Extract variables from content
    const extractVariables = (content: string): string[] => {
        const matches = content.match(/\{\{([^}]+)\}\}/g) || [];
        return Array.from(new Set(matches.map((m) => m.replace(/[{}]/g, ""))));
    };

    if (isLoading) {
        return (
            <Card>
                <CardContent className="p-6">
                    <div className="animate-pulse space-y-4">
                        <div className="h-4 bg-muted rounded w-1/4"></div>
                        <div className="h-10 bg-muted rounded"></div>
                        <div className="h-32 bg-muted rounded"></div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold">Proposal Templates</h2>
                    <p className="text-muted-foreground">
                        Manage boilerplate sections for proposal generation
                    </p>
                </div>
                <div className="flex gap-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search templates..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 w-64"
                        />
                    </div>
                </div>
            </div>

            {/* Category Tabs */}
            <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
                <TabsList>
                    <TabsTrigger value="all">
                        All ({templates.length})
                    </TabsTrigger>
                    {CATEGORY_ORDER.map((cat) => (
                        categoryCounts[cat] && (
                            <TabsTrigger key={cat} value={cat}>
                                {CATEGORY_LABELS[cat] || cat} ({categoryCounts[cat]})
                            </TabsTrigger>
                        )
                    ))}
                </TabsList>

                <TabsContent value={selectedCategory} className="mt-4">
                    <Card>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Template</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Variables</TableHead>
                                    <TableHead className="text-center">Default</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredTemplates.map((template) => (
                                    <TableRow key={template.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <FileText className="h-4 w-4 text-muted-foreground" />
                                                <div>
                                                    <div className="font-medium">{template.name}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        v{template.version} • {template.slug}
                                                    </div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">
                                                {CATEGORY_LABELS[template.category] || template.category}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1">
                                                {extractVariables(template.content).slice(0, 3).map((v) => (
                                                    <Badge key={v} variant="secondary" className="text-xs">
                                                        {`{{${v}}}`}
                                                    </Badge>
                                                ))}
                                                {extractVariables(template.content).length > 3 && (
                                                    <Badge variant="secondary" className="text-xs">
                                                        +{extractVariables(template.content).length - 3}
                                                    </Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {template.isDefault && (
                                                <Star className="h-4 w-4 text-yellow-500 mx-auto" />
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handlePreview(template)}
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleEdit(template)}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Edit Dialog */}
            <Dialog open={!!editingTemplate} onOpenChange={() => setEditingTemplate(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Edit Template: {editingTemplate?.name}</DialogTitle>
                        <DialogDescription>
                            Modify the template content. Use {`{{variable_name}}`} for dynamic placeholders.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Name</Label>
                                <Input
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Description</Label>
                                <Input
                                    value={editDescription}
                                    onChange={(e) => setEditDescription(e.target.value)}
                                    placeholder="Optional description"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>Content (Markdown)</Label>
                                <div className="flex gap-1">
                                    {extractVariables(editContent).map((v) => (
                                        <Badge key={v} variant="outline" className="text-xs">
                                            {`{{${v}}}`}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                            <Textarea
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                className="min-h-[400px] font-mono text-sm"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingTemplate(null)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={updateMutation.isPending}>
                            <Save className="h-4 w-4 mr-2" />
                            {updateMutation.isPending ? "Saving..." : "Save Changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Preview Dialog */}
            <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Preview: {previewTemplate?.name}</DialogTitle>
                        <DialogDescription>
                            Template content with variable placeholders highlighted
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto py-4">
                        <div className="prose prose-sm max-w-none dark:prose-invert">
                            <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg">
                                {previewTemplate?.content}
                            </pre>
                        </div>

                        {previewTemplate && extractVariables(previewTemplate.content).length > 0 && (
                            <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                                <h4 className="font-medium mb-2">Variables Used</h4>
                                <div className="flex flex-wrap gap-2">
                                    {extractVariables(previewTemplate.content).map((v) => (
                                        <Badge key={v} variant="secondary">
                                            {`{{${v}}}`}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPreviewTemplate(null)}>
                            Close
                        </Button>
                        <Button onClick={() => {
                            setPreviewTemplate(null);
                            if (previewTemplate) handleEdit(previewTemplate);
                        }}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Template
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default ProposalTemplateList;
