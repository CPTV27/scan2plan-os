import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Play, Square, Clock, Briefcase, Wrench, User as UserIcon } from "lucide-react";
import { format, differenceInMinutes } from "date-fns";
import type { TimeLog, Project, RoleType } from "@shared/schema";
import { WORK_TYPES, ROLE_TYPES } from "@shared/schema";

interface TimeTrackerProps {
  projectId?: number;
  onTimeLogged?: (log: TimeLog) => void;
}

const HOURLY_COSTS: Record<RoleType, number> = {
  tech: 45,
  admin: 75,
  sales: 85,
};

export function TimeTracker({ projectId, onTimeLogged }: TimeTrackerProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [clockInTime, setClockInTime] = useState<Date | null>(null);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const [workType, setWorkType] = useState<string>("Scanning");
  const [roleType, setRoleType] = useState<RoleType>("tech");
  const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>(projectId);

  const isAdmin = user?.role === "ceo";

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: !projectId,
  });

  const activeProjects = projects?.filter(p => 
    p.status !== "Delivered" && p.status !== "Cancelled"
  ) || [];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isClockedIn && clockInTime) {
      interval = setInterval(() => {
        setElapsedMinutes(differenceInMinutes(new Date(), clockInTime));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isClockedIn, clockInTime]);

  const clockInMutation = useMutation({
    mutationFn: async () => {
      const now = new Date();
      setClockInTime(now);
      setIsClockedIn(true);
      return now;
    },
    onSuccess: () => {
      toast({
        title: "Clocked In",
        description: `Started tracking as ${roleType === "admin" ? "Admin Mode" : roleType === "tech" ? "Field Mode" : "Sales Mode"}`,
      });
    },
  });

  const clockOutMutation = useMutation({
    mutationFn: async () => {
      if (!clockInTime || !selectedProjectId) {
        throw new Error("No active clock-in session or project selected");
      }

      const departureTime = new Date();
      const totalMinutes = differenceInMinutes(departureTime, clockInTime);
      const hourlyCost = HOURLY_COSTS[roleType];

      const response = await apiRequest("POST", "/api/time-logs", {
        projectId: selectedProjectId,
        techId: user?.id || "unknown",
        arrivalTime: clockInTime.toISOString(),
        departureTime: departureTime.toISOString(),
        totalSiteMinutes: totalMinutes,
        type: "Manual",
        workType,
        roleType,
        hourlyCost: String(hourlyCost),
      });

      return response.json();
    },
    onSuccess: (data) => {
      setIsClockedIn(false);
      setClockInTime(null);
      setElapsedMinutes(0);
      queryClient.invalidateQueries({ queryKey: ["/api/time-logs"] });
      if (onTimeLogged) {
        onTimeLogged(data);
      }
      toast({
        title: "Clocked Out",
        description: `Logged ${elapsedMinutes} minutes as ${roleType}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const formatElapsed = (minutes: number) => {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hrs}h ${mins}m`;
  };

  const getRoleIcon = (role: RoleType) => {
    switch (role) {
      case "tech":
        return <Wrench className="w-4 h-4" />;
      case "admin":
        return <Briefcase className="w-4 h-4" />;
      case "sales":
        return <UserIcon className="w-4 h-4" />;
    }
  };

  const getRoleBadgeVariant = (role: RoleType) => {
    switch (role) {
      case "tech":
        return "default";
      case "admin":
        return "secondary";
      case "sales":
        return "outline";
    }
  };

  return (
    <Card data-testid="card-time-tracker">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Time Tracker
        </CardTitle>
        <Badge variant={getRoleBadgeVariant(roleType)} className="gap-1">
          {getRoleIcon(roleType)}
          {roleType === "admin" ? "Admin Mode" : roleType === "tech" ? "Field Mode" : "Sales Mode"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {isAdmin && (
          <div className="flex items-center justify-between gap-4 p-3 rounded-md bg-muted/50">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-muted-foreground" />
              <Label htmlFor="role-toggle" className="text-sm">Field Mode</Label>
            </div>
            <Switch
              id="role-toggle"
              data-testid="switch-role-toggle"
              checked={roleType === "admin"}
              onCheckedChange={(checked) => setRoleType(checked ? "admin" : "tech")}
              disabled={isClockedIn}
            />
            <div className="flex items-center gap-2">
              <Label htmlFor="role-toggle" className="text-sm">Admin Mode</Label>
              <Briefcase className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        )}

        {!projectId && (
          <div className="space-y-2">
            <Label>Project</Label>
            <Select
              value={selectedProjectId?.toString()}
              onValueChange={(v) => setSelectedProjectId(parseInt(v))}
              disabled={isClockedIn}
            >
              <SelectTrigger data-testid="select-project">
                <SelectValue placeholder="Select project..." />
              </SelectTrigger>
              <SelectContent>
                {activeProjects.map((project) => (
                  <SelectItem key={project.id} value={project.id.toString()}>
                    {project.name || `Project #${project.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label>Work Type</Label>
          <Select
            value={workType}
            onValueChange={setWorkType}
            disabled={isClockedIn}
          >
            <SelectTrigger data-testid="select-work-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WORK_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isClockedIn && clockInTime && (
          <div className="text-center py-4 space-y-2">
            <div className="text-3xl font-mono font-bold" data-testid="text-elapsed-time">
              {formatElapsed(elapsedMinutes)}
            </div>
            <div className="text-sm text-muted-foreground">
              Started at {format(clockInTime, "h:mm a")}
            </div>
            <div className="text-xs text-muted-foreground">
              Rate: ${HOURLY_COSTS[roleType]}/hr ({roleType})
            </div>
          </div>
        )}

        <div className="flex gap-2">
          {!isClockedIn ? (
            <Button
              className="flex-1"
              onClick={() => clockInMutation.mutate()}
              disabled={!selectedProjectId}
              data-testid="button-clock-in"
            >
              <Play className="w-4 h-4 mr-2" />
              Clock In
            </Button>
          ) : (
            <Button
              className="flex-1"
              variant="destructive"
              onClick={() => clockOutMutation.mutate()}
              disabled={clockOutMutation.isPending}
              data-testid="button-clock-out"
            >
              <Square className="w-4 h-4 mr-2" />
              Clock Out
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
