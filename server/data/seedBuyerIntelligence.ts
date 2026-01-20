import { db } from '../db';
import { buyerPersonas, brandVoices, solutionMappings, negotiationPlaybook } from '@shared/schema';

export async function seedBuyerPersonas() {
  const existingPersonas = await db.select().from(buyerPersonas);
  if (existingPersonas.length > 0) {
    console.log('Buyer personas already seeded, skipping...');
    return;
  }

  await db.insert(buyerPersonas).values({
    code: 'BP-A',
    name: 'The Design Principal',
    roleTitle: 'Design Principal / Senior Architect',
    roleVariants: ['Senior Associate', 'Director of Design', 'Studio Director', 'Historic Preservation Specialist'],
    organizationType: 'Architecture Firm',
    primaryPain: 'As-built lies killing design intent',
    secondaryPain: 'Wasting senior design hours on forensic documentation',
    hiddenFear: "I'll miss something that embarrasses me in front of the client",
    valueDriver: 'Protecting Design Integrity',
    decisionCriteria: [
      'Accuracy that matches design tolerances',
      'Deliverables my team can actually use',
      'Understanding of historic/complex buildings',
      'References from peers I respect'
    ],
    dealbreakers: [
      'Generic scan-and-dump vendors',
      'No understanding of design process',
      'Pushy sales tactics',
      'Inflexible on timeline'
    ],
    projectPhases: ['Pre-Design', 'SD', 'DD'],
    budgetAuthority: 'Influencer',
    typicalBudgetRange: '$15K-$150K',
    influenceChain: {
      reportsTo: 'Managing Principal / Partner',
      needsApprovalFrom: ['Partner (for fee proposals)', 'PM (for schedule impact)'],
      influencedBy: ['Preservation consultants', 'Trusted contractors', 'Peer architects']
    },
    tonePreference: 'Peer-to-Peer / Intellectual',
    communicationStyle: 'Storytelling',
    attentionSpan: 'Will read deeply if content is substantive',
    technicalTriggers: ['heritage fabric', 'design intent', 'as-found conditions', 'tolerance', 'HBIM', 'point cloud', 'registration accuracy'],
    emotionalTriggers: ['protect', 'legacy', 'integrity', 'peace of mind', 'trust', 'reputation', 'craftsmanship'],
    avoidWords: ['cheap', 'fast', 'discount', 'cookie-cutter', 'standard package'],
    disqualifiers: [
      'Doesn\'t understand difference between laser scanning and photogrammetry',
      '"We just need a quick scan"',
      'Price-shopping multiple vendors on identical specs',
      'No respect for design process'
    ],
    isActive: true
  });

  await db.insert(buyerPersonas).values({
    code: 'BP-B',
    name: 'The Project Architect',
    roleTitle: 'Project Architect',
    roleVariants: ['Job Captain', 'Technical Lead', 'BIM Manager', 'Project Designer'],
    organizationType: 'Architecture Firm',
    primaryPain: 'Coordination hell - RFIs, clashes, and 2 AM redesigns',
    secondaryPain: 'Consultants delivering garbage models I have to clean up',
    hiddenFear: 'I\'ll be the one blamed when the model doesn\'t match the building',
    valueDriver: 'Workflow Efficiency & Clash Prevention',
    decisionCriteria: [
      'Revit-native deliverables that link cleanly',
      'Clear scope and timeline',
      'Responsive communication',
      'Experience with similar building types'
    ],
    dealbreakers: [
      'Slow turnaround',
      '"We\'ll figure it out" attitude',
      'No Revit expertise',
      'Poor file management'
    ],
    projectPhases: ['DD', 'CD'],
    budgetAuthority: 'Influencer',
    typicalBudgetRange: '$8K-$75K',
    influenceChain: {
      reportsTo: 'Design Principal / Project Manager',
      needsApprovalFrom: ['Design Principal (for scope)', 'PM (for budget)'],
      influencedBy: ['Other project architects', 'BIM Manager', 'Consultants']
    },
    tonePreference: 'Practical Problem-Solver',
    communicationStyle: 'Data-first',
    attentionSpan: 'Executive summary + detailed specs as backup',
    technicalTriggers: ['Revit families', 'clash detection', 'file compatibility', 'worksets', 'linked models', 'shared coordinates', 'export settings'],
    emotionalTriggers: ['sleep at night', 'no 2 AM calls', 'flow', 'one handoff', 'set it and forget it', 'plug and play', 'no surprises'],
    avoidWords: ['artistry', 'legacy', 'philosophy', 'vision', 'bespoke'],
    disqualifiers: [
      'Doesn\'t use Revit',
      'Can\'t answer technical questions',
      '"We\'ll figure out the details later"',
      'No clear timeline'
    ],
    isActive: true
  });

  await db.insert(buyerPersonas).values({
    code: 'BP-C',
    name: 'The Owner Representative',
    roleTitle: 'Owner Representative',
    roleVariants: ['Development Manager', 'Asset Manager', 'Facilities Director', 'Capital Projects Manager', 'VP of Construction'],
    organizationType: 'Developer / Owner / Institution',
    primaryPain: 'Variance - budget creep, schedule slip, scope gaps',
    secondaryPain: 'Being blindsided by information I should have had',
    hiddenFear: 'I\'ll look incompetent to my board/investors when problems surface',
    valueDriver: 'Risk Transfer & Defensibility',
    decisionCriteria: [
      'Clear scope and fixed pricing',
      'Professional liability coverage',
      'Track record with similar owners',
      'Documentation that holds up in disputes'
    ],
    dealbreakers: [
      'Vague scope',
      'Time & materials pricing',
      'No insurance',
      'Can\'t provide references from owners'
    ],
    projectPhases: ['Pre-Design', 'SD', 'Closeout'],
    budgetAuthority: 'Direct',
    typicalBudgetRange: '$25K-$500K',
    influenceChain: {
      reportsTo: 'CEO / Board / Investment Committee',
      needsApprovalFrom: ['Legal (for contracts)', 'Finance (for budget)'],
      influencedBy: ['Architect of record', 'Legal counsel', 'Peer owners']
    },
    tonePreference: 'Executive / Financial',
    communicationStyle: 'Bottom-line-first',
    attentionSpan: 'Executive summary only - no technical deep dives',
    technicalTriggers: ['audit trail', 'variance report', 'baseline documentation', 'change order defense', 'as-built certification'],
    emotionalTriggers: ['defensible', 'no surprises', 'locked in', 'boardroom-ready', 'sleep at night', 'bulletproof', 'covered'],
    avoidWords: ['point cloud', 'mesh', 'LOD', 'Revit families', 'worksets', 'any deep technical jargon'],
    disqualifiers: [
      'Wants cheapest option',
      'No budget for documentation',
      '"We\'ll deal with that later"',
      'History of litigation against vendors'
    ],
    isActive: true
  });

  await db.insert(buyerPersonas).values({
    code: 'BP-D',
    name: 'The GC Project Manager',
    roleTitle: 'GC Project Manager',
    roleVariants: ['Construction Manager', 'Project Executive', 'Superintendent', 'VDC Manager', 'Preconstruction Manager'],
    organizationType: 'General Contractor / CM',
    primaryPain: 'Coordination bottlenecks killing my schedule',
    secondaryPain: 'Subs pointing fingers when clashes surface',
    hiddenFear: 'I\'ll eat the cost when the model doesn\'t match field conditions',
    valueDriver: 'Schedule Certainty & Sub-Alignment',
    decisionCriteria: [
      'Speed of delivery',
      'Experience with active construction sites',
      'Ability to work around ongoing operations',
      'Clear coordination with subs'
    ],
    dealbreakers: [
      'Can\'t work around construction schedule',
      'No site safety protocol',
      'Slow turnaround',
      'Requires site shutdown'
    ],
    projectPhases: ['CD', 'CA', 'Closeout'],
    budgetAuthority: 'Direct',
    typicalBudgetRange: '$10K-$100K',
    influenceChain: {
      reportsTo: 'Project Executive / VP of Operations',
      needsApprovalFrom: ['Owner\'s Rep (for scope changes)', 'Accounting (for budget)'],
      influencedBy: ['VDC team', 'Superintendents', 'MEP subs']
    },
    tonePreference: 'Direct / No-BS / Bottom-line-first',
    communicationStyle: 'Bottom-line-first',
    attentionSpan: 'Executive summary only - get to the point',
    technicalTriggers: ['clash detection', 'constructability', 'phasing', 'MEP coordination', 'RFI reduction', 'Navisworks', 'BIM 360'],
    emotionalTriggers: ['no surprises', 'single source of truth', 'documentation trail', 'ahead of schedule', 'sub-proof', 'finger-point-proof', 'CYA'],
    avoidWords: ['design intent', 'architectural vision', 'historic', 'legacy', 'artistry'],
    disqualifiers: [
      'Wants cheapest scan possible',
      'No interest in model accuracy',
      '"We\'ll figure it out in the field"',
      'History of not paying vendors'
    ],
    isActive: true
  });

  console.log('Buyer Personas seeded');
}

export async function seedBrandVoices() {
  const existingVoices = await db.select().from(brandVoices);
  if (existingVoices.length > 0) {
    console.log('Brand voices already seeded, skipping...');
    return;
  }

  await db.insert(brandVoices).values({
    name: 'Executive Signal Mapper',
    purpose: 'High-stakes client communication - proposals, executive summaries, strategic content',
    baseInstruction: `You are the Executive Signal Mapper for Scan2Plan. Your voice carries calm authority.

CORE PRINCIPLES:
- Lead with the client's problem, not our capabilities
- Use precise language - no marketing fluff
- Confidence without arrogance
- Technical credibility wrapped in accessibility
- Every sentence earns its place

STRUCTURE:
- Open with their pain (show you understand)
- Bridge to the mechanism (how we solve it)
- Close with the outcome (what they get)

PROHIBITIONS:
- Never use "cutting-edge," "state-of-the-art," "industry-leading"
- Never lead with price
- Never oversell or over-promise
- No exclamation points
- No "we're excited to..."`,
    toneMarkers: ['calm authority', 'precise', 'confident', 'peer-level', 'understated'],
    prohibitions: ['hype language', 'exclamation points', 'superlatives', 'sales breath', 'desperation signals'],
    exampleOutput: 'The documentation you inherited is lying to you. Existing as-builts show a building that doesn\'t exist. Before your team draws a single line, we establish ground truth—accurate to 2mm—so every decision downstream starts from reality, not assumption.',
    isActive: true
  });

  await db.insert(brandVoices).values({
    name: 'Technical Translator',
    purpose: 'Detailed technical specs, methodology documents, scope definitions',
    baseInstruction: `You are the Technical Translator for Scan2Plan. You make complex processes clear without dumbing them down.

CORE PRINCIPLES:
- Precision over brevity (but no unnecessary words)
- Assume technical competence in your audience
- Explain the "why" behind technical choices
- Use industry-standard terminology correctly
- Include specific numbers, tolerances, formats

STRUCTURE:
- State the technical requirement
- Explain the methodology
- Specify the deliverable format
- Note any dependencies or prerequisites

PROHIBITIONS:
- No marketing language
- No vague descriptions ("high quality," "comprehensive")
- No assumptions about client knowledge (verify terms if needed)`,
    toneMarkers: ['precise', 'methodical', 'technically fluent', 'clear', 'detailed'],
    prohibitions: ['marketing fluff', 'vague qualifiers', 'assumed knowledge', 'oversimplification'],
    exampleOutput: 'Deliverable: Revit 2024 model at LOD 350 for architectural elements, LOD 300 for MEP routing. Point cloud registered to project coordinates with <2mm RMS error. Includes: walls, floors, ceilings, doors, windows, structural grid, major MEP runs. Excludes: furniture, fixtures, equipment (unless specified in scope addendum).',
    isActive: true
  });

  await db.insert(brandVoices).values({
    name: 'Negotiation Strategist',
    purpose: 'Objection handling, price discussions, scope negotiations',
    baseInstruction: `You are the Negotiation Strategist for Scan2Plan. You hold the line while keeping relationships intact.

CORE PRINCIPLES:
- Never apologize for pricing
- Reframe objections as opportunities for clarity
- Make the cost of NOT doing it clear
- Offer alternatives, not discounts
- Know when to walk away

STRUCTURE:
- Acknowledge the concern (don't dismiss)
- Reframe to the real issue
- Offer the path forward
- Anchor to value, not cost

TONE:
- Confident but not combative
- Helpful but not desperate
- Firm but flexible on structure`,
    toneMarkers: ['confident', 'non-defensive', 'value-anchored', 'collaborative', 'firm'],
    prohibitions: ['apologizing for price', 'desperation', 'immediate discounting', 'defensiveness'],
    exampleOutput: 'I hear you on budget. Let me reframe: the scan investment is 0.3% of your construction budget. The question isn\'t whether you can afford accurate documentation—it\'s whether you can afford the RFIs, change orders, and coordination failures that come from working blind. What if we phase the deliverables to match your cash flow?',
    isActive: true
  });

  await db.insert(brandVoices).values({
    name: 'Campaign Architect',
    purpose: 'Marketing content, email sequences, ad copy, social content',
    baseInstruction: `You are the Campaign Architect for Scan2Plan. You create content that earns attention.

CORE PRINCIPLES:
- Lead with the client's world, not ours
- Make the problem vivid before offering the solution
- Specificity beats generality
- One idea per piece
- Every word earns its place

STRUCTURE:
- Hook: Name the pain or the aspiration
- Twist: Challenge the assumption
- Proof: Concrete example or outcome
- CTA: Clear next step

TONE:
- Smart, not clever
- Confident, not cocky
- Specific, not vague`,
    toneMarkers: ['sharp', 'specific', 'pain-aware', 'outcome-focused', 'concise'],
    prohibitions: ['generic claims', 'industry clichés', 'feature lists', 'hype language'],
    exampleOutput: 'Your as-builts are fiction. Every clash, every RFI, every "wait, that\'s not what the drawings show" moment—it starts with documentation that doesn\'t match reality. We fix that. One scan. Ground truth. Before you draw a single line.',
    isActive: true
  });

  console.log('Brand Voices seeded');
}

export async function seedSolutionMappings() {
  const existingMappings = await db.select().from(solutionMappings);
  if (existingMappings.length > 0) {
    console.log('Solution mappings already seeded, skipping...');
    return;
  }

  const mappings = [
    {
      buyerCode: 'BP-A',
      painPoint: 'As-built lies killing design intent',
      solutionMechanism: 'LOD 350+ HBIM Documentation',
      proofPoint: 'Restored 1920s theater - captured original plaster profiles at 0.5mm accuracy',
      argumentFrame: 'Before your team interprets the building, we capture its truth. Every molding profile, every structural deviation, every layer of history—documented so your design responds to what\'s actually there, not what someone guessed was there.',
      objectionPreempt: 'Yes, it takes longer than a basic scan. That\'s because we\'re capturing the building, not just its outline.'
    },
    {
      buyerCode: 'BP-A',
      painPoint: 'Inherited documentation from previous architects is garbage',
      solutionMechanism: 'Full existing conditions documentation package',
      proofPoint: 'Discovered 14 undocumented structural modifications in "complete" drawings',
      argumentFrame: 'Those CAD files from 2003? They\'re a liability, not an asset. We start fresh—ground truth—so your design decisions build on reality, not inherited assumptions.',
      objectionPreempt: 'The previous architect may have done fine work. But buildings change. Contractors improvise. Renovations go undocumented. We capture what\'s there now.'
    },
    {
      buyerCode: 'BP-B',
      painPoint: 'Coordination hell - RFIs, clashes, and 2 AM redesigns',
      solutionMechanism: 'BIM-Ready Scan-to-Revit Workflow',
      proofPoint: '73% reduction in RFIs on MEP-heavy hospital renovation',
      argumentFrame: 'Your model will link cleanly. Our Revit families follow your standards. Shared coordinates are set before we deliver. You open the file, it works, you move on.',
      objectionPreempt: 'We\'ll need 30 minutes upfront to align on your Revit template and export preferences. That investment saves you days of cleanup.'
    },
    {
      buyerCode: 'BP-B',
      painPoint: 'Consultants delivering garbage models',
      solutionMechanism: 'Standardized deliverable specs',
      proofPoint: 'Provide detailed export settings document with every delivery',
      argumentFrame: 'We deliver exactly what you spec: file format, LOD, naming conventions, workset structure. No translation layer. No "can you re-export this?" back-and-forth.',
      objectionPreempt: 'If your template has specific requirements we haven\'t seen before, we\'ll ask questions upfront rather than guess and make you redo it.'
    },
    {
      buyerCode: 'BP-C',
      painPoint: 'Variance - budget creep, schedule slip, scope gaps',
      solutionMechanism: 'Baseline Documentation & Change Tracking',
      proofPoint: 'Owner used our baseline scan to defend $2.3M change order dispute',
      argumentFrame: 'You get a timestamped record of existing conditions. When contractors claim "it wasn\'t like that," you have the documentation to prove otherwise. This isn\'t just a scan—it\'s protection.',
      objectionPreempt: 'The upfront investment is real. The alternative is paying your lawyers $800/hour to argue about conditions you could have documented for a fraction of that.'
    },
    {
      buyerCode: 'BP-C',
      painPoint: 'Being blindsided by information I should have had',
      solutionMechanism: 'Executive Summary + Anomaly Flagging',
      proofPoint: 'Flagged structural settlement issue before design phase began',
      argumentFrame: 'You won\'t read a 200-page technical report. You shouldn\'t have to. We deliver a 2-page executive summary: here\'s what we found, here\'s what matters, here\'s what needs attention. The technical backup exists if you need it.',
      objectionPreempt: 'We can\'t catch everything—we\'re not structural engineers. But we flag anomalies and recommend when you need specialist eyes.'
    },
    {
      buyerCode: 'BP-D',
      painPoint: 'Coordination bottlenecks killing my schedule',
      solutionMechanism: 'Phased Scan Delivery for Construction Sequencing',
      proofPoint: 'Delivered scan data in 4 phases aligned to trade mobilization schedule',
      argumentFrame: 'You don\'t need the whole building scanned before demo starts. We phase delivery to match your schedule—MEP zones first if that\'s where coordination is critical. Your subs get what they need when they need it.',
      objectionPreempt: 'Phased delivery requires more coordination on our end, but it keeps your trades moving instead of waiting for one big deliverable.'
    },
    {
      buyerCode: 'BP-D',
      painPoint: 'Subs pointing fingers when clashes surface',
      solutionMechanism: 'Single Source of Truth Documentation',
      proofPoint: 'GC used scan baseline to resolve $400K dispute between MEP subs',
      argumentFrame: 'When the HVAC sub says "that duct was always there" and the plumber says "no it wasn\'t"—you pull up the scan. Date-stamped. Indisputable. The argument ends.',
      objectionPreempt: 'We can\'t prevent subs from disagreeing. We can give you the documentation to settle it fast.'
    },
  ];

  for (const mapping of mappings) {
    await db.insert(solutionMappings).values(mapping);
  }

  console.log('Solution Mappings seeded');
}

export async function seedNegotiationPlaybook() {
  const existingPlays = await db.select().from(negotiationPlaybook);
  if (existingPlays.length > 0) {
    console.log('Negotiation playbook already seeded, skipping...');
    return;
  }

  const plays = [
    {
      buyerCode: 'BP-A',
      objectionPattern: 'Too expensive',
      underlyingConcern: 'Budget pressure from PM or client',
      responseStrategy: 'Reframe as design insurance. Compare to cost of redesign when as-builts are wrong.',
      reframeLanguage: 'What\'s the cost of discovering the floor-to-floor height is wrong after you\'ve detailed the curtain wall? The scan is insurance against that moment.',
      walkAwaySignal: 'They explicitly say documentation doesn\'t matter to design quality'
    },
    {
      buyerCode: 'BP-B',
      objectionPattern: 'Too expensive',
      underlyingConcern: 'Comparing to cheapest scan quote they got',
      responseStrategy: 'Differentiate on Revit-readiness. Calculate their hourly rate × cleanup time.',
      reframeLanguage: 'The $8K scan that arrives as an unusable point cloud costs you 40 hours of cleanup at your billing rate. Which is actually more expensive?',
      walkAwaySignal: 'They only care about having "a scan" for the file, not usable documentation'
    },
    {
      buyerCode: 'BP-C',
      objectionPattern: 'Too expensive',
      underlyingConcern: 'Doesn\'t see documentation as risk mitigation',
      responseStrategy: 'Anchor to dispute/litigation costs. Make it about defensibility.',
      reframeLanguage: 'Your legal team bills what per hour? One deposition about undocumented conditions exceeds this investment. This is the cheapest insurance you\'ll buy on this project.',
      walkAwaySignal: 'They have a track record of litigation and blame-shifting'
    },
    {
      buyerCode: 'BP-D',
      objectionPattern: 'Too expensive',
      underlyingConcern: 'Trying to keep project under budget threshold',
      responseStrategy: 'Tie to RFI/change order costs. Make it schedule math.',
      reframeLanguage: 'How many RFIs does it take to exceed this cost? If accurate documentation prevents even two coordination RFIs, it\'s paid for itself. And your schedule stays intact.',
      walkAwaySignal: '"We\'ll figure it out in the field" is their actual strategy'
    },
    {
      buyerCode: 'BP-B',
      objectionPattern: 'Timeline too long',
      underlyingConcern: 'DD deadline pressure',
      responseStrategy: 'Offer phased delivery. Identify critical-path elements.',
      reframeLanguage: 'What do you need first? We can deliver the primary floor as-built in 5 days, full MEP in 10. You start working while we complete the package.',
      walkAwaySignal: 'They need full deliverable in timeline that compromises accuracy'
    },
    {
      buyerCode: 'BP-D',
      objectionPattern: 'Can\'t shut down the site',
      underlyingConcern: 'Construction schedule pressure',
      responseStrategy: 'Describe night/weekend scanning capability. Reference active site experience.',
      reframeLanguage: 'We\'ve scanned occupied hospitals at 2 AM. Active construction sites are Tuesday for us. What\'s your least-disruptive window?',
      walkAwaySignal: 'Zero flexibility on access, unrealistic constraints'
    },
    {
      buyerCode: 'BP-A',
      objectionPattern: 'We only need a basic scan',
      underlyingConcern: 'Doesn\'t understand LOD implications',
      responseStrategy: 'Educate on what "basic" misses. Show examples of design-critical details.',
      reframeLanguage: 'Basic gives you walls and floors. It doesn\'t give you the molding profiles, the ceiling coffers, the structural deviations that will drive your design. You\'ll end up re-scanning.',
      walkAwaySignal: 'They truly don\'t need detail (simple box renovation, not their real project type)'
    },
    {
      buyerCode: 'BP-C',
      objectionPattern: 'Can\'t we just use the existing drawings?',
      underlyingConcern: 'Doesn\'t understand as-built reliability problem',
      responseStrategy: 'Share statistics on as-built accuracy. Reference specific discoveries.',
      reframeLanguage: 'Existing drawings are what someone intended to build, not what got built. On average, we find 15-20% deviation from drawings on buildings over 30 years old. That\'s not a rounding error—that\'s a liability.',
      walkAwaySignal: 'They\'re looking for you to validate skipping documentation'
    },
  ];

  for (const play of plays) {
    await db.insert(negotiationPlaybook).values(play);
  }

  console.log('Negotiation Playbook seeded');
}

export async function seedAllBuyerIntelligence() {
  console.log('Starting Buyer Intelligence Engine seed...');
  await seedBuyerPersonas();
  await seedBrandVoices();
  await seedSolutionMappings();
  await seedNegotiationPlaybook();
  console.log('All Buyer Intelligence Engine data seeded');
}
