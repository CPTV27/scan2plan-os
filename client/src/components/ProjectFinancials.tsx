import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { DollarSign, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle } from "lucide-react";

interface CompensationItem {
  name: string;
  role: string | null;
  type: string;
  rate: number;
  amount: number;
}

interface ProfitabilityData {
  revenue: number;
  costs: {
    labor: number;
    vendor: number;
    commission: number;
    overhead: number;
    total: number;
  };
  profit: {
    grossDollar: number;
    grossPercent: number;
    netDollar: number;
    netPercent: number;
  };
  compensationBreakdown?: CompensationItem[];
  salesRep?: {
    name: string;
    commissionRate: number;
  };
  settings: {
    overheadRate: number;
    targetNetMargin: number;
  };
}

interface ProjectFinancialsProps {
  projectId: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function MarginIndicator({ value, target }: { value: number; target: number }) {
  const isAboveTarget = value >= target;
  const isWarning = value >= target * 0.7 && value < target;
  const isCritical = value < target * 0.7;

  if (isAboveTarget) {
    return (
      <Badge variant="default" className="bg-green-600">
        <CheckCircle className="w-3 h-3 mr-1" />
        {formatPercent(value)}
      </Badge>
    );
  } else if (isWarning) {
    return (
      <Badge variant="default" className="bg-yellow-600">
        <AlertTriangle className="w-3 h-3 mr-1" />
        {formatPercent(value)}
      </Badge>
    );
  } else {
    return (
      <Badge variant="destructive">
        <TrendingDown className="w-3 h-3 mr-1" />
        {formatPercent(value)}
      </Badge>
    );
  }
}

export function ProjectFinancials({ projectId }: ProjectFinancialsProps) {
  const { data, isLoading, error } = useQuery<ProfitabilityData>({
    queryKey: ['/api/projects', projectId, 'financials'],
  });

  if (isLoading) {
    return (
      <Card data-testid="card-project-financials-loading">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Profitability Waterfall
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-6 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card data-testid="card-project-financials-error">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Profitability Waterfall
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Unable to calculate profitability. Ensure project has linked lead with quoted price.</p>
        </CardContent>
      </Card>
    );
  }

  const cogsCost = data.costs.labor + data.costs.vendor;
  const targetMargin = data.settings.targetNetMargin;

  return (
    <Card data-testid="card-project-financials">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Profitability Waterfall
          </span>
          <MarginIndicator value={data.profit.netPercent} target={targetMargin} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between font-bold text-lg" data-testid="text-gross-revenue">
          <span>Gross Revenue</span>
          <span className="text-foreground">{formatCurrency(data.revenue)}</span>
        </div>

        <div className="border-t pt-3 space-y-2 text-sm">
          <div className="flex justify-between text-muted-foreground" data-testid="text-cogs">
            <span className="flex items-center gap-1">
              <Minus className="w-3 h-3" />
              Labor & Vendors (COGS)
            </span>
            <span>{formatCurrency(cogsCost)}</span>
          </div>

          <div className="pl-4 text-xs text-muted-foreground/70 space-y-1">
            <div className="flex justify-between">
              <span>Labor</span>
              <span>{formatCurrency(data.costs.labor)}</span>
            </div>
            <div className="flex justify-between">
              <span>Vendors</span>
              <span>{formatCurrency(data.costs.vendor)}</span>
            </div>
          </div>

          <div className="flex justify-between pt-1 border-t border-dashed">
            <span className="font-medium">Gross Profit</span>
            <span className="font-medium">{formatCurrency(data.profit.grossDollar)} ({formatPercent(data.profit.grossPercent)})</span>
          </div>

          <div className="flex justify-between text-orange-600 dark:text-orange-400 pt-2" data-testid="text-commission">
            <span className="flex items-center gap-1">
              <Minus className="w-3 h-3" />
              Compensation
            </span>
            <span>{formatCurrency(data.costs.commission)}</span>
          </div>

          {data.compensationBreakdown && data.compensationBreakdown.length > 0 && (
            <div className="pl-4 text-xs text-muted-foreground/70 space-y-1">
              {data.compensationBreakdown.map((item, idx) => (
                <div className="flex justify-between" key={idx}>
                  <span>{item.name} ({formatPercent(item.rate)})</span>
                  <span>{formatCurrency(item.amount)}</span>
                </div>
              ))}
            </div>
          )}

          {!data.compensationBreakdown?.length && data.salesRep && (
            <div className="pl-4 text-xs text-muted-foreground/70">
              <div className="flex justify-between">
                <span>{data.salesRep.name} ({formatPercent(data.salesRep.commissionRate)})</span>
                <span>{formatCurrency(data.costs.commission)}</span>
              </div>
            </div>
          )}

          <div className="flex justify-between text-muted-foreground" data-testid="text-overhead">
            <span className="flex items-center gap-1">
              <Minus className="w-3 h-3" />
              Overhead Allocation ({formatPercent(data.settings.overheadRate)})
            </span>
            <span>{formatCurrency(data.costs.overhead)}</span>
          </div>
        </div>

        <div className="border-t pt-3 mt-2">
          <div className="flex justify-between font-bold text-xl" data-testid="text-true-net-profit">
            <span className={data.profit.netDollar >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600"}>
              True Net Profit
            </span>
            <span className={data.profit.netDollar >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600"}>
              {formatCurrency(data.profit.netDollar)}
            </span>
          </div>
          
          <div className="mt-3">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Net Margin Target: {formatPercent(targetMargin)}</span>
              <span className={data.profit.netPercent < targetMargin ? "text-destructive" : "text-green-600"}>
                Current: {formatPercent(data.profit.netPercent)}
              </span>
            </div>
            <Progress 
              value={Math.max(0, Math.min(100, (data.profit.netPercent / 40) * 100))} 
              className="h-2" 
            />
            <div className="flex justify-between text-xs text-muted-foreground/50 mt-1">
              <span>0%</span>
              <span>20%</span>
              <span>40%</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ProjectFinancialsCompact({ data }: { data: ProfitabilityData }) {
  const targetMargin = data.settings.targetNetMargin;
  
  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="flex items-center gap-1">
        <span className="text-muted-foreground">Revenue:</span>
        <span className="font-medium">{formatCurrency(data.revenue)}</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-muted-foreground">Net:</span>
        <span className={`font-medium ${data.profit.netDollar >= 0 ? "text-green-600" : "text-red-600"}`}>
          {formatCurrency(data.profit.netDollar)}
        </span>
      </div>
      <MarginIndicator value={data.profit.netPercent} target={targetMargin} />
    </div>
  );
}
