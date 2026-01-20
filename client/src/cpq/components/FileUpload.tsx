import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, X, File } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface UploadedFile {
  name: string;
  url: string;
  size: number;
}

interface FileUploadProps {
  label?: string;
  files: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
  maxFiles?: number;
  disabled?: boolean;
}

export default function FileUpload({ 
  label = "Upload Files", 
  files, 
  onChange, 
  maxFiles = 10,
  disabled = false 
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const selectedFiles = Array.from(e.target.files);
    
    if (files.length + selectedFiles.length > maxFiles) {
      toast({
        title: "Too many files",
        description: `Maximum ${maxFiles} files allowed`,
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    const uploadedFiles: UploadedFile[] = [];

    try {
      for (const file of selectedFiles) {
        const uploadResponse = await apiRequest("POST", "/api/objects/upload", {});
        const uploadData = await uploadResponse.json();
        const { uploadURL } = uploadData;

        const putResponse = await fetch(uploadURL, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file.type || "application/octet-stream",
          },
        });

        if (!putResponse.ok) {
          throw new Error("Upload to storage failed");
        }

        const finalizeResponse = await apiRequest("PUT", "/api/objects/finalize", {
          fileURL: uploadURL,
        });
        const finalizeData = await finalizeResponse.json();

        uploadedFiles.push({
          name: file.name,
          url: finalizeData.objectPath,
          size: file.size,
        });
      }

      onChange([...files, ...uploadedFiles]);
      toast({
        title: "Upload successful",
        description: `${uploadedFiles.length} file(s) uploaded`,
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: "Failed to upload files. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleRemove = (index: number) => {
    onChange(files.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || uploading || files.length >= maxFiles}
        onClick={() => document.getElementById(`file-input-${label}`)?.click()}
        data-testid={`button-upload-${label.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <Upload className="h-4 w-4 mr-2" />
        {uploading ? "Uploading..." : label}
      </Button>
      
      <input
        id={`file-input-${label}`}
        type="file"
        multiple
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled || uploading}
      />

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => (
            <Card key={index} className="p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <File className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemove(index)}
                  disabled={disabled}
                  data-testid={`button-remove-file-${index}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}



