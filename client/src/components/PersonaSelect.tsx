import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface Persona {
  id: number;
  code: string;
  name: string;
  painPoints: string[] | null;
  preferredTags: string[] | null;
  scriptTemplate: string | null;
}

interface PersonaSelectProps {
  leadId: number;
  currentPersona?: string | null;
  onUpdate?: () => void;
}

export function PersonaSelect({ leadId, currentPersona, onUpdate }: PersonaSelectProps) {
  const { toast } = useToast();

  const { data: personas = [], isLoading: loadingPersonas } = useQuery<Persona[]>({
    queryKey: ['/api/personas'],
  });

  const updateMutation = useMutation({
    mutationFn: async (personaCode: string) => {
      return apiRequest('PATCH', `/api/leads/${leadId}`, { buyerPersona: personaCode });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/leads', leadId] });
      toast({
        title: "Persona Updated",
        description: "Lead persona classification saved",
      });
      onUpdate?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (loadingPersonas) {
    return <Loader2 className="h-4 w-4 animate-spin" />;
  }

  return (
    <Select
      value={currentPersona || ''}
      onValueChange={(value) => updateMutation.mutate(value)}
      disabled={updateMutation.isPending}
    >
      <SelectTrigger className="h-7 text-xs w-[100px]" data-testid={`select-persona-${leadId}`}>
        <SelectValue placeholder="Classify" />
      </SelectTrigger>
      <SelectContent>
        {personas.map((persona) => (
          <SelectItem key={persona.code} value={persona.code} data-testid={`option-persona-${persona.code}`}>
            {persona.code}: {persona.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
