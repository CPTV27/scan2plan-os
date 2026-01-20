import { useProjects, useCreateProject, useUpdateProject } from "@/hooks/use-projects";
import { Sidebar, MobileHeader } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Plus, Check, Scan, Layers, Box, ClipboardCheck, Package, CalendarClock, MapPin, Building2, Users, Truck, AlertTriangle, FileText, Phone, Mail, User, HelpCircle, ScrollText, Camera, Plane, Settings2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ProjectCard } from "@/components/ProjectCard";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertProjectSchema } from "@shared/schema";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useMemo } from "react";
import type { Project, Lead, CpqArea, CpqScopingData, CpqTravel, Scantech } from "@shared/schema";
import { CPQ_BUILDING_TYPES, CPQ_SERVICES } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LocationPreview } from "@/components/LocationPreview";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ProjectFinancials } from "@/components/ProjectFinancials";
import { DeliveryPortal } from "@/components/delivery/DeliveryPortal";

const COLUMNS = [
  { id: "Scheduling", title: "Scheduling", icon: CalendarClock },
  { id: "Scanning", title: "Scanning", icon: Scan },
  { id: "Registration", title: "Registration", icon: Layers },
  { id: "Modeling", title: "Modeling", icon: Box },
  { id: "QC", title: "Quality Control", icon: ClipboardCheck },
  { id: "Delivered", title: "Delivered", icon: Package },
];

const COLUMN_ORDER = COLUMNS.map(c => c.id);

function getNextStatus(current: string): string | null {
  const idx = COLUMN_ORDER.indexOf(current);
  if (idx < 0 || idx >= COLUMN_ORDER.length - 1) return null;
  return COLUMN_ORDER[idx + 1];
}

const formSchema = insertProjectSchema;
type FormData = z.infer<typeof formSchema>;

export default function Production() {
  const { data: projects, isLoading } = useProjects();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // Group projects by status
  const groupedProjects = COLUMNS.reduce((acc, col) => {
    acc[col.id] = projects?.filter(p => p.status === col.id) || [];
    return acc;
  }, {} as Record<string, Project[]>);

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      
      <div className="flex-1 flex flex-col min-w-0">
        <MobileHeader />
        <main className="flex-1 flex flex-col h-full overflow-hidden">
          <header className="p-4 md:p-8 border-b border-border bg-card/50 backdrop-blur-sm shrink-0">
          <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-4">
            <div>
              <h2 className="text-2xl md:text-3xl font-display font-bold">Production Tracker</h2>
              <p className="text-muted-foreground mt-1 text-sm md:text-base">Monitor project status from scanning to delivery.</p>
            </div>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" data-testid="button-production-help">
                    <HelpCircle className="w-5 h-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="end">
                  <div className="space-y-3">
                    <h4 className="font-semibold">Digital Twin Viewer</h4>
                    <p className="text-sm text-muted-foreground">
                      Projects in QC, Modeling, or Delivered stages can generate a Digital Twin view from point cloud data.
                    </p>
                    <div className="text-sm space-y-2">
                      <p className="font-medium">How to use:</p>
                      <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                        <li>Find a project in QC, Modeling, or Delivered</li>
                        <li>Look for the "Digital Twin Viewer" section</li>
                        <li>Click "Generate Point Cloud" to start</li>
                        <li>Wait for processing (button shows status)</li>
                        <li>Click "View Digital Twin" when ready</li>
                      </ol>
                    </div>
                    <p className="text-xs text-muted-foreground border-t pt-2">
                      Note: Project must have storage configured (Drive folder or GCS path) before conversion.
                    </p>
                  </div>
                </PopoverContent>
              </Popover>
              <Button onClick={() => setIsCreateOpen(true)} className="shadow-lg shadow-primary/25" data-testid="button-new-project">
                <Plus className="w-5 h-5 mr-2" /> New Project
              </Button>
            </div>
          </div>
        </header>

        {/* Mobile Field Mode - List View */}
        <div className="md:hidden flex-1 overflow-y-auto p-4">
          <MobileFieldView 
            projects={projects || []} 
            isLoading={isLoading}
            onEdit={setEditingProject}
          />
        </div>

        {/* Desktop Kanban View */}
        <div className="hidden md:flex flex-1 overflow-x-auto p-8">
          <div className="flex gap-6 h-full min-w-[1200px]">
            {COLUMNS.map(col => (
              <div key={col.id} className="flex-1 flex flex-col min-w-[280px]">
                <div className="flex items-center justify-between mb-4 px-1">
                  <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
                    {col.title}
                  </h3>
                  <span className="bg-secondary text-secondary-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                    {groupedProjects[col.id]?.length || 0}
                  </span>
                </div>
                
                <div className="flex-1 bg-secondary/20 rounded-xl p-3 border border-border/50 space-y-3 overflow-y-auto custom-scrollbar">
                  {isLoading ? (
                    <div className="h-20 bg-card/50 animate-pulse rounded-lg" />
                  ) : (
                    groupedProjects[col.id]?.map(project => (
                      <ProjectCard 
                        key={project.id} 
                        project={project} 
                        onEdit={setEditingProject}
                      />
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
          </div>
        </main>

        <ProjectDialog 
          open={isCreateOpen} 
          onOpenChange={setIsCreateOpen} 
          onSuccess={() => setIsCreateOpen(false)}
        />

        <ProjectDialog 
          project={editingProject} 
          open={!!editingProject} 
          onOpenChange={(open) => !open && setEditingProject(null)} 
          onSuccess={() => setEditingProject(null)}
        />
      </div>
    </div>
  );
}

// Reusable Project Form Dialog
function ProjectDialog({ 
  project, 
  open, 
  onOpenChange,
  onSuccess 
}: { 
  project?: Project | null, 
  open: boolean, 
  onOpenChange: (open: boolean) => void,
  onSuccess?: () => void 
}) {
  const { toast } = useToast();
  const createMutation = useCreateProject();
  const updateMutation = useUpdateProject();
  const [activeTab, setActiveTab] = useState("details");

  // Fetch linked lead for address/location data
  const { data: linkedLead } = useQuery<Lead>({
    queryKey: ['/api/leads', project?.leadId],
    enabled: !!project?.leadId,
  });

  // Fetch scantechs for assignment dropdown
  const { data: scantechs } = useQuery<Scantech[]>({
    queryKey: ['/api/scantechs'],
  });

  // Reset tab to details when dialog opens
  useEffect(() => {
    if (open) {
      setActiveTab("details");
    }
  }, [open]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      status: "Scanning",
      priority: "Medium",
      progress: 0,
      bValidationStatus: "pending",
      cValidationStatus: "pending",
      billingAdjustmentApproved: false,
      scannerType: "trimble_x7",
      matterportRequired: false,
      droneRequired: false,
      extensionTripodNeeded: false,
    },
  });

  // Reset form when project changes
  useEffect(() => {
    if (project && open) {
      form.reset({
        name: project.name,
        status: project.status,
        priority: project.priority,
        progress: project.progress || 0,
        dueDate: project.dueDate ? new Date(project.dueDate) : undefined,
        bValidationStatus: (project.bValidationStatus as "pending" | "passed" | "failed" | "waived") || "pending",
        cValidationStatus: (project.cValidationStatus as "pending" | "passed" | "failed" | "waived") || "pending",
        registrationRms: project.registrationRms ? Number(project.registrationRms) : undefined,
        assignedTechId: project.assignedTechId || undefined,
        billingAdjustmentApproved: project.billingAdjustmentApproved || false,
        scannerType: (project.scannerType as "trimble_x7" | "navvis_slam") || "trimble_x7",
        matterportRequired: project.matterportRequired || false,
        droneRequired: project.droneRequired || false,
        extensionTripodNeeded: project.extensionTripodNeeded || false,
      });
    }
  }, [project?.id, open]);

  async function onSubmit(data: FormData) {
    try {
      if (project) {
        await updateMutation.mutateAsync({ id: project.id, ...data });
        toast({ title: "Success", description: "Project updated" });
      } else {
        await createMutation.mutateAsync(data);
        toast({ title: "Success", description: "Project created" });
      }
      onSuccess?.();
    } catch (error: any) {
      const gateType = error?.gateType;
      let title = "Error";
      let description = error?.message || "Failed to save project";
      
      if (gateType === "RETAINER_REQUIRED") {
        title = "Retainer Payment Required";
      } else if (gateType === "QC_VALIDATION_REQUIRED") {
        title = "QC Validation Required";
      } else if (gateType === "QC_RMS_EXCEEDED") {
        title = "Registration RMS Exceeded";
      } else if (gateType === "SQFT_AUDIT_REQUIRED") {
        title = "Square Foot Audit Required";
      } else if (gateType === "PAYMENT_REQUIRED") {
        title = "Payment Required";
      }
      
      toast({ 
        title, 
        description, 
        variant: "destructive" 
      });
    }
  }

  const projectAddress = linkedLead?.projectAddress;

  // Render form fields as a reusable component
  const renderFormFields = () => (
    <>
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Project Name</FormLabel>
            <FormControl>
              <Input placeholder="Site Scan - Building A" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {COLUMNS.map(col => (
                    <SelectItem key={col.id} value={col.id}>{col.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="priority"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Priority</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value || "Medium"}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="assignedTechId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Assigned ScanTech</FormLabel>
            <Select 
              onValueChange={(val) => field.onChange(val === "unassigned" ? null : parseInt(val))} 
              value={field.value?.toString() || "unassigned"}
            >
              <FormControl>
                <SelectTrigger data-testid="select-assigned-tech">
                  <User className="w-4 h-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Select technician" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {scantechs?.filter(t => t.isActive).map(tech => (
                  <SelectItem key={tech.id} value={tech.id.toString()}>
                    {tech.name} ({tech.baseLocation}){tech.canDoTravel && " - Travel OK"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="progress"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Progress (%)</FormLabel>
            <FormControl>
              <Input type="number" min="0" max="100" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {(form.watch("status") === "Registration" || form.watch("status") === "Modeling" || project?.status === "Registration" || project?.status === "Modeling") && (
        <div className="border-t border-border pt-4 mt-4">
          <h4 className="text-sm font-semibold mb-3 text-muted-foreground">QC Validation (LoA 40 Compliance)</h4>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="bValidationStatus"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>B-Validation</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value || "pending"}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="B-Val Status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="passed">Passed</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="waived">Waived</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="cValidationStatus"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>C-Validation</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value || "pending"}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="C-Val Status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="passed">Passed</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="waived">Waived</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="registrationRms"
            render={({ field }) => (
              <FormItem className="mt-3">
                <FormLabel>Registration RMS (inches)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.001" min="0" placeholder="0.125" {...field} />
                </FormControl>
                <p className="text-xs text-muted-foreground mt-1">LoA 40 requires RMS ≤ 0.125" (0-1/8")</p>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}

      {/* SQUARE FOOT AUDIT Gate - Show if variance >10% */}
      {project?.sqftVariance && Math.abs(Number(project.sqftVariance)) > 10 && (
        <div className="border-t border-border pt-4 mt-4">
          <h4 className="text-sm font-semibold mb-3 text-orange-500 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Square Foot Audit Required
          </h4>
          <div className="p-3 bg-orange-500/10 rounded-md border border-orange-500/30 mb-3">
            <p className="text-xs text-muted-foreground">
              Scanned area {Number(project.sqftVariance) > 0 ? "exceeds" : "is below"} estimate by {Math.abs(Number(project.sqftVariance)).toFixed(1)}%.
              {project.estimatedSqft && project.actualSqft && (
                <span className="block mt-1">Est: {project.estimatedSqft.toLocaleString()} sqft | Actual: {project.actualSqft.toLocaleString()} sqft</span>
              )}
            </p>
          </div>
          <FormField
            control={form.control}
            name="billingAdjustmentApproved"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    data-testid="checkbox-billing-adjustment"
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className="text-sm font-medium">
                    Billing Adjustment Approved
                  </FormLabel>
                  <p className="text-xs text-muted-foreground">
                    Sales or Accounting has confirmed billing adjustment for the square footage variance. Required before Modeling.
                  </p>
                </div>
              </FormItem>
            )}
          />
        </div>
      )}

      <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>
        {createMutation.isPending || updateMutation.isPending ? "Saving..." : project ? "Save Changes" : "Create Project"}
      </Button>
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle>{project ? "Edit Project" : "New Project"}</DialogTitle>
              {projectAddress && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <MapPin className="w-4 h-4" />
                  <span>{projectAddress}</span>
                </div>
              )}
            </div>
            {project && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.open(`/projects/${project.id}/mission-brief`, '_blank')}
                data-testid={`button-mission-brief-${project.id}`}
              >
                <ScrollText className="w-4 h-4 mr-2" />
                Mission Brief
              </Button>
            )}
          </div>
        </DialogHeader>
        
        {project && projectAddress ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-7">
              <TabsTrigger value="details" data-testid="tab-project-details">Details</TabsTrigger>
              <TabsTrigger value="quoted" data-testid="tab-project-quoted">Quoted Scope</TabsTrigger>
              <TabsTrigger value="equipment" data-testid="tab-project-equipment">Equipment</TabsTrigger>
              <TabsTrigger value="scheduling" data-testid="tab-project-scheduling">Scheduling</TabsTrigger>
              <TabsTrigger value="financials" data-testid="tab-project-financials">Financials</TabsTrigger>
              <TabsTrigger value="location" data-testid="tab-project-location">Location</TabsTrigger>
              <TabsTrigger value="delivery" data-testid="tab-project-delivery">Delivery</TabsTrigger>
            </TabsList>
            
            <TabsContent value="details" className="mt-4">
              <ScrollArea className="max-h-[60vh]">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pr-4">
                    {renderFormFields()}
                  </form>
                </Form>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="quoted" className="mt-4">
              <ScrollArea className="max-h-[60vh]">
                <QuotedScopeDetails project={project} />
              </ScrollArea>
            </TabsContent>

            <TabsContent value="equipment" className="mt-4">
              <ScrollArea className="max-h-[60vh]">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pr-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Settings2 className="w-4 h-4" />
                          Field Equipment Configuration
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <FormField
                          control={form.control}
                          name="scannerType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Primary Scanner</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value || "trimble_x7"}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-scanner-type">
                                    <Scan className="w-4 h-4 mr-2 text-muted-foreground" />
                                    <SelectValue placeholder="Select scanner" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="trimble_x7">Trimble X7</SelectItem>
                                  <SelectItem value="navvis_slam">NavVis SLAM</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <Separator />

                        <div className="space-y-4">
                          <FormField
                            control={form.control}
                            name="matterportRequired"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    data-testid="checkbox-matterport"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm font-medium flex items-center gap-2">
                                    <Camera className="w-4 h-4 text-muted-foreground" />
                                    Matterport Virtual Tour
                                  </FormLabel>
                                  <p className="text-xs text-muted-foreground">
                                    Capture 360° imagery for virtual walkthroughs
                                  </p>
                                </div>
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="droneRequired"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    data-testid="checkbox-drone"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm font-medium flex items-center gap-2">
                                    <Plane className="w-4 h-4 text-muted-foreground" />
                                    Drone Capture
                                  </FormLabel>
                                  <p className="text-xs text-muted-foreground">
                                    Aerial imagery for rooftop/exterior documentation
                                  </p>
                                </div>
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="extensionTripodNeeded"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    data-testid="checkbox-extension-tripod"
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm font-medium flex items-center gap-2">
                                    <Layers className="w-4 h-4 text-muted-foreground" />
                                    Extension Tripod
                                  </FormLabel>
                                  <p className="text-xs text-muted-foreground">
                                    High-reach tripod for elevated scan positions
                                  </p>
                                </div>
                              </FormItem>
                            )}
                          />
                        </div>
                      </CardContent>
                    </Card>

                    <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
                      {updateMutation.isPending ? "Saving..." : "Save Equipment Configuration"}
                    </Button>
                  </form>
                </Form>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="scheduling" className="mt-4">
              <ScrollArea className="max-h-[60vh]">
                <SchedulingPanel project={project} technicianId={project.assignedTechId} projectAddress={linkedLead?.projectAddress} />
              </ScrollArea>
            </TabsContent>

            <TabsContent value="financials" className="mt-4">
              <ScrollArea className="max-h-[60vh]">
                <ProjectFinancials projectId={project.id} />
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="location" className="mt-4">
              <ScrollArea className="max-h-[60vh]">
                <LocationPreview 
                  address={projectAddress} 
                  companyName={linkedLead?.clientName}
                  buildingType={linkedLead?.buildingType || undefined}
                />
              </ScrollArea>
            </TabsContent>

            <TabsContent value="delivery" className="mt-4">
              <ScrollArea className="max-h-[60vh]">
                <DeliveryPortal 
                  projectId={project.id} 
                  universalProjectId={project.universalProjectId || undefined}
                />
              </ScrollArea>
            </TabsContent>
          </Tabs>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {renderFormFields()}
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Use shared schema constants for building types
const BUILDING_TYPE_LABELS: Record<string, string> = CPQ_BUILDING_TYPES;

// Discipline Labels
const DISCIPLINE_LABELS: Record<string, string> = {
  arch: "Architectural",
  struct: "Structural",
  mech: "Mechanical",
  elec: "Electrical",
  plumb: "Plumbing",
  site: "Site/Civil",
};

// Risk Labels
const RISK_LABELS: Record<string, string> = {
  remote: "Remote Location",
  fastTrack: "Fast Track / Rush",
  revisions: "High Revision Risk",
  coordination: "Multi-party Coordination",
  incomplete: "Incomplete Access",
  difficult: "Difficult Site Access",
  multiPhase: "Multi-Phase Project",
  unionSite: "Union Site",
  security: "Security Requirements",
};

// Travel Mode Labels (matches TRAVEL_MODES in schema: local, regional, flyout)
const TRAVEL_MODE_LABELS: Record<string, string> = {
  local: "NYC/LI Local",
  regional: "Greater Northeast (Truck)",
  flyout: "Fly-out Job",
};

// Service Labels
const SERVICE_LABELS: Record<string, string> = {
  matterport: "Matterport Virtual Tour",
};

// Site Readiness Question Labels
const SITE_READINESS_LABELS: Record<string, string> = {
  buildingOccupied: "Building Occupied",
  occupancyStatus: "Occupancy Status",
  accessRestrictions: "Access Restrictions",
  temporaryStructures: "Temporary Structures",
  hasBasement: "Has Basement",
  hasAttic: "Has Attic",
  ceilingType: "Ceiling Type",
  hazardousMaterials: "Hazardous Materials",
  parkingAvailability: "Parking Availability",
  existingDrawings: "Existing Drawings",
  additionalNotes: "Additional Notes",
};

// Quoted Scope Details Component - Shows snapshot of what was sold at close
function QuotedScopeDetails({ project }: { project: Project }) {
  const { toast } = useToast();
  
  // Fetch linked lead for fallback scope data
  const { data: linkedLead, isLoading: leadLoading } = useQuery<Lead>({
    queryKey: [`/api/leads/${project.leadId}`],
    enabled: !!project.leadId,
  });
  
  // Sync scope mutation
  const syncScopeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/projects/${project.id}/sync-scope`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({ title: "Success", description: "Scope data synced from deal" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to sync scope", variant: "destructive" });
    },
  });
  
  // Use project data first, fall back to linked lead data
  const projectAreas = (project.quotedAreas as any[]) || [];
  const leadAreas = (linkedLead?.cpqAreas as any[]) || [];
  const areas = projectAreas.length > 0 ? projectAreas : leadAreas;
  
  const risksRaw = project.quotedRisks || linkedLead?.cpqRisks;
  const risks: string[] = Array.isArray(risksRaw) ? risksRaw : [];
  
  const travel = (project.quotedTravel as CpqTravel | null) || (linkedLead?.cpqTravel as CpqTravel | null) || null;
  const services = (project.quotedServices as Record<string, number> | null) || (linkedLead?.cpqServices as Record<string, number> | null) || null;
  const siteReadiness = (project.siteReadiness as Record<string, any>) || (linkedLead?.siteReadiness as Record<string, any>) || {};
  
  // Use linked lead values as fallback for price/margin
  const quotedPrice = project.quotedPrice || linkedLead?.value?.toString();
  const quotedMargin = project.quotedMargin;
  const dispatchLocation = project.dispatchLocation || linkedLead?.dispatchLocation;
  const scopeSummary = project.scopeSummary;

  const hasQuotedData = areas.length > 0 || quotedPrice || scopeSummary;
  const isUsingLeadFallback = projectAreas.length === 0 && leadAreas.length > 0;

  if (leadLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
        <p>Loading scope data...</p>
      </div>
    );
  }

  if (!hasQuotedData) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No quoted scope data available.</p>
        <p className="text-sm mt-1">This project was created before quote inheritance was enabled.</p>
        {project.leadId && (
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-4"
            onClick={() => syncScopeMutation.mutate()}
            disabled={syncScopeMutation.isPending}
            data-testid="button-sync-scope-empty"
          >
            {syncScopeMutation.isPending ? "Syncing..." : "Sync from Deal"}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 pr-4">
      {isUsingLeadFallback && (
        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="pt-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm">Showing scope from linked deal. Click to save permanently.</span>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => syncScopeMutation.mutate()}
              disabled={syncScopeMutation.isPending}
              data-testid="button-sync-scope"
            >
              {syncScopeMutation.isPending ? "Syncing..." : "Save to Project"}
            </Button>
          </CardContent>
        </Card>
      )}

      {scopeSummary && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-4">
            <p className="text-sm text-primary font-medium">{scopeSummary}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Quoted Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between py-2 border-b">
            <span className="text-muted-foreground">Quoted Price</span>
            <span className="font-semibold text-lg">${Number(quotedPrice || 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span className="text-muted-foreground">Quoted Margin</span>
            <span className="font-semibold">{Number(quotedMargin || 0).toFixed(1)}%</span>
          </div>
          {dispatchLocation && (
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Dispatch Location</span>
              <span>{dispatchLocation}{project.distance ? ` (${project.distance} mi)` : ""}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="w-4 h-4" />
            Client Contact (at close)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Client:</span>
              <p className="font-medium">{project.clientName || "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Address:</span>
              <p className="font-medium">{project.projectAddress || "—"}</p>
            </div>
          </div>
          {(project.clientContact || project.clientEmail || project.clientPhone) && (
            <>
              <Separator className="my-2" />
              <div className="grid grid-cols-1 gap-2 text-sm">
                {project.clientContact && (
                  <div className="flex items-center gap-2">
                    <User className="w-3 h-3 text-muted-foreground" />
                    <span>{project.clientContact}</span>
                  </div>
                )}
                {project.clientEmail && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-3 h-3 text-muted-foreground" />
                    <span>{project.clientEmail}</span>
                  </div>
                )}
                {project.clientPhone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3 h-3 text-muted-foreground" />
                    <span>{project.clientPhone}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {areas.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Quoted Areas ({areas.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {areas.map((area, index) => (
              <div key={index} className="p-3 rounded-lg bg-muted/50 space-y-2">
                <div className="flex justify-between items-center">
                  <h5 className="font-medium text-sm">{area.name || `Area ${index + 1}`}</h5>
                  <Badge variant="secondary">{area.squareFeet?.toLocaleString() || 0} sqft</Badge>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>Building Type: {BUILDING_TYPE_LABELS[area.buildingType?.toString()] || `Type ${area.buildingType}`}</div>
                  <div>LOD: {area.mixedInteriorLod || area.mixedExteriorLod || (area.disciplineLods ? Object.values(area.disciplineLods)[0] : null) || "—"} | Scope: {area.scope || "—"}</div>
                  {area.disciplines && area.disciplines.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {area.disciplines.map((d: string) => (
                        <Badge key={d} variant="outline" className="text-xs py-0">
                          {DISCIPLINE_LABELS[d] || d}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {risks.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Risk Factors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {risks.map((risk) => (
                <Badge key={risk} variant="destructive" className="text-xs">
                  {RISK_LABELS[risk] || risk}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {travel && travel.travelMode && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Truck className="w-4 h-4" />
              Travel Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Mode:</span>
              <span>{TRAVEL_MODE_LABELS[travel.travelMode] || travel.travelMode}</span>
            </div>
            {travel.distance !== undefined && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Distance:</span>
                <span>{travel.distance} miles</span>
              </div>
            )}
            {travel.perDiem !== undefined && travel.perDiem > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Per Diem:</span>
                <span>${travel.perDiem.toLocaleString()}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {services && Object.keys(services).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="w-4 h-4" />
              Add-on Services
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(services).map(([service, quantity]) => (
                <div key={service} className="flex justify-between text-sm">
                  <span>{SERVICE_LABELS[service] || service}</span>
                  <span className="text-muted-foreground">x{quantity}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {siteReadiness && Object.keys(siteReadiness).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4" />
              Site Readiness
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(siteReadiness).map(([key, value]) => {
              if (key === "internal" || key === "client") {
                const segment = value as Record<string, any>;
                return Object.entries(segment || {}).map(([qKey, qVal]) => (
                  <div key={`${key}-${qKey}`} className="flex justify-between text-sm py-1 border-b last:border-b-0">
                    <span className="text-muted-foreground">{SITE_READINESS_LABELS[qKey] || qKey}</span>
                    <span className="font-medium">
                      {typeof qVal === "boolean" ? (qVal ? "Yes" : "No") : String(qVal)}
                    </span>
                  </div>
                ));
              }
              return (
                <div key={key} className="flex justify-between text-sm py-1 border-b last:border-b-0">
                  <span className="text-muted-foreground">{SITE_READINESS_LABELS[key] || key}</span>
                  <span className="font-medium">
                    {typeof value === "boolean" ? (value ? "Yes" : "No") : String(value)}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Scheduling Panel Component - Schedule scan appointments
function SchedulingPanel({ project, technicianId, projectAddress }: { project: Project; technicianId: number | null | undefined; projectAddress?: string | null }) {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    project.scanDate ? new Date(project.scanDate) : undefined
  );
  const [selectedTime, setSelectedTime] = useState<string>("09:00");
  const [duration, setDuration] = useState<string>("4");
  
  const { data: scantechs } = useQuery<Scantech[]>({
    queryKey: ['/api/scantechs'],
  });

  const technician = scantechs?.find(t => t.id === technicianId);
  
  const scheduleMutation = useMutation({
    mutationFn: async (data: { scheduledStart: string; duration: number }) => {
      const res = await apiRequest("POST", `/api/projects/${project.id}/schedule`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Scan scheduled", description: "Calendar invite sent to technician." });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
    },
    onError: (error: Error) => {
      toast({ title: "Scheduling failed", description: error.message, variant: "destructive" });
    },
  });

  const handleSchedule = () => {
    if (!projectAddress) {
      toast({ title: "Address required", description: "Please add a project address in the Sales module first.", variant: "destructive" });
      return;
    }
    if (!selectedDate) {
      toast({ title: "Select a date", description: "Please select a date for the scan.", variant: "destructive" });
      return;
    }
    if (!technicianId) {
      toast({ title: "No technician assigned", description: "Please assign a technician first.", variant: "destructive" });
      return;
    }

    const [hours, minutes] = selectedTime.split(':').map(Number);
    const scheduledStart = new Date(selectedDate);
    scheduledStart.setHours(hours, minutes, 0, 0);

    scheduleMutation.mutate({
      scheduledStart: scheduledStart.toISOString(),
      duration: parseInt(duration),
    });
  };
  
  const canSchedule = Boolean(projectAddress && technicianId && selectedDate);

  return (
    <div className="space-y-4 pr-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <CalendarClock className="w-4 h-4" />
            Schedule Scan Appointment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!projectAddress ? (
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <MapPin className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
              <p className="text-sm text-muted-foreground">
                Project address is required for scheduling. Please add an address to the lead in the Sales module.
              </p>
            </div>
          ) : !technicianId ? (
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
              <p className="text-sm text-muted-foreground">
                No technician assigned. Please assign a ScanTech in the Details tab before scheduling.
              </p>
            </div>
          ) : (
            <>
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Assigned: {technician?.name || 'Loading...'}</span>
                </div>
                {technician?.baseLocation && (
                  <p className="text-xs text-muted-foreground mt-1 ml-6">{technician.baseLocation}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                        data-testid="button-select-date"
                      >
                        <CalendarClock className="mr-2 h-4 w-4" />
                        {selectedDate ? selectedDate.toLocaleDateString() : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Time</label>
                  <Select value={selectedTime} onValueChange={setSelectedTime}>
                    <SelectTrigger data-testid="select-time">
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="06:00">6:00 AM</SelectItem>
                      <SelectItem value="07:00">7:00 AM</SelectItem>
                      <SelectItem value="08:00">8:00 AM</SelectItem>
                      <SelectItem value="09:00">9:00 AM</SelectItem>
                      <SelectItem value="10:00">10:00 AM</SelectItem>
                      <SelectItem value="11:00">11:00 AM</SelectItem>
                      <SelectItem value="12:00">12:00 PM</SelectItem>
                      <SelectItem value="13:00">1:00 PM</SelectItem>
                      <SelectItem value="14:00">2:00 PM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Duration (hours)</label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger data-testid="select-duration">
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2 hours</SelectItem>
                    <SelectItem value="4">4 hours (half day)</SelectItem>
                    <SelectItem value="6">6 hours</SelectItem>
                    <SelectItem value="8">8 hours (full day)</SelectItem>
                    <SelectItem value="10">10 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {project.calendarEventId && (
                <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3 flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-green-700 dark:text-green-400">
                    Scan scheduled for {project.scanDate ? new Date(project.scanDate).toLocaleString() : 'pending'}
                  </span>
                </div>
              )}

              <Button 
                onClick={handleSchedule} 
                className="w-full"
                disabled={scheduleMutation.isPending || !canSchedule}
                data-testid="button-schedule-scan"
              >
                {scheduleMutation.isPending ? "Scheduling..." : project.calendarEventId ? "Reschedule Scan" : "Schedule Scan"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Scoping Details Component - Shows all CPQ data from sales process (deprecated - use Quoted Scope)
function ScopingDetails({ lead }: { lead: Lead | undefined }) {
  if (!lead) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No linked lead found. Scoping information is not available.
      </div>
    );
  }

  const areas = (lead.cpqAreas as CpqArea[]) || [];
  const risks = (lead.cpqRisks as string[]) || [];
  const travel = (lead.cpqTravel as CpqTravel | null) || null;
  const scopingData = (lead.cpqScopingData as CpqScopingData) || {};
  const services = (lead.cpqServices as Record<string, number> | null) || null;

  return (
    <div className="space-y-4 pr-4">
      {/* Contact Information */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="w-4 h-4" />
            Contact Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Client:</span>
              <p className="font-medium">{lead.clientName}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Project:</span>
              <p className="font-medium">{lead.projectName || "—"}</p>
            </div>
          </div>
          {(lead.contactName || lead.contactEmail || lead.contactPhone) && (
            <>
              <Separator className="my-2" />
              <div className="grid grid-cols-1 gap-2 text-sm">
                {lead.contactName && (
                  <div className="flex items-center gap-2">
                    <Users className="w-3 h-3 text-muted-foreground" />
                    <span>{lead.contactName}</span>
                  </div>
                )}
                {lead.contactEmail && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-3 h-3 text-muted-foreground" />
                    <span>{lead.contactEmail}</span>
                  </div>
                )}
                {lead.contactPhone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3 h-3 text-muted-foreground" />
                    <span>{lead.contactPhone}</span>
                  </div>
                )}
              </div>
            </>
          )}
          {/* Billing Contact if available */}
          {(scopingData.billingContactName || scopingData.billingContactEmail || scopingData.billingContactPhone) && (
            <>
              <Separator className="my-2" />
              <p className="text-xs text-muted-foreground font-medium">Billing Contact</p>
              <div className="grid grid-cols-1 gap-2 text-sm">
                {scopingData.billingContactName && (
                  <div className="flex items-center gap-2">
                    <Users className="w-3 h-3 text-muted-foreground" />
                    <span>{scopingData.billingContactName}</span>
                  </div>
                )}
                {scopingData.billingContactEmail && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-3 h-3 text-muted-foreground" />
                    <span>{scopingData.billingContactEmail}</span>
                  </div>
                )}
                {scopingData.billingContactPhone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3 h-3 text-muted-foreground" />
                    <span>{scopingData.billingContactPhone}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Building Areas */}
      {areas.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Building Areas ({areas.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {areas.map((area, idx) => (
              <div key={area.id || idx} className="bg-muted/50 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{area.name}</span>
                  {area.buildingName && (
                    <Badge variant="outline" className="text-xs">{area.buildingName}</Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div>
                    <span>Type:</span>
                    <p className="text-foreground">{BUILDING_TYPE_LABELS[area.buildingType] || area.buildingType}</p>
                  </div>
                  <div>
                    <span>Size:</span>
                    <p className="text-foreground">{area.squareFeet ? `${Number(area.squareFeet).toLocaleString()} SF` : "—"}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {area.disciplines?.map(disc => (
                    <Badge key={disc} variant="secondary" className="text-xs">
                      {DISCIPLINE_LABELS[disc] || disc}
                      {area.disciplineLods?.[disc] && ` (LOD ${area.disciplineLods[disc]})`}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Travel Configuration */}
      {travel && travel.travelMode && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Truck className="w-4 h-4" />
              Travel Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Mode:</span>
                <p className="font-medium">{TRAVEL_MODE_LABELS[travel.travelMode] || travel.travelMode}</p>
              </div>
              {travel.scanDays && (
                <div>
                  <span className="text-muted-foreground">Scan Days:</span>
                  <p className="font-medium">{travel.scanDays}</p>
                </div>
              )}
              {lead.dispatchLocation && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Dispatch From:</span>
                  <p className="font-medium">{lead.dispatchLocation}</p>
                </div>
              )}
              {lead.distance && (
                <div>
                  <span className="text-muted-foreground">Distance:</span>
                  <p className="font-medium">{lead.distance} miles</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Services */}
      {services && Object.keys(services).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="w-4 h-4" />
              Services
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(services).map(([service, count]) => (
                <Badge key={service} variant="secondary" className="text-xs">
                  {SERVICE_LABELS[service] || service} {count > 1 && `(${count})`}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Risk Factors */}
      {risks.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Risk Factors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {risks.map(risk => (
                <Badge key={risk} variant="destructive" className="text-xs">
                  {RISK_LABELS[risk] || risk}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scoping Notes */}
      {(lead.notes || scopingData.projectNotes || scopingData.insuranceRequirements) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Notes & Special Requirements
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {lead.notes && (
              <div>
                <p className="text-muted-foreground text-xs mb-1">General Notes</p>
                <p className="whitespace-pre-wrap">{lead.notes}</p>
              </div>
            )}
            {scopingData.projectNotes && (
              <div>
                <p className="text-muted-foreground text-xs mb-1">Project Notes</p>
                <p className="whitespace-pre-wrap">{scopingData.projectNotes}</p>
              </div>
            )}
            {scopingData.insuranceRequirements && (
              <div>
                <p className="text-muted-foreground text-xs mb-1">Insurance Requirements</p>
                <p>{scopingData.insuranceRequirements}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Deliverables */}
      {(scopingData.bimDeliverable && scopingData.bimDeliverable.length > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="w-4 h-4" />
              Deliverables
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {scopingData.bimDeliverable.map((deliverable: string) => (
                <Badge key={deliverable} variant="secondary">{deliverable}</Badge>
              ))}
            </div>
            {(lead.bimVersion || scopingData.bimVersion) && (
              <p className="text-sm text-muted-foreground mt-2">BIM Version: {lead.bimVersion || scopingData.bimVersion}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Deal Value */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Deal Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Quote Value:</span>
              <p className="font-medium text-lg">${Number(lead.value).toLocaleString()}</p>
            </div>
            {lead.quoteNumber && (
              <div>
                <span className="text-muted-foreground">Quote #:</span>
                <p className="font-medium">{lead.quoteNumber}</p>
              </div>
            )}
            {lead.timeline && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Timeline:</span>
                <p className="font-medium">{lead.timeline}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Mobile Field Mode - Large Touch Targets for Technicians
function MobileFieldView({ 
  projects, 
  isLoading,
  onEdit 
}: { 
  projects: Project[]; 
  isLoading: boolean;
  onEdit: (project: Project) => void;
}) {
  const { toast } = useToast();
  const updateMutation = useUpdateProject();
  const [advancing, setAdvancing] = useState<number | null>(null);

  async function advanceStatus(project: Project) {
    const nextStatus = getNextStatus(project.status);
    if (!nextStatus) return;
    
    setAdvancing(project.id);
    try {
      await updateMutation.mutateAsync({ 
        id: project.id, 
        name: project.name,
        status: nextStatus,
        priority: project.priority,
        progress: project.progress ?? 0,
      });
      toast({ title: "Status Updated", description: `Moved to ${nextStatus}` });
    } catch (err: any) {
      const gateType = err?.gateType;
      let title = "Cannot Advance Project";
      let description = err?.message || "Failed to update status";
      
      // Provide specific gate feedback
      if (gateType === "RETAINER_REQUIRED") {
        title = "Retainer Payment Required";
      } else if (gateType === "QC_VALIDATION_REQUIRED") {
        title = "QC Validation Required";
      } else if (gateType === "QC_RMS_EXCEEDED") {
        title = "Registration RMS Exceeded";
      } else if (gateType === "SQFT_AUDIT_REQUIRED") {
        title = "Square Foot Audit Required";
      } else if (gateType === "PAYMENT_REQUIRED") {
        title = "Payment Required";
      }
      
      toast({ title, description, variant: "destructive" });
    } finally {
      setAdvancing(null);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-card/50 animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  // Sort projects by status order, then by priority
  const sortedProjects = [...projects].sort((a, b) => {
    const aIdx = COLUMN_ORDER.indexOf(a.status);
    const bIdx = COLUMN_ORDER.indexOf(b.status);
    if (aIdx !== bIdx) return aIdx - bIdx;
    const priorityOrder = { High: 0, Medium: 1, Low: 2 };
    return (priorityOrder[a.priority as keyof typeof priorityOrder] || 1) - 
           (priorityOrder[b.priority as keyof typeof priorityOrder] || 1);
  });

  return (
    <div className="space-y-3">
      {sortedProjects.map(project => {
        const col = COLUMNS.find(c => c.id === project.status);
        const Icon = col?.icon || Box;
        const nextStatus = getNextStatus(project.status);
        const isAdvancing = advancing === project.id;

        return (
          <div 
            key={project.id} 
            className="bg-card rounded-xl border border-border p-4 active:bg-secondary/50 transition-colors"
            data-testid={`mobile-project-${project.id}`}
          >
            <div className="flex items-start gap-3">
              <div className="bg-accent/10 rounded-lg p-3 shrink-0">
                <Icon className="w-6 h-6 text-accent" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="font-semibold text-base truncate">{project.name}</h3>
                  <Badge 
                    variant={project.priority === "High" ? "destructive" : "secondary"}
                    className="text-xs"
                  >
                    {project.priority}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <span className="font-medium">{col?.title}</span>
                  {(project.progress ?? 0) > 0 && (
                    <>
                      <span className="text-border">|</span>
                      <span>{project.progress}%</span>
                    </>
                  )}
                </div>
                
                <Progress value={project.progress || 0} className="h-2" />
              </div>
            </div>
            
            {/* Large Touch Action Buttons */}
            <div className="flex gap-2 mt-4">
              <Button 
                variant="outline" 
                className="flex-1 h-12 text-base"
                onClick={() => onEdit(project)}
                data-testid={`button-edit-project-${project.id}`}
              >
                Edit
              </Button>
              
              {nextStatus && (
                <Button 
                  className="flex-1 h-12 text-base bg-accent"
                  onClick={() => advanceStatus(project)}
                  disabled={isAdvancing}
                  data-testid={`button-advance-project-${project.id}`}
                >
                  {isAdvancing ? (
                    "Updating..."
                  ) : (
                    <>
                      <Check className="w-5 h-5 mr-2" />
                      Mark {nextStatus}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        );
      })}
      
      {projects.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No projects yet. Tap "New Project" to get started.</p>
        </div>
      )}
    </div>
  );
}
