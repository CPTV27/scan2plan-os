import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Trash2 } from "lucide-react";

interface QuoteCardProps {
  id: string;
  projectName: string;
  clientName: string;
  totalPrice: number;
  dateCreated: string;
  type: "Quote" | "Scope + Quote";
  onView: () => void;
  onExport: () => void;
  onDelete: () => void;
}

export default function QuoteCard({
  id,
  projectName,
  clientName,
  totalPrice,
  dateCreated,
  type,
  onView,
  onExport,
  onDelete,
}: QuoteCardProps) {
  return (
    <Card className="hover-elevate transition-all">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant={type === "Quote" ? "secondary" : "default"} className="text-xs">
              {type}
            </Badge>
          </div>
          <h3 className="font-semibold text-lg">{projectName}</h3>
          <p className="text-sm text-muted-foreground">{clientName}</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-2xl font-bold text-primary">
            ${totalPrice.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground">{dateCreated}</p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={onView}
            className="flex-1"
            data-testid={`button-view-quote-${id}`}
          >
            <FileText className="h-4 w-4 mr-2" />
            View/Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onExport}
            data-testid={`button-export-quote-${id}`}
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDelete}
            data-testid={`button-delete-quote-${id}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}



