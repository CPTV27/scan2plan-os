/**
 * Case Study Picker Component
 * 
 * Modal dialog for searching and inserting case study content into proposals.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
    Search, FileText, Quote, BarChart3, Check, Copy,
    ChevronRight, Building2, Award, Sparkles
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CaseStudy, CaseStudySnippet } from "@shared/schema";

interface CaseStudyWithSnippets extends CaseStudy {
    snippets: CaseStudySnippet[];
}

interface CaseStudyPickerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onInsert: (content: string, type: "full" | "snippet") => void;
    leadId?: number;
}

const SNIPPET_ICONS: Record<string, typeof Quote> = {
    stat: BarChart3,
    quote: Quote,
    summary: FileText,
    result: Award,
};

export function CaseStudyPicker({ open, onOpenChange, onInsert, leadId }: CaseStudyPickerProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedStudy, setSelectedStudy] = useState<CaseStudyWithSnippets | null>(null);
    const [selectedSnippetId, setSelectedSnippetId] = useState<number | null>(null);

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
        enabled: open,
    });

    // Fetch recommendations
    const { data: recData, isLoading: loadingRecs } = useQuery<{ recommendations: CaseStudy[], pricingBenchmarks: any }>({
        queryKey: ["/api/case-studies/recommend", leadId],
        queryFn: async () => {
            const res = await fetch(`/api/case-studies/recommend/${leadId}`, { credentials: "include" });
            if (!res.ok) throw new Error("Failed to fetch recommendations");
            return res.json();
        },
        enabled: open && !!leadId,
    });

    // Fetch selected case study with snippets
    const { data: studyDetails, isLoading: loadingDetails } = useQuery<CaseStudyWithSnippets>({
        queryKey: ["/api/case-studies", selectedStudy?.id],
        queryFn: async () => {
            const res = await fetch(`/api/case-studies/${selectedStudy!.id}`, { credentials: "include" });
            if (!res.ok) throw new Error("Failed to fetch case study");
            return res.json();
        },
        enabled: !!selectedStudy?.id,
    });

    const handleSelectStudy = (study: CaseStudy) => {
        setSelectedStudy(study as CaseStudyWithSnippets);
        setSelectedSnippetId(null);
    };

    const handleInsertFull = () => {
        if (!studyDetails) return;

        const content = formatFullCaseStudy(studyDetails);
        onInsert(content, "full");
        handleClose();
    };

    const handleInsertSnippet = () => {
        if (!studyDetails || !selectedSnippetId) return;

        const snippet = studyDetails.snippets.find(s => s.id === selectedSnippetId);
        if (!snippet) return;

        const content = formatSnippet(snippet, studyDetails);
        onInsert(content, "snippet");
        handleClose();
    };

    const handleClose = () => {
        setSelectedStudy(null);
        setSelectedSnippetId(null);
        setSearchQuery("");
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[80vh]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Insert Case Study
                    </DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-4 h-[500px]">
                    {/* Left: Case Study List */}
                    <div className="space-y-3">
                        <Tabs defaultValue={leadId ? "recommended" : "all"} className="h-full">
                            <div className="flex items-center justify-between mb-4">
                                <TabsList className="w-full">
                                    {leadId && (
                                        <TabsTrigger value="recommended" className="flex-1">
                                            <Sparkles className="h-4 w-4 mr-2" />
                                            Smart Match
                                        </TabsTrigger>
                                    )}
                                    <TabsTrigger value="all" className="flex-1">All Case Studies</TabsTrigger>
                                </TabsList>
                            </div>

                            <div className="relative mb-4">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search case studies..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10"
                                />
                            </div>

                            <TabsContent value="recommended" className="m-0 h-[380px]">
                                <ScrollArea className="h-full">
                                    {loadingRecs ? (
                                        <div className="space-y-2">
                                            {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
                                        </div>
                                    ) : recData?.recommendations?.length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground">
                                            <Sparkles className="h-10 w-10 mx-auto mb-2 opacity-30" />
                                            <p className="text-sm">No smart recommendations found</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2 pr-2">
                                            {recData?.recommendations.map((study) => (
                                                <StudyCard
                                                    key={study.id}
                                                    study={study}
                                                    isSelected={selectedStudy?.id === study.id}
                                                    onClick={() => handleSelectStudy(study)}
                                                    isRecommended
                                                />
                                            ))}
                                        </div>
                                    )}
                                </ScrollArea>
                            </TabsContent>

                            <TabsContent value="all" className="m-0 h-[380px]">
                                <ScrollArea className="h-full">
                                    {isLoading ? (
                                        <div className="space-y-2">
                                            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16" />)}
                                        </div>
                                    ) : caseStudies?.length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground">
                                            <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
                                            <p className="text-sm">No case studies found</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2 pr-2">
                                            {caseStudies?.map((study) => (
                                                <StudyCard
                                                    key={study.id}
                                                    study={study}
                                                    isSelected={selectedStudy?.id === study.id}
                                                    onClick={() => handleSelectStudy(study)}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </ScrollArea>
                            </TabsContent>
                        </Tabs>
                    </div>

                    {/* Right: Preview & Snippets */}
                    <div className="border-l pl-4 space-y-3">
                        {!selectedStudy ? (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                                <FileText className="h-12 w-12 mb-2 opacity-30" />
                                <p className="text-sm">Select a case study to preview</p>
                            </div>
                        ) : loadingDetails ? (
                            <div className="space-y-3">
                                <Skeleton className="h-24" />
                                <Skeleton className="h-32" />
                            </div>
                        ) : studyDetails ? (
                            <ScrollArea className="h-[440px] pr-2">
                                <div className="space-y-4">
                                    {/* Case Study Header */}
                                    <div>
                                        <h3 className="font-semibold">{studyDetails.title}</h3>
                                        {studyDetails.clientName && (
                                            <p className="text-sm text-muted-foreground">{studyDetails.clientName}</p>
                                        )}
                                        {studyDetails.heroStat && (
                                            <Badge className="mt-1">{studyDetails.heroStat}</Badge>
                                        )}
                                    </div>

                                    <p className="text-sm text-muted-foreground">{studyDetails.blurb}</p>

                                    {/* Insert Full Button */}
                                    <Button
                                        variant="outline"
                                        className="w-full"
                                        onClick={handleInsertFull}
                                    >
                                        <Copy className="h-4 w-4 mr-2" />
                                        Insert Full Case Study
                                    </Button>

                                    <Separator />

                                    {/* Snippets */}
                                    <div>
                                        <h4 className="text-sm font-medium mb-2">
                                            Available Snippets ({studyDetails.snippets?.length || 0})
                                        </h4>

                                        {studyDetails.snippets?.length > 0 ? (
                                            <div className="space-y-2">
                                                {studyDetails.snippets.map(snippet => {
                                                    const Icon = SNIPPET_ICONS[snippet.snippetType || "quote"] || Quote;
                                                    const isSelected = selectedSnippetId === snippet.id;

                                                    return (
                                                        <Card
                                                            key={snippet.id}
                                                            className={`cursor-pointer transition-colors ${isSelected ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                                                                }`}
                                                            onClick={() => setSelectedSnippetId(isSelected ? null : snippet.id)}
                                                        >
                                                            <CardContent className="p-3">
                                                                <div className="flex items-start gap-2">
                                                                    <Icon className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex items-center gap-2">
                                                                            <p className="text-sm font-medium">{snippet.title}</p>
                                                                            {isSelected && (
                                                                                <Check className="h-3 w-3 text-primary" />
                                                                            )}
                                                                        </div>
                                                                        <p className="text-xs text-muted-foreground line-clamp-2">
                                                                            {snippet.content}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </CardContent>
                                                        </Card>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-muted-foreground text-center py-4">
                                                No snippets available for this case study
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </ScrollArea>
                        ) : null}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleClose}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleInsertSnippet}
                        disabled={!selectedSnippetId}
                    >
                        <Copy className="h-4 w-4 mr-2" />
                        Insert Selected Snippet
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function formatFullCaseStudy(study: CaseStudyWithSnippets): string {
    let content = `## ${study.title}\n\n`;

    if (study.clientName) {
        content += `**Client:** ${study.clientName}\n\n`;
    }

    if (study.heroStat) {
        content += `**Key Result:** ${study.heroStat}\n\n`;
    }

    content += `${study.blurb}\n`;

    // Add snippets as sections
    if (study.snippets?.length > 0) {
        content += "\n---\n\n";

        const quotes = study.snippets.filter(s => s.snippetType === "quote");
        const stats = study.snippets.filter(s => s.snippetType === "stat" || s.snippetType === "result");

        if (stats.length > 0) {
            content += "**Key Metrics:**\n";
            stats.forEach(s => {
                content += `- ${s.title}: ${s.content}\n`;
            });
            content += "\n";
        }

        if (quotes.length > 0) {
            quotes.forEach(s => {
                content += `> "${s.content}"\n> — ${s.title}\n\n`;
            });
        }
    }

    return content;
}

function formatSnippet(snippet: CaseStudySnippet, study: CaseStudyWithSnippets): string {
    switch (snippet.snippetType) {
        case "quote":
            return `> "${snippet.content}"\n> — ${snippet.title}, ${study.clientName || study.title}`;
        case "stat":
        case "result":
            return `**${snippet.title}:** ${snippet.content}`;
        case "summary":
        default:
            return snippet.content;
    }
}

function StudyCard({ study, isSelected, onClick, isRecommended }: {
    study: CaseStudy,
    isSelected: boolean,
    onClick: () => void,
    isRecommended?: boolean
}) {
    return (
        <Card
            className={`cursor-pointer transition-colors ${isSelected
                ? "border-primary bg-primary/5"
                : "hover:bg-muted/50"
                }`}
            onClick={onClick}
        >
            <CardContent className="p-3">
                <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <h4 className="font-medium text-sm truncate">{study.title}</h4>
                            {isRecommended && (
                                <Badge variant="secondary" className="px-1 py-0 text-[10px] h-4">
                                    <Sparkles className="w-2 h-2 mr-1" />
                                    Match
                                </Badge>
                            )}
                            {isSelected && (
                                <Check className="h-4 w-4 text-primary flex-shrink-0" />
                            )}
                        </div>
                        {study.clientName && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Building2 className="h-3 w-3" />
                                {study.clientName}
                            </p>
                        )}
                        <div className="flex flex-wrap gap-1 mt-1">
                            {study.tags?.slice(0, 2).map(tag => (
                                <Badge key={tag} variant="outline" className="text-[10px] px-1 py-0">
                                    {tag}
                                </Badge>
                            ))}
                        </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </div>
            </CardContent>
        </Card>
    );
}
