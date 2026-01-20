// Proposal feature exports
export { ProposalTemplateList } from "./components/ProposalTemplateList";
export { ProposalLayoutEditor } from "./components/ProposalLayoutEditor";
export { SectionPanel } from "./components/SectionPanel";
export { ProposalPreview } from "./components/ProposalPreview";

// Hooks
export {
    useProposalTemplates,
    useGroupedTemplates,
    useTemplateGroups,
    useTemplateGroup,
    substituteVariables,
    buildDefaultSections,
    CATEGORY_LABELS,
    CATEGORY_ORDER,
} from "./hooks/useProposalTemplates";
export type { ProposalSection } from "./hooks/useProposalTemplates";
