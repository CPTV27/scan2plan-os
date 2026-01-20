/**
 * Engagement Tab Component
 * 
 * Displays tracking information for sent proposals:
 * - Email sent history
 * - Open/Click tracking
 * - Timeline of engagement
 */

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
    Mail, ExternalLink, MousePointerClick, Eye,
    Clock, AlertCircle, CheckCircle2, Send
} from "lucide-react";
import type { ProposalEmailEvent } from "@shared/schema";

interface EngagementTabProps {
    leadId: number;
}

export function EngagementTab({ leadId }: EngagementTabProps) {
    const { data: events, isLoading } = useQuery<ProposalEmailEvent[]>({
        queryKey: [`/api/leads/${leadId}/proposal-emails`],
    });

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
            </div>
        );
    }

    if (!events || events.length === 0) {
        return (
            <Card>
                <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                    <Mail className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
                    <h3 className="text-lg font-medium">No Engagement Yet</h3>
                    <p className="text-muted-foreground max-w-sm mt-2">
                        Send a proposal via email to track when clients open and view your quotes.
                    </p>
                </CardContent>
            </Card>
        );
    }

    // Calculate high-level stats
    const totalSent = events.length;
    const uniqueOpens = events.filter(e => e.openCount > 0).length;
    const totalClicks = events.reduce((sum, e) => sum + (e.clickCount || 0), 0);
    const openRate = Math.round((uniqueOpens / totalSent) * 100);

    return (
        <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Open Rate</p>
                                <h3 className="text-2xl font-bold mt-1">{openRate}%</h3>
                            </div>
                            <Eye className="h-8 w-8 text-blue-500 opacity-20" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Total Clicks</p>
                                <h3 className="text-2xl font-bold mt-1">{totalClicks}</h3>
                            </div>
                            <MousePointerClick className="h-8 w-8 text-green-500 opacity-20" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Proposals Sent</p>
                                <h3 className="text-2xl font-bold mt-1">{totalSent}</h3>
                            </div>
                            <Send className="h-8 w-8 text-purple-500 opacity-20" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Timeline */}
            <Card>
                <CardHeader>
                    <CardTitle>Activity Timeline</CardTitle>
                    <CardDescription>Recent tracking events from proposal emails</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-8">
                        {events.map((event, i) => (
                            <div key={event.id} className="relative flex gap-4">
                                {/* Connector Line */}
                                {i !== events.length - 1 && (
                                    <div className="absolute left-5 top-10 bottom-[-32px] w-px bg-border" />
                                )}

                                {/* Icon */}
                                <div className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${event.openCount > 0 ? "bg-blue-100 border-blue-200 text-blue-600" : "bg-muted border-border text-muted-foreground"
                                    }`}>
                                    {event.clickCount > 0 ? (
                                        <MousePointerClick className="h-5 w-5" />
                                    ) : event.openCount > 0 ? (
                                        <Eye className="h-5 w-5" />
                                    ) : (
                                        <Mail className="h-5 w-5" />
                                    )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 space-y-1 pt-1">
                                    <div className="flex items-center justify-between">
                                        <div className="font-semibold text-sm">
                                            {event.subject || "Proposal Sent"}
                                        </div>
                                        <span className="text-xs text-muted-foreground">
                                            {format(new Date(event.sentAt), "MMM d, h:mm a")}
                                        </span>
                                    </div>

                                    <div className="text-sm text-muted-foreground">
                                        To: {event.recipientEmail}
                                    </div>

                                    <div className="flex gap-2 mt-2">
                                        {event.openCount > 0 ? (
                                            <Badge variant="secondary" className="bg-blue-100/50 text-blue-700 hover:bg-blue-100/50 border-blue-200">
                                                <Eye className="h-3 w-3 mr-1" />
                                                Opened {event.openCount}x
                                                {event.lastOpenedAt && ` (Last: ${format(new Date(event.lastOpenedAt), "h:mm a")})`}
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-muted-foreground">
                                                Not opened yet
                                            </Badge>
                                        )}

                                        {event.clickCount > 0 && (
                                            <Badge variant="secondary" className="bg-green-100/50 text-green-700 hover:bg-green-100/50 border-green-200">
                                                <MousePointerClick className="h-3 w-3 mr-1" />
                                                Clicked {event.clickCount}x
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
