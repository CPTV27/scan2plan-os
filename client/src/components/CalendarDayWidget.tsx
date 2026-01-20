import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Calendar, 
  RefreshCw, 
  Loader2, 
  ExternalLink,
  Clock,
  MapPin,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { format, parseISO, isToday, isSameDay, addDays, subDays } from "date-fns";
import { useState } from "react";

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  htmlLink: string;
}

function formatTime(startStr: string, endStr: string) {
  try {
    const start = parseISO(startStr);
    const end = parseISO(endStr);
    return `${format(start, "h:mm a")} - ${format(end, "h:mm a")}`;
  } catch {
    return startStr;
  }
}

function getDuration(startStr: string, endStr: string): string {
  try {
    const start = parseISO(startStr);
    const end = parseISO(endStr);
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.round(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  } catch {
    return "";
  }
}

export function CalendarDayWidget() {
  const [selectedDate, setSelectedDate] = useState(new Date());

  const { data: calendarData, isLoading, refetch, isFetching } = useQuery<{ events: CalendarEvent[] }>({
    queryKey: ["/api/google/calendar/events"],
    staleTime: 5 * 60 * 1000,
  });

  const todaysEvents = calendarData?.events?.filter(event => {
    try {
      const eventDate = parseISO(event.start);
      return isSameDay(eventDate, selectedDate);
    } catch {
      return false;
    }
  }) || [];

  const sortedEvents = [...todaysEvents].sort((a, b) => {
    try {
      return parseISO(a.start).getTime() - parseISO(b.start).getTime();
    } catch {
      return 0;
    }
  });

  const goToPrevDay = () => setSelectedDate(prev => subDays(prev, 1));
  const goToNextDay = () => setSelectedDate(prev => addDays(prev, 1));
  const goToToday = () => setSelectedDate(new Date());

  const isViewingToday = isToday(selectedDate);

  return (
    <Card className="border-border shadow-md">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-blue-500/10">
            <Calendar className="h-4 w-4 text-blue-500" />
          </div>
          Calendar
        </CardTitle>
        <div className="flex items-center gap-1">
          {!isViewingToday && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={goToToday}
              className="text-xs h-7 px-2"
              data-testid="button-calendar-today"
            >
              Today
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="icon"
            className="h-7 w-7"
            onClick={goToPrevDay}
            data-testid="button-calendar-prev"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            className="h-7 w-7"
            onClick={goToNextDay}
            data-testid="button-calendar-next"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            className="h-7 w-7"
            onClick={() => refetch()}
            disabled={isFetching}
            data-testid="button-refresh-calendar"
          >
            {isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-lg font-semibold">
              {isViewingToday ? "Today" : format(selectedDate, "EEEE")}
            </p>
            <p className="text-sm text-muted-foreground">{format(selectedDate, "MMMM d, yyyy")}</p>
          </div>
          <Badge variant="outline" className="text-xs">
            {sortedEvents.length} {sortedEvents.length === 1 ? "meeting" : "meetings"}
          </Badge>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : sortedEvents.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No meetings scheduled</p>
          </div>
        ) : (
          <ScrollArea className="h-[280px] pr-2">
            <div className="space-y-2">
              {sortedEvents.map((event) => (
                <a
                  key={event.id}
                  href={event.htmlLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-3 rounded-lg bg-secondary/30 hover-elevate transition-all group"
                  data-testid={`event-item-${event.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                        {event.summary || "Untitled Event"}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3 flex-shrink-0" />
                        <span>{formatTime(event.start, event.end)}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                          {getDuration(event.start, event.end)}
                        </Badge>
                      </div>
                      {event.location && (
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{event.location}</span>
                        </div>
                      )}
                    </div>
                    <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
                  </div>
                </a>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
