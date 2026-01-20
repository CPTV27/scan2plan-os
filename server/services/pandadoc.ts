/**
 * PandaDoc API Integration Service
 * Handles document creation, sending, and status tracking
 */

import { log } from "../lib/logger";

const PANDADOC_API_BASE = 'https://api.pandadoc.com/public/v1';

interface PandaDocDocument {
  id: string;
  name: string;
  status: string;
  date_created: string;
  date_modified: string;
}

interface PandaDocApiInfo {
  email: string;
  membership: {
    workspace_id: string;
    workspace_name: string;
  };
}

/**
 * Check if PandaDoc API key is configured
 */
export function isPandaDocConfigured(): boolean {
  return !!process.env.PANDADOC_API_KEY;
}

/**
 * Get authorization header for PandaDoc API
 */
function getAuthHeader(): { Authorization: string } {
  const apiKey = process.env.PANDADOC_API_KEY;
  if (!apiKey) {
    throw new Error('PANDADOC_API_KEY not configured');
  }
  return { Authorization: `API-Key ${apiKey}` };
}

/**
 * Test the PandaDoc API connection
 */
export async function testConnection(): Promise<{ success: boolean; data?: PandaDocApiInfo; error?: string }> {
  try {
    if (!isPandaDocConfigured()) {
      return { success: false, error: 'PANDADOC_API_KEY not configured' };
    }

    const response = await fetch(`${PANDADOC_API_BASE}/members/current`, {
      method: 'GET',
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `API Error ${response.status}: ${errorText}` };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * List recent documents
 */
export async function listDocuments(count: number = 5): Promise<{ success: boolean; documents?: PandaDocDocument[]; error?: string }> {
  try {
    const response = await fetch(`${PANDADOC_API_BASE}/documents?count=${count}`, {
      method: 'GET',
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `API Error ${response.status}: ${errorText}` };
    }

    const data = await response.json();
    return { success: true, documents: data.results || [] };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Create a document from a template
 */
export async function createDocumentFromTemplate(
  templateId: string,
  name: string,
  recipients: Array<{ email: string; first_name: string; last_name: string; role: string }>,
  tokens?: Record<string, string>
): Promise<{ success: boolean; documentId?: string; error?: string }> {
  try {
    const payload = {
      name,
      template_uuid: templateId,
      recipients: recipients.map(r => ({
        email: r.email,
        first_name: r.first_name,
        last_name: r.last_name,
        role: r.role
      })),
      tokens: tokens ? Object.entries(tokens).map(([name, value]) => ({ name, value })) : []
    };

    const response = await fetch(`${PANDADOC_API_BASE}/documents`, {
      method: 'POST',
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `API Error ${response.status}: ${errorText}` };
    }

    const data = await response.json();
    return { success: true, documentId: data.id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Send a document for signing
 */
export async function sendDocument(
  documentId: string,
  message?: string,
  subject?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const payload: any = {};
    if (message) payload.message = message;
    if (subject) payload.subject = subject;

    const response = await fetch(`${PANDADOC_API_BASE}/documents/${documentId}/send`, {
      method: 'POST',
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `API Error ${response.status}: ${errorText}` };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Get document status
 */
export async function getDocumentStatus(documentId: string): Promise<{ success: boolean; status?: string; error?: string }> {
  try {
    const response = await fetch(`${PANDADOC_API_BASE}/documents/${documentId}`, {
      method: 'GET',
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `API Error ${response.status}: ${errorText}` };
    }

    const data = await response.json();
    return { success: true, status: data.status };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Upload a PDF file and create a document for signing
 */
export async function uploadPdfDocument(
  pdfBuffer: Buffer,
  filename: string,
  documentName: string,
  recipient: { email: string; firstName: string; lastName: string }
): Promise<{ success: boolean; documentId?: string; error?: string }> {
  try {
    if (!isPandaDocConfigured()) {
      return { success: false, error: 'PANDADOC_API_KEY not configured' };
    }

    // PandaDoc requires multipart/form-data for file uploads
    const FormData = (await import('form-data')).default;
    const form = new FormData();
    
    // Add the PDF file
    form.append('file', pdfBuffer, {
      filename,
      contentType: 'application/pdf'
    });
    
    // Add document metadata as JSON
    const metadata = {
      name: documentName,
      recipients: [
        {
          email: recipient.email,
          first_name: recipient.firstName,
          last_name: recipient.lastName,
          role: 'signer'
        }
      ],
      parse_form_fields: false
    };
    form.append('data', JSON.stringify(metadata));

    const response = await fetch(`${PANDADOC_API_BASE}/documents`, {
      method: 'POST',
      headers: {
        ...getAuthHeader(),
        ...form.getHeaders()
      },
      body: form as any
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `API Error ${response.status}: ${errorText}` };
    }

    const data = await response.json();
    return { success: true, documentId: data.id };
  } catch (error: any) {
    log(`ERROR: [PandaDoc] Upload error - ${error?.message || String(error)}`);
    return { success: false, error: error.message };
  }
}

/**
 * Get document details including signing link
 */
export async function getDocumentDetails(documentId: string): Promise<{ 
  success: boolean; 
  status?: string; 
  name?: string;
  dateCreated?: string;
  error?: string 
}> {
  try {
    const response = await fetch(`${PANDADOC_API_BASE}/documents/${documentId}`, {
      method: 'GET',
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `API Error ${response.status}: ${errorText}` };
    }

    const data = await response.json();
    return { 
      success: true, 
      status: data.status,
      name: data.name,
      dateCreated: data.date_created
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
