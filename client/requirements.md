## Packages
recharts | Data visualization for sales pipeline charts
framer-motion | Smooth animations for page transitions and UI interactions
date-fns | Date formatting and manipulation for "staleness" calculations
clsx | Utility for constructing className strings conditionally
tailwind-merge | Utility for merging Tailwind CSS classes
lucide-react | Icon set (already in base, but ensuring it's noted for heavy usage)
@radix-ui/react-dialog | For modal dialogs (create/edit forms)
@radix-ui/react-popover | For dropdowns and date pickers
@radix-ui/react-select | For status and priority selection
@radix-ui/react-progress | For probability bars
@radix-ui/react-tabs | For organizing dashboard views
@radix-ui/react-switch | For toggles
@radix-ui/react-label | For form labels
@radix-ui/react-slot | For component composition
class-variance-authority | For component variants

## Notes
Tailwind Config - extend fontFamily:
fontFamily: {
  display: ["var(--font-display)"],
  body: ["var(--font-body)"],
  mono: ["var(--font-mono)"],
}
