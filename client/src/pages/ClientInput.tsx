import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function ClientInput() {
  const [, params] = useRoute("/client-input/:token");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const { data, isLoading, error } = useQuery<{
    id: number;
    projectName: string;
    clientName: string;
    clientStatus: string;
    unknowns: {
      siteStatus: boolean;
      mepScope: boolean;
      actScanning: boolean;
      scanningOnly: boolean;
    };
  }>({
    queryKey: [`/api/public/quote/${params?.token}`],
    enabled: !!params?.token
  });

  const [submitError, setSubmitError] = useState<string | null>(null);
  
  const submitMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/public/quote/${params?.token}`, { answers });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to submit answers");
      }
      return response.json();
    },
    onSuccess: () => {
      setSubmitError(null);
      setSubmitted(true);
    },
    onError: (error: Error) => {
      setSubmitError(error.message);
    }
  });

  if (submitted || data?.clientStatus === "answered") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
        <Card className="w-full max-w-md text-center p-8">
          <div className="flex justify-center mb-4">
            <CheckCircle2 className="w-16 h-16 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-green-600 mb-2" data-testid="text-thank-you">
            Thank You!
          </h2>
          <p className="text-muted-foreground">
            We have received your project details. Your Scan2Plan representative will send the final quote shortly.
          </p>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">Loading Project Details...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
        <Card className="w-full max-w-md text-center p-8">
          <h2 className="text-xl font-bold text-destructive mb-2">Link Expired or Invalid</h2>
          <p className="text-muted-foreground">
            This link may have expired or is no longer valid. Please contact your Scan2Plan representative for a new link.
          </p>
        </Card>
      </div>
    );
  }

  const unknownsCount = Object.values(data.unknowns).filter(Boolean).length;
  const answersCount = Object.keys(answers).length;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 py-12 px-4">
      <Card className="max-w-lg mx-auto shadow-lg">
        <CardHeader className="bg-primary text-primary-foreground rounded-t-lg">
          <CardTitle>Project Clarification Request</CardTitle>
          <p className="text-sm opacity-90">
            {data.clientName ? `Hi ${data.clientName},` : ''} Please answer the following questions to finalize your quote for <strong>{data.projectName}</strong>.
          </p>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">

          {data.unknowns.siteStatus && (
            <div className="space-y-2">
              <label className="font-semibold">What is the current site status?</label>
              <Select onValueChange={(val) => setAnswers({...answers, siteStatus: val})} data-testid="select-site-status">
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vacant">Vacant</SelectItem>
                  <SelectItem value="occupied">Occupied (Business Hours)</SelectItem>
                  <SelectItem value="construction">Under Construction</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {data.unknowns.mepScope && (
            <div className="space-y-2">
              <label className="font-semibold">Do you need MEP (Pipes/Ducts) modeled?</label>
              <Select onValueChange={(val) => setAnswers({...answers, mepScope: val})} data-testid="select-mep-scope">
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Yes, Full MEP</SelectItem>
                  <SelectItem value="partial">Partial (Main Runs Only)</SelectItem>
                  <SelectItem value="none">No, Architecture Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {data.unknowns.actScanning && (
            <div className="space-y-2">
              <label className="font-semibold">Do you have Acoustical Ceiling Tiles (ACT)?</label>
              <Select onValueChange={(val) => setAnswers({...answers, actScanning: val})} data-testid="select-act-scanning">
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes, has ACT (requires above-ceiling scanning)</SelectItem>
                  <SelectItem value="no">No ACT / Open Ceiling</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {data.unknowns.scanningOnly && (
            <div className="space-y-2">
              <label className="font-semibold">Do you need just scanning, or scanning + modeling?</label>
              <Select onValueChange={(val) => setAnswers({...answers, scanningOnly: val})} data-testid="select-scanning-only">
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_day">Scanning Only - Full Day</SelectItem>
                  <SelectItem value="half_day">Scanning Only - Half Day</SelectItem>
                  <SelectItem value="none">Full Service (Scanning + BIM Modeling)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {submitError && (
            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {submitError}
            </div>
          )}
          
          <Button 
            onClick={() => submitMutation.mutate()}
            className="w-full text-lg py-6"
            disabled={answersCount < unknownsCount || submitMutation.isPending}
            data-testid="button-submit-answers"
          >
            {submitMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              `Submit Answers (${answersCount}/${unknownsCount})`
            )}
          </Button>
        </CardContent>
      </Card>
      
      <p className="text-center text-xs text-muted-foreground mt-8">
        Powered by Scan2Plan
      </p>
    </div>
  );
}
