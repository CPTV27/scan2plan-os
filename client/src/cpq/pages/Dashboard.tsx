import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import QuoteCard from "@/cpq/components/QuoteCard";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Quote } from "@shared/schema";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("all");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: quotes = [], isLoading } = useQuery<Quote[]>({
    queryKey: ["/api", "quotes"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/quotes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api", "quotes"] });
      toast({
        title: "Quote deleted",
        description: "The quote has been successfully deleted.",
      });
    },
    onError: () => {
      toast({
        title: "Error deleting quote",
        description: "Failed to delete the quote. Please try again.",
        variant: "destructive",
      });
    },
  });

  const formattedQuotes = quotes.map((quote) => ({
    id: quote.quoteNumber,
    projectName: quote.projectName,
    clientName: quote.clientName || "N/A",
    totalPrice: parseFloat(quote.totalPrice || "0"),
    dateCreated: new Date(quote.createdAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    type: quote.scopingMode ? ("Scope + Quote" as const) : ("Quote" as const),
    rawId: quote.id,
  }));

  const filteredQuotes = {
    all: formattedQuotes,
    quotes: formattedQuotes.filter((q) => q.type === "Quote"),
    scoped: formattedQuotes.filter((q) => q.type === "Scope + Quote"),
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
            <p className="text-muted-foreground">
              Manage your quotes and scoping projects
            </p>
          </div>
          <Link href="/new-cpq/calculator">
            <Button data-testid="button-new-quote">
              <Plus className="h-4 w-4 mr-2" />
              New Quote
            </Button>
          </Link>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all" data-testid="tab-all">
              All Projects
            </TabsTrigger>
            <TabsTrigger value="quotes" data-testid="tab-quotes">
              Quote Only
            </TabsTrigger>
            <TabsTrigger value="scoped" data-testid="tab-scoped">
              Scope + Quote
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-6">
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Loading quotes...</div>
            ) : filteredQuotes.all.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No quotes found. Create your first quote to get started.
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredQuotes.all.map((quote) => (
                  <QuoteCard
                    key={quote.rawId}
                    {...quote}
                    onView={() => setLocation(`/calculator/${quote.rawId}`)}
                    onExport={() => console.log(`Export ${quote.rawId}`)}
                    onDelete={() => deleteMutation.mutate(quote.rawId)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="quotes" className="mt-6">
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Loading quotes...</div>
            ) : filteredQuotes.quotes.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No quote-only projects found.
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredQuotes.quotes.map((quote) => (
                  <QuoteCard
                    key={quote.rawId}
                    {...quote}
                    onView={() => setLocation(`/calculator/${quote.rawId}`)}
                    onExport={() => console.log(`Export ${quote.rawId}`)}
                    onDelete={() => deleteMutation.mutate(quote.rawId)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="scoped" className="mt-6">
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Loading quotes...</div>
            ) : filteredQuotes.scoped.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No scoped projects found.
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredQuotes.scoped.map((quote) => (
                  <QuoteCard
                    key={quote.rawId}
                    {...quote}
                    onView={() => setLocation(`/calculator/${quote.rawId}`)}
                    onExport={() => console.log(`Export ${quote.rawId}`)}
                    onDelete={() => deleteMutation.mutate(quote.rawId)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}



