import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Upload, File, Image, FileText, Trash2, ExternalLink, Loader2, Paperclip } from "lucide-react";

interface ProjectAttachment {
  id: number;
  projectId: number;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  driveFileId: string | null;
  driveFileUrl: string | null;
  driveDownloadUrl: string | null;
  thumbnailUrl: string | null;
  subfolder: string | null;
  source: string | null;
  createdAt: string;
}

interface ProjectAttachmentsProps {
  projectId: number;
  universalProjectId?: string;
  hasDriveFolder: boolean;
}

export function ProjectAttachments({ projectId, universalProjectId, hasDriveFolder }: ProjectAttachmentsProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);

  const { data: attachments = [], isLoading } = useQuery<ProjectAttachment[]>({
    queryKey: ['/api/projects', projectId, 'attachments'],
    enabled: !!projectId,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`/api/projects/${projectId}/attachments`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'attachments'] });
      toast({
        title: "File uploaded",
        description: "Your file has been uploaded to Google Drive",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (attachmentId: number) => apiRequest('DELETE', `/api/attachments/${attachmentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'attachments'] });
      toast({
        title: "File deleted",
        description: "The attachment has been removed",
      });
    },
    onError: () => {
      toast({
        title: "Delete failed",
        description: "Failed to delete the attachment",
        variant: "destructive",
      });
    },
  });

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!hasDriveFolder) {
      toast({
        title: "Cannot upload",
        description: "This project needs a Google Drive folder first. Close the deal to create one.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    for (const file of acceptedFiles) {
      await uploadMutation.mutateAsync(file);
    }
    setUploading(false);
  }, [hasDriveFolder, uploadMutation, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/gif': ['.gif'],
      'application/pdf': ['.pdf'],
    },
    maxSize: 25 * 1024 * 1024,
    disabled: !hasDriveFolder || uploading,
  });

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <Image className="h-4 w-4" />;
    if (mimeType === 'application/pdf') return <FileText className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Paperclip className="h-4 w-4" />
          Visual Scoping Attachments
          {attachments.length > 0 && (
            <Badge variant="secondary" className="text-xs">{attachments.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          {...getRootProps()}
          data-testid="dropzone-attachments"
          className={`
            border-2 border-dashed rounded-md p-6 text-center cursor-pointer transition-colors
            ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50'}
            ${!hasDriveFolder ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input {...getInputProps()} data-testid="input-file-upload" />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Uploading to Google Drive...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {hasDriveFolder
                  ? "Drag & drop files here, or click to select"
                  : "Close the deal to enable file uploads"
                }
              </p>
              <p className="text-xs text-muted-foreground/70">
                Images (JPG, PNG, GIF) and PDFs up to 25MB
              </p>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : attachments.length > 0 ? (
          <div className="space-y-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                data-testid={`attachment-item-${attachment.id}`}
                className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/50"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {getFileIcon(attachment.mimeType)}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate" title={attachment.originalName}>
                      {attachment.originalName}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatFileSize(attachment.fileSize)}</span>
                      {attachment.subfolder && (
                        <Badge variant="outline" className="text-xs">{attachment.subfolder}</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {attachment.driveFileUrl && (
                    <Button
                      size="icon"
                      variant="ghost"
                      asChild
                      data-testid={`button-view-attachment-${attachment.id}`}
                    >
                      <a href={attachment.driveFileUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deleteMutation.mutate(attachment.id)}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-delete-attachment-${attachment.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No attachments yet
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function AttachmentCountBadge({ projectId }: { projectId: number }) {
  const { data } = useQuery<{ count: number }>({
    queryKey: ['/api/projects', projectId, 'attachments', 'count'],
  });

  if (!data?.count) return null;

  return (
    <Badge variant="outline" className="flex items-center gap-1 text-xs" data-testid={`badge-attachment-count-${projectId}`}>
      <Paperclip className="h-3 w-3" />
      {data.count}
    </Badge>
  );
}
