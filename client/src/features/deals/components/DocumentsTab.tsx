import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Download, ExternalLink, Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { LeadDocument } from "@shared/schema";
import type { UseMutationResult } from "@tanstack/react-query";

interface DocumentsTabProps {
  documents: LeadDocument[] | undefined;
  documentsLoading: boolean;
  uploadDocumentMutation: UseMutationResult<LeadDocument, Error, File, unknown>;
  deleteDocumentMutation: UseMutationResult<void, Error, number, unknown>;
}

export function DocumentsTab({
  documents,
  documentsLoading,
  uploadDocumentMutation,
  deleteDocumentMutation,
}: DocumentsTabProps) {
  return (
    <ScrollArea className="h-full flex-1">
      <div className="p-4 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Paperclip className="w-4 h-4" />
              Project Documents
            </CardTitle>
            <CardDescription>
              Upload floor plans, pictures, or other files. When this deal closes, files will automatically move to Google Drive.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-center border-2 border-dashed border-muted rounded-lg p-6">
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-8 h-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Upload floor plans, pictures, or documents</span>
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    disabled={uploadDocumentMutation.isPending}
                    onClick={() => {
                      const input = document.getElementById('document-upload-input') as HTMLInputElement;
                      input?.click();
                    }}
                    data-testid="button-upload-document"
                  >
                    {uploadDocumentMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>Select File</>
                    )}
                  </Button>
                  <input
                    id="document-upload-input"
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadDocumentMutation.mutate(file);
                      e.target.value = '';
                    }}
                    disabled={uploadDocumentMutation.isPending}
                    data-testid="input-upload-document"
                  />
                </div>
              </div>

              {documentsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : documents && documents.length > 0 ? (
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      data-testid={`document-item-${doc.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <Paperclip className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{doc.originalName}</p>
                          <p className="text-xs text-muted-foreground">
                            {(doc.size / 1024).toFixed(1)} KB
                            {doc.uploadedAt && ` • ${formatDistanceToNow(new Date(doc.uploadedAt), { addSuffix: true })}`}
                          </p>
                        </div>
                        {doc.movedToDriveAt && (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <ExternalLink className="w-3 h-3" />
                            In Drive
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => window.open(`/api/documents/${doc.id}/download`, '_blank')}
                          data-testid={`button-download-${doc.id}`}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              disabled={deleteDocumentMutation.isPending}
                              data-testid={`button-delete-document-${doc.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Document?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{doc.originalName}"? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteDocumentMutation.mutate(doc.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Paperclip className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground">No documents uploaded yet</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}
