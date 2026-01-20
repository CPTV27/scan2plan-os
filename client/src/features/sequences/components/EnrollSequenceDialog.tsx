import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { PlayCircle, Loader2 } from "lucide-react";
import type { Sequence } from "@shared/schema";

interface EnrollSequenceDialogProps {
    leadId: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function EnrollSequenceDialog({ leadId, open, onOpenChange }: EnrollSequenceDialogProps) {
    const { toast } = useToast();
    const [selectedSequenceId, setSelectedSequenceId] = useState<string>("");

    const { data: sequences, isLoading } = useQuery<Sequence[]>({
        queryKey: ['/api/sequences'],
    });

    const enrollMutation = useMutation({
        mutationFn: async (sequenceId: number) => {
            const res = await apiRequest("POST", `/api/leads/${leadId}/enroll`, { sequenceId });
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Enrolled", description: "Lead enrolled in sequence." });
            onOpenChange(false);
            setSelectedSequenceId("");
        },
        onError: (error: any) => {
            toast({
                title: "Enrollment Failed",
                description: error.message || "Failed to enroll lead.",
                variant: "destructive"
            });
        },
    });

    const handleEnroll = () => {
        if (!selectedSequenceId) return;
        enrollMutation.mutate(parseInt(selectedSequenceId));
    };

    const activeSequences = sequences?.filter(s => s.isActive) || [];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Enroll in Sequence</DialogTitle>
                    <DialogDescription>Start an automated email nurture flow for this lead.</DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    <div className="space-y-2">
                        <Label>Select Sequence</Label>
                        <Select value={selectedSequenceId} onValueChange={setSelectedSequenceId}>
                            <SelectTrigger disabled={isLoading}>
                                <SelectValue placeholder="Choose a sequence..." />
                            </SelectTrigger>
                            <SelectContent>
                                {activeSequences.map((seq) => (
                                    <SelectItem key={seq.id} value={seq.id.toString()}>
                                        {seq.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {activeSequences.length === 0 && !isLoading && (
                            <p className="text-xs text-muted-foreground">No active sequences found.</p>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleEnroll} disabled={!selectedSequenceId || enrollMutation.isPending}>
                        {enrollMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        <PlayCircle className="h-4 w-4 mr-2" />
                        Start Sequence
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
