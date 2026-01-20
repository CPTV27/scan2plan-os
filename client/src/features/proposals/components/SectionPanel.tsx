/**
 * SectionPanel Component
 * 
 * Left panel of the proposal layout editor.
 * Displays an ordered list of proposal sections with dropdown menus
 * to select template variants for each section.
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    GripVertical,
    Plus,
    Trash2,
    MoreVertical,
    FileText,
    ChevronDown,
    Pencil,
} from "lucide-react";
import type { ProposalTemplate } from "@shared/schema";
import { ProposalSection, CATEGORY_LABELS } from "../hooks/useProposalTemplates";

interface SectionPanelProps {
    sections: ProposalSection[];
    onSectionsChange: (sections: ProposalSection[]) => void;
    groupedTemplates: Record<string, ProposalTemplate[]>;
    onSectionClick: (sectionId: string) => void;
    onEditSection?: (section: ProposalSection) => void;
    activeSectionId?: string;
}

export function SectionPanel({
    sections,
    onSectionsChange,
    groupedTemplates,
    onSectionClick,
    onEditSection,
    activeSectionId,
}: SectionPanelProps) {
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

    // Toggle section inclusion
    const toggleSection = (sectionId: string) => {
        const updated = sections.map(s =>
            s.id === sectionId ? { ...s, included: !s.included } : s
        );
        onSectionsChange(updated);
    };

    // Change template for a section
    const changeTemplate = (sectionId: string, templateId: number, newContent: string, newName: string) => {
        const updated = sections.map(s =>
            s.id === sectionId
                ? { ...s, templateId, content: newContent, name: newName }
                : s
        );
        onSectionsChange(updated);
    };

    // Remove a section
    const removeSection = (sectionId: string) => {
        const updated = sections.filter(s => s.id !== sectionId);
        onSectionsChange(updated);
    };

    // Add a new section
    const addSection = (template: ProposalTemplate) => {
        const newSection: ProposalSection = {
            id: `section-${template.id}-${Date.now()}`,
            templateId: template.id,
            category: template.category || "other",
            name: template.name,
            content: template.content,
            sortOrder: sections.length + 1,
            included: true,
        };
        onSectionsChange([...sections, newSection]);
    };

    // Drag handlers for reordering
    const handleDragStart = (index: number) => {
        setDraggedIndex(index);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === index) return;

        const newSections = [...sections];
        const [removed] = newSections.splice(draggedIndex, 1);
        newSections.splice(index, 0, removed);

        // Update sort orders
        newSections.forEach((s, i) => {
            s.sortOrder = i + 1;
        });

        onSectionsChange(newSections);
        setDraggedIndex(index);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
    };

    // Get all available templates for adding
    const allTemplates = Object.values(groupedTemplates).flat();

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Proposal Sections
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-hidden">
                <ScrollArea className="h-full">
                    <div className="space-y-1 p-3 pt-0">
                        {sections.map((section, index) => {
                            const categoryTemplates = groupedTemplates[section.category] || [];
                            const isActive = activeSectionId === section.id;

                            return (
                                <div
                                    key={section.id}
                                    draggable
                                    onDragStart={() => handleDragStart(index)}
                                    onDragOver={(e) => handleDragOver(e, index)}
                                    onDragEnd={handleDragEnd}
                                    onClick={() => onSectionClick(section.id)}
                                    className={`
                    group flex items-center gap-2 p-2 rounded-md border cursor-pointer
                    transition-all duration-150
                    ${isActive
                                            ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                                            : "border-transparent hover:border-border hover:bg-muted/50"
                                        }
                    ${!section.included ? "opacity-50" : ""}
                    ${draggedIndex === index ? "opacity-50" : ""}
                  `}
                                >
                                    {/* Drag Handle */}
                                    <div className="cursor-grab text-muted-foreground hover:text-foreground">
                                        <GripVertical className="h-4 w-4" />
                                    </div>

                                    {/* Include Checkbox */}
                                    <Checkbox
                                        checked={section.included}
                                        onCheckedChange={() => toggleSection(section.id)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="shrink-0"
                                    />

                                    {/* Section Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-muted-foreground font-medium">
                                                {index + 1}.
                                            </span>
                                            {categoryTemplates.length > 1 ? (
                                                <Select
                                                    value={String(section.templateId)}
                                                    onValueChange={(value) => {
                                                        const template = categoryTemplates.find(t => t.id === Number(value));
                                                        if (template) {
                                                            changeTemplate(section.id, template.id, template.content, template.name);
                                                        }
                                                    }}
                                                >
                                                    <SelectTrigger
                                                        className="h-7 text-xs border-0 bg-transparent p-0 shadow-none hover:bg-muted"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {categoryTemplates.map((t) => (
                                                            <SelectItem key={t.id} value={String(t.id)} className="text-xs">
                                                                {t.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <span className="text-sm font-medium truncate">
                                                    {section.name}
                                                </span>
                                            )}
                                        </div>
                                        <Badge variant="outline" className="text-[10px] px-1 py-0 mt-1">
                                            {CATEGORY_LABELS[section.category] || section.category}
                                        </Badge>
                                    </div>

                                    {/* Actions Menu */}
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 opacity-0 group-hover:opacity-100"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <MoreVertical className="h-3 w-3" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem
                                                onClick={() => onEditSection?.(section)}
                                            >
                                                <Pencil className="h-3 w-3 mr-2" />
                                                Edit section
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => toggleSection(section.id)}>
                                                {section.included ? "Exclude from proposal" : "Include in proposal"}
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                                onClick={() => removeSection(section.id)}
                                                className="text-destructive"
                                            >
                                                <Trash2 className="h-3 w-3 mr-2" />
                                                Remove section
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            );
                        })}
                    </div>
                </ScrollArea>
            </CardContent>

            {/* Add Section Button */}
            <div className="p-3 border-t">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="w-full">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Section
                            <ChevronDown className="h-3 w-3 ml-auto" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="start">
                        {Object.entries(groupedTemplates).map(([category, templates]) => (
                            <div key={category}>
                                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                                    {CATEGORY_LABELS[category] || category}
                                </div>
                                {templates.map((template) => (
                                    <DropdownMenuItem
                                        key={template.id}
                                        onClick={() => addSection(template)}
                                    >
                                        {template.name}
                                    </DropdownMenuItem>
                                ))}
                                <DropdownMenuSeparator />
                            </div>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </Card>
    );
}
