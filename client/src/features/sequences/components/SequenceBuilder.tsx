import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, Mail, Clock, Save, GripVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Sequence, SequenceStep } from "@shared/schema";

interface SequenceBuilderProps {
    sequenceId: number;
}

export function SequenceBuilder({ sequenceId }: SequenceBuilderProps) {
    const { toast } = useToast();
    const [isAddingStep, setIsAddingStep] = useState(false);
    const [newStep, setNewStep] = useState({
        subject: "",
        content: "",
        delayDays: 1,
    });

    // Fetch Steps
    const { data: steps, isLoading } = useQuery<SequenceStep[]>({
        queryKey: [`/api/sequences/${sequenceId}/steps`],
    });

    // Create Step Mutation
    const createStepMutation = useMutation({
        mutationFn: async (stepData: typeof newStep) => {
            const nextOrder = (steps?.length || 0) + 1;
            return apiRequest("POST", `/api/sequences/${sequenceId}/steps`, {
                ...stepData,
                stepOrder: nextOrder,
                type: "email",
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`/api/sequences/${sequenceId}/steps`] });
            toast({ title: "Step Added", description: "Email step added to sequence." });
            setIsAddingStep(false);
            setNewStep({ subject: "", content: "", delayDays: 1 });
        },
        onError: () => {
            toast({ title: "Error", description: "Failed to add step.", variant: "destructive" });
        },
    });

    const handleAddStep = () => {
        if (!newStep.subject || !newStep.content) {
            toast({ title: "Validation Error", description: "Subject and Content are required.", variant: "destructive" });
            return;
        }
        createStepMutation.mutate(newStep);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Sequence Steps</h3>
                <Button size="sm" onClick={() => setIsAddingStep(true)} disabled={isAddingStep}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Email Step
                </Button>
            </div>

            <div className="space-y-4">
                {isLoading && <p className="text-muted-foreground text-sm">Loading steps...</p>}
                {steps?.length === 0 && !isAddingStep && (
                    <div className="text-center py-8 border-2 border-dashed rounded-lg">
                        <Mail className="h-8 w-8 mx-auto text-muted-foreground opacity-50 mb-2" />
                        <p className="text-sm text-muted-foreground">No steps yet. Add your first email.</p>
                    </div>
                )}

                {steps?.map((step, index) => (
                    <Card key={step.id} className="relative group">
                        <CardHeader className="py-3 px-4 bg-muted/30">
                            <div className="flex items-center gap-3">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                    {index + 1}
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-sm font-medium">{step.subject}</h4>
                                </div>
                                <Badge variant="outline" className="text-xs">
                                    <Clock className="h-3 w-3 mr-1" />
                                    Wait {step.delayDays} day{step.delayDays !== 1 ? "s" : ""}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="py-3 px-4 text-sm">
                            <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground line-clamp-2">
                                {step.content}
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {isAddingStep && (
                    <Card className="border-primary/50 shadow-md">
                        <CardHeader className="py-3 px-4 bg-primary/5">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold flex items-center gap-2">
                                    <Plus className="h-4 w-4" /> New Step
                                </span>
                                <Button variant="ghost" size="sm" onClick={() => setIsAddingStep(false)} className="h-6 w-6 p-0 rounded-full">
                                    &times;
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 space-y-4">
                            <div className="grid grid-cols-4 gap-4">
                                <div className="col-span-3 space-y-2">
                                    <Label htmlFor="subject">Subject Line</Label>
                                    <Input
                                        id="subject"
                                        placeholder="e.g. following up..."
                                        value={newStep.subject}
                                        onChange={(e) => setNewStep({ ...newStep, subject: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="delay">Wait (Days)</Label>
                                    <Input
                                        id="delay"
                                        type="number"
                                        min={0}
                                        value={newStep.delayDays}
                                        onChange={(e) => setNewStep({ ...newStep, delayDays: parseInt(e.target.value) || 0 })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="content">Email Body</Label>
                                <div className="text-xs text-muted-foreground mb-1">
                                    Variables: <code className="bg-muted px-1 rounded">{"{{clientName}}"}</code>
                                </div>
                                <Textarea
                                    id="content"
                                    className="min-h-[150px] font-mono text-sm"
                                    placeholder="Hey {{clientName}}, just wanted to check in..."
                                    value={newStep.content}
                                    onChange={(e) => setNewStep({ ...newStep, content: e.target.value })}
                                />
                            </div>
                        </CardContent>
                        <CardFooter className="bg-muted/10 py-2 px-4 justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setIsAddingStep(false)}>Cancel</Button>
                            <Button size="sm" onClick={handleAddStep} disabled={createStepMutation.isPending}>
                                <Save className="h-4 w-4 mr-2" />
                                Save Step
                            </Button>
                        </CardFooter>
                    </Card>
                )}
            </div>
        </div>
    );
}
