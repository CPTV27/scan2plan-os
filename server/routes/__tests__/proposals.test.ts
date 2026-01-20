/**
 * API Route Tests - Proposals
 * 
 * Tests for proposal template logic and variable substitution.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock template data - using string concat to avoid template literal issues with ${{}}
const mockTemplate = {
    id: 1,
    name: 'Executive Summary',
    slug: 'executive-summary',
    category: 'intro',
    content: '# Project Proposal for {{client_name}}\n\n## Project Overview\nThis proposal outlines the scope of work for {{project_name}} located at {{project_address}}.\n\n## Investment\nTotal project investment: ${{quote_total}}\n\n## Contact\nPrepared for: {{contact_name}}\nEmail: {{contact_email}}\n',
    variables: ['client_name', 'project_name', 'project_address', 'quote_total', 'contact_name', 'contact_email'],
    sortOrder: 1,
    isDefault: true,
};

const mockVariableValues = {
    client_name: 'Acme Corporation',
    project_name: 'Office Building Scan',
    project_address: '123 Main Street, New York, NY',
    quote_total: '45,000',
    contact_name: 'John Smith',
    contact_email: 'john@acme.com',
};

describe('Proposal Template Logic', () => {
    describe('Variable Extraction', () => {
        it('should extract all variables from template content', () => {
            const variablePattern = /\{\{(\w+)\}\}/g;
            const matches = [...mockTemplate.content.matchAll(variablePattern)];
            const extractedVars = matches.map(m => m[1]);

            expect(extractedVars).toContain('client_name');
            expect(extractedVars).toContain('project_name');
            expect(extractedVars).toContain('quote_total');
        });

        it('should match declared variables array', () => {
            const variablePattern = /\{\{(\w+)\}\}/g;
            const matches = [...mockTemplate.content.matchAll(variablePattern)];
            const extractedVars = [...new Set(matches.map(m => m[1]))];

            expect(extractedVars.sort()).toEqual(mockTemplate.variables.sort());
        });
    });

    describe('Variable Substitution', () => {
        function substituteVariables(content: string, values: Record<string, string>): string {
            let result = content;
            for (const [key, value] of Object.entries(values)) {
                result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
            }
            return result;
        }

        it('should replace all variable placeholders', () => {
            const result = substituteVariables(mockTemplate.content, mockVariableValues);

            expect(result).toContain('Acme Corporation');
            expect(result).toContain('Office Building Scan');
            expect(result).toContain('$45,000');
            expect(result).not.toContain('{{');
            expect(result).not.toContain('}}');
        });

        it('should handle missing variables gracefully', () => {
            const partialValues = {
                client_name: 'Test Client',
            };
            const result = substituteVariables(mockTemplate.content, partialValues);

            expect(result).toContain('Test Client');
            // Missing variables remain as placeholders
            expect(result).toContain('{{project_name}}');
        });

        it('should handle empty string values', () => {
            const valuesWithEmpty = {
                ...mockVariableValues,
                contact_email: '',
            };
            const result = substituteVariables(mockTemplate.content, valuesWithEmpty);

            expect(result).toContain('Email: \n');
        });
    });

    describe('Template Sorting', () => {
        const mockTemplates = [
            { ...mockTemplate, sortOrder: 3, category: 'scope' },
            { ...mockTemplate, sortOrder: 1, category: 'intro' },
            { ...mockTemplate, sortOrder: 2, category: 'pricing' },
        ];

        it('should sort templates by sortOrder', () => {
            const sorted = [...mockTemplates].sort((a, b) => a.sortOrder - b.sortOrder);

            expect(sorted[0].sortOrder).toBe(1);
            expect(sorted[1].sortOrder).toBe(2);
            expect(sorted[2].sortOrder).toBe(3);
        });

        it('should group templates by category', () => {
            const grouped: Record<string, typeof mockTemplates> = {};
            mockTemplates.forEach(t => {
                if (!grouped[t.category]) grouped[t.category] = [];
                grouped[t.category].push(t);
            });

            expect(Object.keys(grouped)).toContain('intro');
            expect(Object.keys(grouped)).toContain('scope');
            expect(Object.keys(grouped)).toContain('pricing');
        });
    });

    describe('Default Template Selection', () => {
        const templates = [
            { ...mockTemplate, id: 1, isDefault: true },
            { ...mockTemplate, id: 2, isDefault: false },
            { ...mockTemplate, id: 3, isDefault: true },
        ];

        it('should identify default templates', () => {
            const defaults = templates.filter(t => t.isDefault);
            expect(defaults.length).toBe(2);
        });

        it('should select first default when multiple exist', () => {
            const defaults = templates.filter(t => t.isDefault);
            const firstDefault = defaults[0];
            expect(firstDefault.id).toBe(1);
        });
    });
});

describe('Proposal Section Building', () => {
    it('should build sections with substituted content', () => {
        function buildSection(template: typeof mockTemplate, values: Record<string, string>) {
            let content = template.content;
            for (const [key, value] of Object.entries(values)) {
                content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
            }
            return {
                id: template.slug,
                name: template.name,
                content,
                included: true,
            };
        }

        const section = buildSection(mockTemplate, mockVariableValues);

        expect(section.id).toBe('executive-summary');
        expect(section.name).toBe('Executive Summary');
        expect(section.content).toContain('Acme Corporation');
        expect(section.included).toBe(true);
    });

    it('should combine multiple sections into full proposal', () => {
        const sections = [
            { id: 'cover', content: '# Cover Page', included: true },
            { id: 'summary', content: '# Summary', included: true },
            { id: 'scope', content: '# Scope', included: false },
        ];

        const fullProposal = sections
            .filter(s => s.included)
            .map(s => s.content)
            .join('\n\n---\n\n');

        expect(fullProposal).toContain('# Cover Page');
        expect(fullProposal).toContain('# Summary');
        expect(fullProposal).not.toContain('# Scope');
        expect(fullProposal).toContain('---');
    });
});

describe('Proposal PDF Metadata', () => {
    it('should generate valid filename', () => {
        const clientName = 'Acme Corporation';
        const date = new Date('2026-01-13');
        const filename = `Scan2Plan_Proposal_${clientName.replace(/\s+/g, '_')}_${date.toISOString().split('T')[0]}.pdf`;

        expect(filename).toBe('Scan2Plan_Proposal_Acme_Corporation_2026-01-13.pdf');
    });

    it('should sanitize special characters in filename', () => {
        const clientName = 'Test/Client: "Special" <Name>';
        const sanitized = clientName.replace(/[\\/:*?"<>|]/g, '_');

        expect(sanitized).toBe('Test_Client_ _Special_ _Name_');
        expect(sanitized).not.toContain('/');
        expect(sanitized).not.toContain(':');
    });
});
