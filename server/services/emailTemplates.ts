
// Helper for currency formatting
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Helper for date formatting
export function formatDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// CPQ Building type ID to name mapping
export const CPQ_BUILDING_TYPE_NAMES: Record<string, string> = {
  "1": "Residential - Single Family",
  "2": "Residential - Multi Family",
  "3": "Residential - Luxury",
  "4": "Commercial / Office",
  "5": "Retail / Hospitality",
  "6": "Industrial / Warehouse",
  "7": "Institutional / Educational",
  "8": "Healthcare",
  "9": "Historic / Heritage",
  "10": "Infrastructure",
};

export const SCOPE_NAMES: Record<string, string> = {
  "full": "Full Building (Interior + Exterior)",
  "interior": "Interior Only",
  "exterior": "Exterior Only",
  "roof": "Roof/Facades",
  "facade": "Facade Only",
};

// Payment terms display names
export const PAYMENT_TERMS_NAMES: Record<string, string> = {
  "standard": "Due on Receipt",
  "prepaid": "Prepaid (5% discount)",
  "partner": "Partner Terms (10% discount)",
  "owner": "Owner Terms (hold if delay)",
  "50/50": "50% Deposit / 50% on Completion",
  "net15": "Net 15",
  "net30": "Net 30",
  "net45": "Net 45",
  "net60": "Net 60",
  "net90": "Net 90",
};

export function generateProposalEmailHtml(lead: any, quote: any): string {
  const clientName = lead.contactName?.split(' ')[0] || lead.clientName || 'Valued Client';
  const projectName = lead.projectName || lead.clientName || 'Your Project';
  const projectAddress = lead.projectAddress || '';
  const quoteNumber = quote.quoteNumber;
  const quoteDate = formatDate(quote.createdAt);

  const pricingData = quote.lineItems || quote.pricingBreakdown || {};
  const totalPrice = quote.totalPrice || quote.price || 0;

  // Format payment terms
  const paymentTermsKey = quote.paymentTerms || 'standard';
  const paymentTermsDisplay = PAYMENT_TERMS_NAMES[paymentTermsKey] || PAYMENT_TERMS_NAMES['standard'];

  // Extract items by category
  const scanningItems = (pricingData.items || []).filter((i: any) => i.category === 'scanning');
  const modelingItems = (pricingData.items || []).filter((i: any) => i.category === 'modeling');
  const travelItems = (pricingData.items || []).filter((i: any) => i.category === 'travel');
  const riskItems = (pricingData.items || []).filter((i: any) => i.category === 'risk');
  const adjustmentItems = (pricingData.items || []).filter((i: any) => i.category === 'adjustment');

  // Format areas for table
  const areas = quote.scopeAreas || [];
  const scopeTableRows = areas.map((area: any) => {
    const buildingType = CPQ_BUILDING_TYPE_NAMES[area.buildingType] || area.buildingType;
    const scope = SCOPE_NAMES[area.scope] || area.scope;
    const disciplines = Array.isArray(area.disciplines)
      ? area.disciplines.map((d: string) => d.charAt(0).toUpperCase() + d.slice(1)).join(', ')
      : area.disciplines;

    return `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 12px; color: #4b5563;">${area.name || 'Main Area'} (${buildingType})</td>
        <td style="padding: 12px; color: #4b5563;">${scope}</td>
        <td style="padding: 12px; color: #4b5563;">${disciplines}</td>
        <td style="padding: 12px; text-align: right; color: #111827; font-weight: 500;">${Number(area.sqft).toLocaleString()} sqft</td>
      </tr>
    `;
  }).join('');

  // Helper for item rows
  const buildItemRows = (items: any[]) => items.map((item: any) =>
    `<tr style="border-bottom: 1px solid #f3f4f6;">
      <td style="padding: 8px 0; color: #4b5563;">${item.name}</td>
      <td style="padding: 8px 0; text-align: right; color: #111827;">${formatCurrency(item.price)}</td>
    </tr>`
  ).join('');

  // Additional services
  let servicesHtml = '';
  if (pricingData?.services?.length > 0) {
    servicesHtml = pricingData.services.map((svc: any) =>
      `<li style="margin: 4px 0;">${svc.name}: ${formatCurrency(svc.price)}</li>`
    ).join('');
  }

  // Build contact info section
  const contactName = lead.contactName;
  const contactEmail = lead.contactEmail;
  const contactPhone = lead.contactPhone;

  const hasContactInfo = contactName || contactEmail || contactPhone;
  const contactInfoHtml = hasContactInfo ? `
    <h3 style="color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; margin-top: 32px;">Project Contact</h3>
    <table style="width: 100%; margin: 16px 0; font-size: 14px;">
      ${contactName ? `<tr><td style="padding: 4px 0; color: #6b7280;">Contact:</td><td style="padding: 4px 0;"><strong>${contactName}</strong></td></tr>` : ''}
      ${contactEmail ? `<tr><td style="padding: 4px 0; color: #6b7280;">Email:</td><td style="padding: 4px 0;"><a href="mailto:${contactEmail}" style="color: #2563eb;">${contactEmail}</a></td></tr>` : ''}
      ${contactPhone ? `<tr><td style="padding: 4px 0; color: #6b7280;">Phone:</td><td style="padding: 4px 0;">${contactPhone}</td></tr>` : ''}
    </table>
  ` : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1f2937; max-width: 720px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
  <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); color: white; padding: 32px; border-radius: 12px 12px 0 0;">
    <h1 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 700;">Scan2Plan</h1>
    <p style="margin: 0; opacity: 0.9; font-size: 14px;">Precision 3D Laser Scanning & BIM Services</p>
  </div>
  
  <div style="background: white; padding: 32px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
    
    <!-- Quote Header with Number, Date, Address -->
    <div style="display: flex; justify-content: space-between; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e5e7eb;">
      <div>
        ${quoteNumber ? `<p style="margin: 0 0 4px 0; font-size: 14px; color: #6b7280;">Quote Number</p><p style="margin: 0; font-size: 16px; font-weight: 600;">${quoteNumber}</p>` : ''}
      </div>
      <div style="text-align: right;">
        ${quoteDate ? `<p style="margin: 0 0 4px 0; font-size: 14px; color: #6b7280;">Date</p><p style="margin: 0; font-size: 16px;">${quoteDate}</p>` : ''}
      </div>
    </div>
    
    <p style="font-size: 16px; margin-bottom: 16px;">Dear ${clientName},</p>
    
    <p>Thank you for the opportunity to provide a proposal for <strong>${projectName}</strong>.</p>
    ${projectAddress ? `<p style="margin: 8px 0 24px 0; color: #6b7280;"><strong>Project Location:</strong> ${projectAddress}</p>` : '<p style="margin-bottom: 24px;"></p>'}
    
    <p>Based on our discussions and site analysis, we are pleased to present the following scope and investment summary.</p>
    
    <div style="background: #f0f9ff; border-left: 4px solid #2563eb; padding: 20px; margin: 24px 0; border-radius: 0 8px 8px 0;">
      <h2 style="margin: 0 0 12px 0; color: #1e40af; font-size: 18px;">Project Investment</h2>
      <p style="margin: 0; font-size: 32px; font-weight: 700; color: #1e3a5f;">${formatCurrency(totalPrice)}</p>
      <p style="margin: 8px 0 0 0; font-size: 14px; color: #6b7280;">Payment Terms: ${paymentTermsDisplay}</p>
    </div>
    
    ${areas.length > 0 ? `
    <h3 style="color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; margin-top: 32px;">Scope of Work</h3>
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
      <thead>
        <tr style="background: #f3f4f6;">
          <th style="padding: 10px 12px; text-align: left; font-weight: 600;">Area / Building Type</th>
          <th style="padding: 10px 12px; text-align: left; font-weight: 600;">Scope / LOD</th>
          <th style="padding: 10px 12px; text-align: left; font-weight: 600;">Disciplines</th>
          <th style="padding: 10px 12px; text-align: right; font-weight: 600;">Size</th>
        </tr>
      </thead>
      <tbody>
        ${scopeTableRows}
      </tbody>
    </table>
    ` : ''}
    
    ${scanningItems.length > 0 ? `
    <h3 style="color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; margin-top: 32px;">Scanning Services</h3>
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
      <tbody>
        ${buildItemRows(scanningItems)}
      </tbody>
    </table>
    ` : ''}
    
    ${modelingItems.length > 0 ? `
    <h3 style="color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; margin-top: 32px;">Modeling Services</h3>
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
      <tbody>
        ${buildItemRows(modelingItems)}
      </tbody>
    </table>
    ` : ''}
    
    ${travelItems.length > 0 ? `
    <h4 style="color: #6b7280; margin: 16px 0 8px 0; font-size: 14px;">Travel</h4>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <tbody>
        ${buildItemRows(travelItems)}
      </tbody>
    </table>
    ` : ''}
    
    ${riskItems.length > 0 ? `
    <h4 style="color: #6b7280; margin: 16px 0 8px 0; font-size: 14px;">Site Conditions</h4>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <tbody>
        ${buildItemRows(riskItems)}
      </tbody>
    </table>
    ` : ''}
    
    ${adjustmentItems.length > 0 ? `
    <h4 style="color: #6b7280; margin: 16px 0 8px 0; font-size: 14px;">Adjustments</h4>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <tbody>
        ${buildItemRows(adjustmentItems)}
      </tbody>
    </table>
    ` : ''}
    
    ${servicesHtml ? `
    <h3 style="color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; margin-top: 32px;">Additional Services</h3>
    <ul style="padding-left: 20px; margin: 16px 0;">
      ${servicesHtml}
    </ul>
    ` : ''}
    
    ${contactInfoHtml}
    
    <div style="margin-top: 32px;">
      <h3 style="color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">What's Included</h3>
      <ul style="padding-left: 20px;">
        <li style="margin: 8px 0;">High-definition 3D laser scanning of all designated areas</li>
        <li style="margin: 8px 0;">Point cloud registration and processing</li>
        <li style="margin: 8px 0;">BIM/CAD deliverables per specified Level of Detail</li>
        <li style="margin: 8px 0;">Quality assurance review and final delivery</li>
      </ul>
    </div>
    
    <div style="background: #fef3c7; border: 1px solid #fbbf24; padding: 16px; border-radius: 8px; margin: 24px 0;">
      <p style="margin: 0; font-size: 14px;"><strong>Proposal Valid:</strong> This proposal is valid for 30 days from the date of this email.</p>
    </div>
    
    <p style="margin-top: 32px;">We're confident our precision scanning services will provide the foundation for your project's success. Please don't hesitate to reach out with any questions.</p>
    
    <p style="margin-top: 24px;">
      Best regards,<br>
      <strong>The Scan2Plan Team</strong>
    </p>
  </div>
  
  <div style="text-align: center; padding: 24px; color: #6b7280; font-size: 12px;">
    <p style="margin: 0;">Scan2Plan | Precision 3D Laser Scanning & BIM Services</p>
    <p style="margin: 4px 0;">Brooklyn, NY | info@scan2plan.io</p>
  </div>
</body>
</html>`;
}

export function generateProposalEmailText(lead: any, quote: any): string {
  const clientName = lead.contactName || lead.company || 'Valued Client';
  const projectName = lead.projectName || lead.clientName || 'Your Project';
  const totalPrice = quote?.pricingBreakdown?.totalPrice || quote?.price || 0;

  // Look up tracking URL or just use base domain as fallback if magic link not available
  const magicLink = process.env.APP_URL || "http://localhost:5000";

  return `SCAN2PLAN - Precision 3D Laser Scanning & BIM Services

Dear ${clientName},

Thank you for the opportunity to provide a proposal for ${projectName}. Based on our discussions and site analysis, we are pleased to present the following scope and investment summary.

PROJECT INVESTMENT: ${formatCurrency(totalPrice)}

WHAT'S INCLUDED:
- High-definition 3D laser scanning of all designated areas
- Point cloud registration and processing
- BIM/CAD deliverables per specified Level of Detail
- Quality assurance review and final delivery

This proposal is valid for 30 days from the date of this email.

We're confident our precision scanning services will provide the foundation for your project's success. Please don't hesitate to reach out with any questions.

Best regards,
The Scan2Plan Team

---
Scan2Plan | Brooklyn, NY | info@scan2plan.io`;
}
