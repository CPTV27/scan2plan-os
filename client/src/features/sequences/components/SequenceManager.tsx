import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, PlayCircle, Settings2, Trash2, Edit } from "lucide-react";
import type { Sequence } from "@shared/schema";
import { SequenceBuilder } from "./SequenceBuilder";
import { format } from "date-fns";

export function SequenceManager() {
    const { toast } = useToast();
    const [selectedSequence, setSelectedSequence] = useState<Sequence | null>(null);
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [newSequenceName, setNewSequenceName] = useState("");

    const { data: sequences, isLoading } = useQuery<Sequence[]>({
        queryKey: ['/api/sequences'],
    });

    const createMutation = useMutation({
        mutationFn: async (name: string) => {
            const res = await apiRequest('POST', '/api/sequences', { name, isActive: true });
            return res.json();
        },
        onSuccess: (newSeq) => {
            queryClient.invalidateQueries({ queryKey: ['/api/sequences'] });
            toast({ title: "Sequence Created", description: "Start adding steps." });
            setNewSequenceName("");
            setIsDialogOpen(false);
            // Open builder immediately
            setSelectedSequence(newSeq);
            setIsSheetOpen(true);
        },
    });

    const handleCreate = () => {
        if (!newSequenceName) return;
        createMutation.mutate(newSequenceName);
    };

    const handleOpenBuilder = (seq: Sequence) => {
        setSelectedSequence(seq);
        setIsSheetOpen(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold">Email Sequences</h3>
                    <p className="text-sm text-muted-foreground">Automated nurture flows for leads.</p>
                </div>
                <Button onClick={() => setIsDialogOpen(true)} data-testid="button-create-sequence">
                    <Plus className="h-4 w-4 mr-2" />
                    New Sequence
                </Button>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create New Sequence</DialogTitle>
                        <DialogDescription>Give your nurture sequence a name.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label>Sequence Name</Label>
                        <Input
                            value={newSequenceName}
                            onChange={(e) => setNewSequenceName(e.target.value)}
                            placeholder="e.g. Cold Lead Nurture"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreate} disabled={!newSequenceName || createMutation.isPending}>
                            Create & Build
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetContent className="sm:max-w-xl overflow-y-auto">
                    <SheetHeader className="mb-6">
                        <SheetTitle>Sequence Builder: {selectedSequence?.name}</SheetTitle>
                        <SheetDescription>Configure steps and delays for this sequence.</SheetDescription>
                    </SheetHeader>
                    {selectedSequence && <SequenceBuilder sequenceId={selectedSequence.id} />}
                </SheetContent>
            </Sheet>

            {isLoading ? (
                <div className="space-y-2">
                    <div className="h-12 bg-muted rounded animate-pulse" />
                    <div className="h-12 bg-muted rounded animate-pulse" />
                </div>
            ) : sequences?.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <PlayCircle className="h-12 w-12 mb-4 opacity-50" />
                        <p>No sequences found</p>
                        <Button variant="ghost" onClick={() => setIsDialogOpen(true)}>Create one now</Button>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Created</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sequences?.map((seq) => (
                                <TableRow key={seq.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleOpenBuilder(seq)}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            <PlayCircle className="h-4 w-4 text-primary" />
                                            {seq.name}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={seq.isActive ? "default" : "secondary"}>
                                            {seq.isActive ? "Active" : "Draft"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-xs">
                                        {seq.createdAt ? format(new Date(seq.createdAt), 'MMM d, yyyy') : '-'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleOpenBuilder(seq); }}>
                                            <Settings2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Card>
            )}
        </div>
    );
}
