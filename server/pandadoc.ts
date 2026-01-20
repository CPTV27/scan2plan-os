import FormData from 'form-data';

const PANDADOC_API_KEY = process.env.PANDADOC_API_KEY;
const PANDADOC_BASE_URL = 'https://api.pandadoc.com/public/v1';

interface CreateDocumentOptions {
  name: string;
  pdfBuffer: Buffer;
  recipientEmail: string;
  recipientName: string;
  recipientRole?: string;
}

interface PandaDocDocument {
  id: string;
  name: string;
  status: string;
  date_created: string;
  date_modified: string;
  uuid: string;
}

interface PandaDocSendResponse {
  id: string;
  status: string;
  uuid: string;
}

interface PandaDocStatusResponse {
  id: string;
  name: string;
  status: string;
  date_created: string;
  date_modified: string;
  date_completed?: string;
  recipients: Array<{
    email: string;
    first_name: string;
    last_name: string;
    role: string;
    has_completed: boolean;
  }>;
}

export async function createDocumentFromPdf(options: CreateDocumentOptions): Promise<PandaDocDocument> {
  const { name, pdfBuffer, recipientEmail, recipientName, recipientRole = 'signer' } = options;

  if (!PANDADOC_API_KEY) {
    throw new Error('PANDADOC_API_KEY is not configured');
  }

  const formData = new FormData();
  formData.append('file', pdfBuffer, { filename: `${name}.pdf`, contentType: 'application/pdf' });
  formData.append('name', name);
  formData.append('recipients', JSON.stringify([
    {
      email: recipientEmail,
      first_name: recipientName.split(' ')[0],
      last_name: recipientName.split(' ').slice(1).join(' ') || '',
      role: recipientRole,
    }
  ]));
  formData.append('parse_form_fields', 'false');

  const response = await fetch(`${PANDADOC_BASE_URL}/documents`, {
    method: 'POST',
    headers: {
      'Authorization': `API-Key ${PANDADOC_API_KEY}`,
      ...formData.getHeaders(),
    },
    body: formData as unknown as BodyInit,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`PandaDoc create document failed: ${error}`);
  }

  const document = await response.json() as PandaDocDocument;
  return document;
}

export async function sendDocument(documentId: string, message?: string, subject?: string): Promise<PandaDocSendResponse> {
  if (!PANDADOC_API_KEY) {
    throw new Error('PANDADOC_API_KEY is not configured');
  }

  const response = await fetch(`${PANDADOC_BASE_URL}/documents/${documentId}/send`, {
    method: 'POST',
    headers: {
      'Authorization': `API-Key ${PANDADOC_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: message || 'Please review and sign the attached proposal.',
      subject: subject || 'Proposal Ready for Signature',
      silent: false,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`PandaDoc send failed: ${error}`);
  }

  return response.json() as Promise<PandaDocSendResponse>;
}

export async function getDocumentStatus(documentId: string): Promise<PandaDocStatusResponse> {
  if (!PANDADOC_API_KEY) {
    throw new Error('PANDADOC_API_KEY is not configured');
  }

  const response = await fetch(`${PANDADOC_BASE_URL}/documents/${documentId}`, {
    headers: {
      'Authorization': `API-Key ${PANDADOC_API_KEY}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`PandaDoc get status failed: ${error}`);
  }

  return response.json() as Promise<PandaDocStatusResponse>;
}

export async function waitForDocumentReady(documentId: string, maxWaitMs = 30000, pollIntervalMs = 2000): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitMs) {
    const status = await getDocumentStatus(documentId);
    
    if (status.status === 'document.draft') {
      return true;
    }
    
    if (status.status === 'document.uploaded') {
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
      continue;
    }
    
    if (status.status.includes('error') || status.status.includes('failed')) {
      throw new Error(`Document processing failed: ${status.status}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }
  
  throw new Error('Timed out waiting for document to be ready');
}
