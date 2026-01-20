/**
 * ProposalPreview Component
 * 
 * Right panel of the proposal layout editor.
 * Renders the assembled proposal with variable substitution.
 */

import React, { useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ProposalSection } from "../hooks/useProposalTemplates";
import type { Lead } from "@shared/schema";

interface ProposalPreviewProps {
    sections: ProposalSection[];
    activeSectionId?: string;
    onSectionVisible?: (sectionId: string) => void;
    lead?: Lead;
}

export function ProposalPreview({
    sections,
    activeSectionId,
    onSectionVisible,
    lead,
}: ProposalPreviewProps) {
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

    // Scroll to active section when it changes
    useEffect(() => {
        if (activeSectionId && sectionRefs.current[activeSectionId]) {
            sectionRefs.current[activeSectionId]?.scrollIntoView({
                behavior: "smooth",
                block: "start",
            });
        }
    }, [activeSectionId]);

    // Only show included sections
    const includedSections = sections.filter(s => s.included);

    if (includedSections.length === 0) {
        return (
            <Card className="h-full flex items-center justify-center">
                <div className="text-center text-muted-foreground p-8">
                    <p className="text-lg font-medium">No sections selected</p>
                    <p className="text-sm mt-1">Add or include sections from the panel on the left</p>
                </div>
            </Card>
        );
    }

    return (
        <Card className="h-full overflow-hidden">
            <ScrollArea className="h-full" ref={scrollAreaRef}>
                <div className="bg-white dark:bg-zinc-900 min-h-full">
                    {/* Proposal Document */}
                    <div className="max-w-3xl mx-auto">
                        {/* Cover Page - Full page layout */}
                        <div className="min-h-[800px] flex flex-col py-8 px-12 print:min-h-screen print:page-break-after-always">
                            {/* Top Half - Large Logo */}
                            <div className="flex-1 flex items-center justify-center pt-12">
                                <img
                                    src="/logo-cover.png"
                                    alt="Scan2Plan"
                                    className="w-80 h-auto object-contain"
                                />
                            </div>

                            {/* Bottom Half - Project Info */}
                            <div className="flex-1 flex flex-col justify-center text-center space-y-6 pb-12">
                                <h1 className="text-4xl font-bold text-foreground">
                                    Scan2Plan Proposal
                                </h1>
                                {/* Extract project name from first section if it's Cover Page */}
                                {includedSections.length > 0 && (
                                    <div className="space-y-4">
                                        <h2 className="text-2xl font-semibold text-muted-foreground">
                                            {/* Dynamically try to extract from cover content */}
                                            Professional 3D Scanning & BIM Services
                                        </h2>
                                        <div className="text-sm text-muted-foreground mt-8">
                                            <p>Scan2Plan {lead?.projectAddress || "New York"}</p>
                                            <p className="text-primary">www.scan2plan.com</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Content Pages - Skip cover page section, render rest */}
                        <div className="py-8 px-12">
                            {includedSections
                                .filter((section) => section.name !== 'Cover Page')
                                .map((section, index) => (
                                    <div
                                        key={section.id}
                                        ref={(el) => {
                                            sectionRefs.current[section.id] = el;
                                        }}
                                        id={`preview-${section.id}`}
                                        className={`
                      relative scroll-mt-4
                      ${activeSectionId === section.id ? "ring-2 ring-primary/30 rounded-lg -mx-4 px-4 py-2" : ""}
                    `}
                                    >
                                        {/* Section indicator badge (subtle) */}
                                        <div className="absolute -left-8 top-0 opacity-30 hover:opacity-100 transition-opacity">
                                            <Badge variant="outline" className="text-[10px] px-1">
                                                {index + 1}
                                            </Badge>
                                        </div>

                                        {/* Render markdown content */}
                                        <div className="prose prose-sm dark:prose-invert max-w-none">
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    // Custom heading styles
                                                    h1: ({ children }: { children?: React.ReactNode }) => (
                                                        <h1 className="text-2xl font-bold mt-0 mb-4">{children}</h1>
                                                    ),
                                                    h2: ({ children }: { children?: React.ReactNode }) => (
                                                        <h2 className="text-xl font-semibold mt-6 mb-3 pb-2 border-b">{children}</h2>
                                                    ),
                                                    h3: ({ children }: { children?: React.ReactNode }) => (
                                                        <h3 className="text-lg font-medium mt-4 mb-2">{children}</h3>
                                                    ),
                                                    // Table styling
                                                    table: ({ children }: { children?: React.ReactNode }) => (
                                                        <table className="w-full border-collapse my-4">{children}</table>
                                                    ),
                                                    thead: ({ children }: { children?: React.ReactNode }) => (
                                                        <thead className="bg-muted">{children}</thead>
                                                    ),
                                                    th: ({ children }: { children?: React.ReactNode }) => (
                                                        <th className="border p-2 text-left font-medium">{children}</th>
                                                    ),
                                                    td: ({ children }: { children?: React.ReactNode }) => (
                                                        <td className="border p-2">{children}</td>
                                                    ),
                                                    // List styling
                                                    ul: ({ children }: { children?: React.ReactNode }) => (
                                                        <ul className="list-disc pl-6 my-2 space-y-1">{children}</ul>
                                                    ),
                                                    ol: ({ children }: { children?: React.ReactNode }) => (
                                                        <ol className="list-decimal pl-6 my-2 space-y-1">{children}</ol>
                                                    ),
                                                    // Paragraph styling
                                                    p: ({ children }: { children?: React.ReactNode }) => (
                                                        <p className="my-2 leading-relaxed">{children}</p>
                                                    ),
                                                    // Strong/bold
                                                    strong: ({ children }: { children?: React.ReactNode }) => (
                                                        <strong className="font-semibold">{children}</strong>
                                                    ),
                                                    // Horizontal rule
                                                    hr: () => (
                                                        <hr className="my-6 border-t border-border" />
                                                    ),
                                                }}
                                            >
                                                {section.content}
                                            </ReactMarkdown>
                                        </div>

                                        {/* Section separator */}
                                        {index < includedSections.filter(s => s.name !== 'Cover Page').length - 1 && (
                                            <Separator className="my-8" />
                                        )}
                                    </div>
                                ))}

                            {/* Footer / Page break indicator */}
                            <div className="mt-12 pt-6 border-t border-dashed border-muted-foreground/30 text-center">
                                <span className="text-xs text-muted-foreground">
                                    End of Proposal Preview
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </ScrollArea>
        </Card>
    );
}
