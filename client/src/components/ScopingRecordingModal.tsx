import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Mic, Square, Loader2, CheckCircle2, AlertCircle, Brain, Building2, Ruler, FileText, MapPin, Phone, Mail, User } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Lead } from "@shared/schema";

interface ScopingRecordingModalProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ExtractedScope {
  sqft?: number;
  buildingType?: string;
  scope?: string;
  disciplines?: string;
  projectName?: string;
  projectAddress?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
  risks?: string[];
  specialRequirements?: string[];
}

export function ScopingRecordingModal({ lead, open, onOpenChange }: ScopingRecordingModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [transcription, setTranscription] = useState<string | null>(null);
  const [extractedScope, setExtractedScope] = useState<ExtractedScope | null>(null);
  const [step, setStep] = useState<"record" | "transcribing" | "extracting" | "review">("record");
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!open) {
      setIsRecording(false);
      setRecordingTime(0);
      setAudioBlob(null);
      setTranscription(null);
      setExtractedScope(null);
      setStep("record");
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  }, [open]);

  const transcribeMutation = useMutation({
    mutationFn: async (blob: Blob) => {
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");
      if (lead?.id) {
        formData.append("leadId", lead.id.toString());
      }
      
      const response = await fetch("/api/scoping/transcribe", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Transcription failed");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setTranscription(data.transcription);
      setStep("extracting");
      extractScopeMutation.mutate(data.transcription);
    },
    onError: () => {
      toast({
        title: "Transcription Failed",
        description: "Could not transcribe the recording. Please try again.",
        variant: "destructive",
      });
      setStep("record");
    },
  });

  const extractScopeMutation = useMutation({
    mutationFn: async (text: string) => {
      const response = await apiRequest("POST", "/api/scoping/extract", {
        transcription: text,
        leadId: lead?.id,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setExtractedScope(data.scope);
      setStep("review");
    },
    onError: () => {
      toast({
        title: "Extraction Failed",
        description: "Could not extract scope details. You can still review the transcription.",
        variant: "destructive",
      });
      setStep("review");
    },
  });

  const applyToLeadMutation = useMutation({
    mutationFn: async (scope: ExtractedScope) => {
      const response = await apiRequest("PUT", `/api/leads/${lead?.id}`, {
        ...(scope.sqft && { sqft: scope.sqft }),
        ...(scope.buildingType && { buildingType: scope.buildingType }),
        ...(scope.scope && { scope: scope.scope }),
        ...(scope.disciplines && { disciplines: scope.disciplines }),
        ...(scope.projectName && { projectName: scope.projectName }),
        ...(scope.projectAddress && { projectAddress: scope.projectAddress }),
        ...(scope.contactName && { contactName: scope.contactName }),
        ...(scope.contactEmail && { contactEmail: scope.contactEmail }),
        ...(scope.contactPhone && { contactPhone: scope.contactPhone }),
        ...(scope.notes && { notes: scope.notes }),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({
        title: "Scope Applied",
        description: "The extracted scope details have been saved to the deal.",
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Failed to Apply",
        description: "Could not save the scope details. Please try again.",
        variant: "destructive",
      });
    },
  });

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
        setStep("transcribing");
        transcribeMutation.mutate(blob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      timerRef.current = setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);
    } catch (error) {
      toast({
        title: "Microphone Access Denied",
        description: "Please allow microphone access to record scoping calls.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="w-5 h-5" />
            Scoping Call Recording
          </DialogTitle>
          <DialogDescription>
            {lead?.clientName} - {lead?.projectName || "New Project"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {step === "record" && (
            <div className="flex flex-col items-center gap-4 py-6">
              {!isRecording ? (
                <>
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                    <Mic className="w-10 h-10 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground text-center">
                    Click record and describe the project scope while on the call.
                    AI will extract key details automatically.
                  </p>
                  <Button 
                    onClick={startRecording}
                    size="lg"
                    className="gap-2"
                    data-testid="button-start-recording"
                  >
                    <Mic className="w-4 h-4" />
                    Start Recording
                  </Button>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 rounded-full bg-destructive/20 flex items-center justify-center animate-pulse">
                    <div className="w-8 h-8 rounded-full bg-destructive" />
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-mono font-bold">{formatTime(recordingTime)}</p>
                    <p className="text-sm text-muted-foreground">Recording...</p>
                  </div>
                  <Button 
                    onClick={stopRecording}
                    variant="destructive"
                    size="lg"
                    className="gap-2"
                    data-testid="button-stop-recording"
                  >
                    <Square className="w-4 h-4" />
                    Stop Recording
                  </Button>
                </>
              )}
            </div>
          )}

          {step === "transcribing" && (
            <div className="flex flex-col items-center gap-4 py-6">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
              <div className="text-center">
                <p className="font-medium">Transcribing...</p>
                <p className="text-sm text-muted-foreground">
                  Converting your recording to text
                </p>
              </div>
            </div>
          )}

          {step === "extracting" && (
            <div className="flex flex-col items-center gap-4 py-6">
              <Brain className="w-12 h-12 animate-pulse text-primary" />
              <div className="text-center">
                <p className="font-medium">Extracting Scope Details...</p>
                <p className="text-sm text-muted-foreground">
                  AI is analyzing the conversation
                </p>
              </div>
            </div>
          )}

          {step === "review" && (
            <div className="space-y-4">
              {transcription && (
                <div>
                  <p className="text-sm font-medium mb-2">Transcription</p>
                  <ScrollArea className="h-24 border rounded-md p-3">
                    <p className="text-sm text-muted-foreground">{transcription}</p>
                  </ScrollArea>
                </div>
              )}

              {extractedScope && (
                <div>
                  <p className="text-sm font-medium mb-2 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    Extracted Details
                  </p>
                  <Card>
                    <CardContent className="p-3 space-y-2">
                      {extractedScope.projectName && (
                        <div className="flex items-center gap-2 text-sm">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">Project:</span>
                          <span>{extractedScope.projectName}</span>
                        </div>
                      )}
                      {extractedScope.projectAddress && (
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">Address:</span>
                          <span>{extractedScope.projectAddress}</span>
                        </div>
                      )}
                      {extractedScope.sqft && (
                        <div className="flex items-center gap-2 text-sm">
                          <Ruler className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">Size:</span>
                          <span>{extractedScope.sqft.toLocaleString()} sqft</span>
                        </div>
                      )}
                      {extractedScope.buildingType && (
                        <div className="flex items-center gap-2 text-sm">
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">Type:</span>
                          <span>{extractedScope.buildingType}</span>
                        </div>
                      )}
                      {extractedScope.scope && (
                        <div className="flex items-center gap-2 text-sm">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">Scope:</span>
                          <Badge variant="secondary">{extractedScope.scope}</Badge>
                        </div>
                      )}
                      {extractedScope.contactName && (
                        <div className="flex items-center gap-2 text-sm">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">Contact:</span>
                          <span>{extractedScope.contactName}</span>
                        </div>
                      )}
                      {extractedScope.contactEmail && (
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          <span>{extractedScope.contactEmail}</span>
                        </div>
                      )}
                      {extractedScope.contactPhone && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          <span>{extractedScope.contactPhone}</span>
                        </div>
                      )}
                      {extractedScope.risks && extractedScope.risks.length > 0 && (
                        <div className="pt-2 border-t">
                          <div className="flex items-center gap-2 text-sm mb-1">
                            <AlertCircle className="w-4 h-4 text-amber-500" />
                            <span className="font-medium">Risks Identified:</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {extractedScope.risks.map((risk, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {risk}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep("record");
                    setAudioBlob(null);
                    setTranscription(null);
                    setExtractedScope(null);
                  }}
                  data-testid="button-record-again"
                >
                  Record Again
                </Button>
                {extractedScope && (
                  <Button
                    onClick={() => applyToLeadMutation.mutate(extractedScope)}
                    disabled={applyToLeadMutation.isPending}
                    className="flex-1"
                    data-testid="button-apply-scope"
                  >
                    {applyToLeadMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                    )}
                    Apply to Deal
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
