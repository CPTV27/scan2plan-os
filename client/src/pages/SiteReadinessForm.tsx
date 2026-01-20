import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle2, AlertCircle, Building2, ClipboardList } from "lucide-react";
import { SITE_READINESS_QUESTIONS, type SiteReadinessQuestion } from "@shared/siteReadinessQuestions";

interface FormData {
  projectName: string;
  questionIds: string[];
  existingAnswers: Record<string, any>;
  status: string;
}

export default function SiteReadinessForm() {
  const { token } = useParams<{ token: string }>();
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);

  const { data: formData, isLoading, error } = useQuery<FormData>({
    queryKey: ["/api/public/site-readiness", token],
    queryFn: async () => {
      const res = await fetch(`/api/public/site-readiness/${token}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to load form");
      }
      return res.json();
    },
    enabled: !!token,
  });

  const submitMutation = useMutation({
    mutationFn: async (answers: Record<string, any>) => {
      const res = await fetch(`/api/public/site-readiness/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to submit");
      }
      return res.json();
    },
    onSuccess: () => {
      setSubmitted(true);
    },
  });

  const updateAnswer = (questionId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const getQuestionValue = (questionId: string) => {
    return answers[questionId] ?? formData?.existingAnswers?.[questionId];
  };

  const handleSubmit = () => {
    const mergedAnswers = { ...formData?.existingAnswers, ...answers };
    submitMutation.mutate(mergedAnswers);
  };

  const renderQuestion = (q: SiteReadinessQuestion) => {
    const currentValue = getQuestionValue(q.id);

    switch (q.type) {
      case "boolean":
        return (
          <div className="flex items-center gap-3">
            <Checkbox
              id={q.id}
              checked={currentValue === true}
              onCheckedChange={(checked) => updateAnswer(q.id, checked === true)}
              data-testid={`checkbox-${q.id}`}
            />
            <Label htmlFor={q.id} className="cursor-pointer">Yes</Label>
          </div>
        );
      case "select":
        return (
          <Select
            value={currentValue || ""}
            onValueChange={(value) => updateAnswer(q.id, value)}
          >
            <SelectTrigger data-testid={`select-${q.id}`}>
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {q.options?.map((opt) => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "number":
        return (
          <Input
            type="number"
            min="0"
            value={currentValue || ""}
            onChange={(e) => updateAnswer(q.id, parseInt(e.target.value) || 0)}
            placeholder="Enter a number"
            data-testid={`input-${q.id}`}
          />
        );
      case "text":
      default:
        return (
          <Textarea
            value={currentValue || ""}
            onChange={(e) => updateAnswer(q.id, e.target.value)}
            placeholder="Type your answer..."
            className="resize-none"
            data-testid={`textarea-${q.id}`}
          />
        );
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Unable to Load Form
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              {(error as Error).message || "This link may be invalid or expired."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted || formData?.status === "completed") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600 dark:text-green-500">
              <CheckCircle2 className="h-5 w-5" />
              Thank You!
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Your answers have been submitted successfully. Our team will review the site information and follow up with you shortly.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const questionsToShow = SITE_READINESS_QUESTIONS.filter(
    q => formData?.questionIds?.includes(q.id)
  );

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>Site Readiness Questionnaire</CardTitle>
                <CardDescription>
                  {formData?.projectName || "Your Project"}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Alert className="mb-6">
              <ClipboardList className="h-4 w-4" />
              <AlertTitle>Help us prepare for your scan</AlertTitle>
              <AlertDescription>
                Please answer the following questions about your site. This information helps us provide an accurate quote and prepare our team for the scan.
              </AlertDescription>
            </Alert>

            <div className="space-y-6">
              {questionsToShow.map((q) => (
                <div key={q.id} className="space-y-2">
                  <Label className="text-base font-medium">{q.question}</Label>
                  {q.pricingImpact && (
                    <p className="text-xs text-muted-foreground">{q.pricingImpact}</p>
                  )}
                  {renderQuestion(q)}
                </div>
              ))}
            </div>

            <div className="mt-8 pt-6 border-t">
              <Button
                onClick={handleSubmit}
                disabled={submitMutation.isPending}
                className="w-full"
                size="lg"
                data-testid="button-submit-site-readiness"
              >
                {submitMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Answers"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
