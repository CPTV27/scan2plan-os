import { Router } from 'express';
import { db } from '../db';
import { buyerPersonas, personaInsights, leads, insertBuyerPersonaSchema, insertPersonaInsightSchema } from '@shared/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import { analyzeOutcome, suggestPersonaForLead, getBuyingModeGuidance, isAIConfigured, type DealContext } from '../services/personaLearning';

export const personasRouter = Router();

personasRouter.get('/', async (req, res) => {
  try {
    const personas = await db
      .select()
      .from(buyerPersonas)
      .where(eq(buyerPersonas.isActive, true))
      .orderBy(buyerPersonas.code);
    
    res.json(personas);
  } catch (error: any) {
    console.error('Error fetching personas:', error);
    res.status(500).json({ error: error.message });
  }
});

personasRouter.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid persona ID' });
    }

    const [persona] = await db
      .select()
      .from(buyerPersonas)
      .where(eq(buyerPersonas.id, id));

    if (!persona) {
      return res.status(404).json({ error: 'Persona not found' });
    }

    const insights = await db
      .select()
      .from(personaInsights)
      .where(eq(personaInsights.personaId, id))
      .orderBy(desc(personaInsights.createdAt))
      .limit(10);

    res.json({ ...persona, recentInsights: insights });
  } catch (error: any) {
    console.error('Error fetching persona:', error);
    res.status(500).json({ error: error.message });
  }
});

personasRouter.get('/code/:code', async (req, res) => {
  try {
    const { code } = req.params;

    const [persona] = await db
      .select()
      .from(buyerPersonas)
      .where(eq(buyerPersonas.code, code));

    if (!persona) {
      return res.status(404).json({ error: 'Persona not found' });
    }

    res.json(persona);
  } catch (error: any) {
    console.error('Error fetching persona by code:', error);
    res.status(500).json({ error: error.message });
  }
});

personasRouter.post('/', async (req, res) => {
  try {
    const validated = insertBuyerPersonaSchema.parse(req.body);
    
    const [newPersona] = await db
      .insert(buyerPersonas)
      .values(validated)
      .returning();

    res.status(201).json(newPersona);
  } catch (error: any) {
    console.error('Error creating persona:', error);
    res.status(400).json({ error: error.message });
  }
});

personasRouter.patch('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid persona ID' });
    }

    const [updated] = await db
      .update(buyerPersonas)
      .set({
        ...req.body,
        updatedAt: new Date(),
      })
      .where(eq(buyerPersonas.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Persona not found' });
    }

    res.json(updated);
  } catch (error: any) {
    console.error('Error updating persona:', error);
    res.status(400).json({ error: error.message });
  }
});

personasRouter.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid persona ID' });
    }

    const [deactivated] = await db
      .update(buyerPersonas)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(buyerPersonas.id, id))
      .returning();

    if (!deactivated) {
      return res.status(404).json({ error: 'Persona not found' });
    }

    res.json({ message: 'Persona deactivated', persona: deactivated });
  } catch (error: any) {
    console.error('Error deactivating persona:', error);
    res.status(500).json({ error: error.message });
  }
});

personasRouter.get('/:id/playbook', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const buyingMode = req.query.buyingMode as string;
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid persona ID' });
    }

    const [persona] = await db
      .select()
      .from(buyerPersonas)
      .where(eq(buyerPersonas.id, id));

    if (!persona) {
      return res.status(404).json({ error: 'Persona not found' });
    }

    const strategies = persona.buyingModeStrategies as { firefighter?: string; optimizer?: string; innovator?: string } | null;
    const modeStrategy = buyingMode && strategies ? strategies[buyingMode as keyof typeof strategies] : null;

    const playbook = {
      personaCode: persona.code,
      personaName: persona.name,
      valueHook: persona.valueHook,
      modeStrategy: modeStrategy || 'Approach based on client context',
      exactLanguage: persona.exactLanguage || [],
      avoidWords: persona.avoidWords || [],
      requiredAssets: persona.requiredAssets || [],
      vetoPower: persona.vetoPower,
      riskLevel: persona.defaultRiskLevel,
      primaryPain: persona.primaryPain,
      valueDriver: persona.valueDriver,
    };

    res.json(playbook);
  } catch (error: any) {
    console.error('Error fetching playbook:', error);
    res.status(500).json({ error: error.message });
  }
});

personasRouter.post('/insights', async (req, res) => {
  try {
    const validated = insertPersonaInsightSchema.parse(req.body);
    
    const [insight] = await db
      .insert(personaInsights)
      .values(validated)
      .returning();

    if (validated.personaId && validated.outcome) {
      await recalculatePersonaStats(validated.personaId);
    }

    res.status(201).json(insight);
  } catch (error: any) {
    console.error('Error creating insight:', error);
    res.status(400).json({ error: error.message });
  }
});

personasRouter.get('/:id/insights', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid persona ID' });
    }

    const insights = await db
      .select()
      .from(personaInsights)
      .where(eq(personaInsights.personaId, id))
      .orderBy(desc(personaInsights.createdAt));

    res.json(insights);
  } catch (error: any) {
    console.error('Error fetching insights:', error);
    res.status(500).json({ error: error.message });
  }
});

personasRouter.post('/analyze-outcome', async (req, res) => {
  try {
    const context: DealContext = req.body;
    
    if (!context.leadId || !context.personaCode || !context.outcome) {
      return res.status(400).json({ 
        error: 'Missing required fields: leadId, personaCode, outcome' 
      });
    }

    const result = await analyzeOutcome(context);
    
    if (!result) {
      return res.status(500).json({ error: 'Failed to analyze outcome' });
    }

    res.json(result);
  } catch (error: any) {
    console.error('Error analyzing outcome:', error);
    res.status(500).json({ error: error.message });
  }
});

personasRouter.post('/suggest', async (req, res) => {
  try {
    const { clientName, projectName, projectType, contactName, contactTitle, notes } = req.body;
    
    if (!clientName) {
      return res.status(400).json({ error: 'clientName is required' });
    }

    if (!isAIConfigured()) {
      return res.status(503).json({ 
        error: 'AI not configured',
        message: 'Persona suggestions require OpenAI API key to be configured'
      });
    }

    const suggestion = await suggestPersonaForLead({
      clientName,
      projectName,
      projectType,
      contactName,
      contactTitle,
      notes,
    });

    if (!suggestion) {
      return res.status(500).json({ error: 'Failed to generate suggestion' });
    }

    res.json(suggestion);
  } catch (error: any) {
    console.error('Error suggesting persona:', error);
    res.status(500).json({ error: error.message });
  }
});

personasRouter.get('/:code/guidance', async (req, res) => {
  try {
    const { code } = req.params;
    const mode = req.query.mode as string;

    if (!mode) {
      return res.status(400).json({ error: 'mode query parameter is required' });
    }

    const guidance = await getBuyingModeGuidance(code, mode);

    if (!guidance) {
      return res.status(404).json({ error: 'Persona not found or guidance unavailable' });
    }

    res.json(guidance);
  } catch (error: any) {
    console.error('Error getting guidance:', error);
    res.status(500).json({ error: error.message });
  }
});

async function recalculatePersonaStats(personaId: number) {
  try {
    const insights = await db
      .select()
      .from(personaInsights)
      .where(eq(personaInsights.personaId, personaId));

    if (insights.length === 0) return;

    const totalDeals = insights.length;
    const wonDeals = insights.filter(i => i.outcome === 'won');
    const winRate = (wonDeals.length / totalDeals) * 100;
    
    const dealsWithValue = wonDeals.filter(i => i.dealValue);
    const avgDealSize = dealsWithValue.length > 0
      ? dealsWithValue.reduce((sum, i) => sum + Number(i.dealValue || 0), 0) / dealsWithValue.length
      : null;
    
    const dealsWithCycle = wonDeals.filter(i => i.cycleLengthDays);
    const avgSalesCycleDays = dealsWithCycle.length > 0
      ? Math.round(dealsWithCycle.reduce((sum, i) => sum + (i.cycleLengthDays || 0), 0) / dealsWithCycle.length)
      : null;

    await db
      .update(buyerPersonas)
      .set({
        totalDeals,
        winRate: winRate.toFixed(2),
        avgDealSize: avgDealSize?.toFixed(2) || null,
        avgSalesCycleDays,
        updatedAt: new Date(),
      })
      .where(eq(buyerPersonas.id, personaId));
  } catch (error) {
    console.error('Error recalculating persona stats:', error);
  }
}
