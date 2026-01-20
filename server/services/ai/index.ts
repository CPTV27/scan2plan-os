export { aiClient, AIClient } from "./aiClient";
export { analyzeProjectScope, type ScopingResult, type ScopingSuggestion } from "./scopingAssistant";
export { analyzeDeal, type DealIntelligenceResult, type DealRisk, type PricingStrategy, type SimilarDeal } from "./dealIntelligence";
export { extractFromDocument, type DocumentExtractionResult, type ExtractedRequirement, type RiskFlag, type ContactInfo } from "./documentIntelligence";
export { processCPQChat, type CPQChatResult, type ExtractedCPQData, type ChatMessage } from "./naturalLanguageCPQ";
export { generateProposal, type ProposalResult, type ProposalSection } from "./proposalGenerator";
export { findSimilarProjects, createProjectSummary, findMatchingCaseStudies, type ProjectMatchResult, type SimilarProject } from "./projectMatcher";
export { getAIContext, formatContextForPrompt, type AIContext } from "./contextEngine";
