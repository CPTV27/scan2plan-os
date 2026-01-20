import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Brain, Send, Loader2, Sparkles, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);

  const queryMutation = useMutation({
    mutationFn: async (question: string) => {
      const res = await apiRequest("POST", "/api/ai/query", { question });
      return res.json();
    },
    onSuccess: (data) => {
      setMessages(prev => [...prev, { role: "assistant", content: data.answer }]);
    },
    onError: () => {
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I couldn't process that request. Please try again." }]);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || queryMutation.isPending) return;

    const question = input.trim();
    setMessages(prev => [...prev, { role: "user", content: question }]);
    setInput("");
    queryMutation.mutate(question);
  };

  const suggestions = [
    "What deals are likely to close this month?",
    "Which leads need follow-up?",
    "What's my total pipeline value?",
    "Show me high-value opportunities",
  ];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2"
          data-testid="button-ai-assistant"
        >
          <Brain className="h-4 w-4" />
          <span className="hidden sm:inline">AI Assistant</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            AI Assistant
          </SheetTitle>
        </SheetHeader>
        
        <div className="flex-1 flex flex-col min-h-0 mt-4">
          <ScrollArea className="flex-1 pr-4">
            {messages.length === 0 ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Ask me anything about your pipeline, deals, or projects. I can help with analysis, insights, and recommendations.
                </p>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">Try asking:</p>
                  {suggestions.map((suggestion, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-left h-auto py-2 text-xs"
                      onClick={() => {
                        setInput(suggestion);
                      }}
                      data-testid={`button-suggestion-${i}`}
                    >
                      <Sparkles className="h-3 w-3 mr-2 flex-shrink-0" />
                      {suggestion}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4 pb-4">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                      data-testid={`message-${msg.role}-${i}`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}
                {queryMutation.isPending && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg px-3 py-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          <form onSubmit={handleSubmit} className="flex gap-2 mt-4 pt-4 border-t">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your pipeline..."
              disabled={queryMutation.isPending}
              data-testid="input-ai-question"
            />
            <Button 
              type="submit" 
              size="icon" 
              disabled={!input.trim() || queryMutation.isPending}
              data-testid="button-send-question"
            >
              {queryMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function AIInsightsWidget() {
  const [insights, setInsights] = useState<Array<{
    type: string;
    title: string;
    description: string;
    dealIds?: number[];
  }>>([]);
  const [hasLoaded, setHasLoaded] = useState(false);

  const insightsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ai/insights", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data) => {
      setInsights(data.insights || []);
      setHasLoaded(true);
    },
  });

  const loadInsights = () => {
    if (!insightsMutation.isPending) {
      insightsMutation.mutate();
    }
  };

  const getTypeStyles = (type: string) => {
    switch (type) {
      case "opportunity":
        return "border-l-green-500 bg-green-500/5";
      case "warning":
        return "border-l-yellow-500 bg-yellow-500/5";
      default:
        return "border-l-blue-500 bg-blue-500/5";
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          AI Insights
        </CardTitle>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={loadInsights}
          disabled={insightsMutation.isPending}
          data-testid="button-load-insights"
        >
          {insightsMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : hasLoaded ? (
            "Refresh"
          ) : (
            "Generate"
          )}
        </Button>
      </CardHeader>
      <CardContent>
        {!hasLoaded ? (
          <p className="text-sm text-muted-foreground">
            Click Generate to get AI-powered insights about your pipeline.
          </p>
        ) : insights.length === 0 ? (
          <p className="text-sm text-muted-foreground">No insights available.</p>
        ) : (
          <div className="space-y-3">
            {insights.map((insight, i) => (
              <div 
                key={i} 
                className={`border-l-2 pl-3 py-1 rounded-r ${getTypeStyles(insight.type)}`}
                data-testid={`insight-${i}`}
              >
                <p className="text-sm font-medium">{insight.title}</p>
                <p className="text-xs text-muted-foreground">{insight.description}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
