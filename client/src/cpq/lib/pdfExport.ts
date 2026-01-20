import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoUrl from '@assets/Scan2Plan_2021_logo_variations+[Recovered]-03_(1)_1768016434331.webp';

const COLORS = {
  primary: [59, 130, 246] as [number, number, number],
  text: [30, 41, 59] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  border: [226, 232, 240] as [number, number, number],
  success: [34, 197, 94] as [number, number, number],
  background: [248, 250, 252] as [number, number, number],
};

interface Area {
  id: string;
  name: string;
  buildingType: string;
  squareFeet: string;
  scope: string;
  disciplines: string[];
  disciplineLods: Record<string, string>;
}

interface PricingLineItem {
  label: string;
  value: number;
  isDiscount?: boolean;
  isTotal?: boolean;
  upteamCost?: number;
}

interface ProjectDetails {
  clientName: string;
  projectName: string;
  projectAddress: string;
  specificBuilding?: string;
  typeOfBuilding?: string;
  hasBasement?: boolean;
  hasAttic?: boolean;
  notes?: string;
}

interface UploadedFile {
  name: string;
  url: string;
  size: number;
}

interface ScopingData {
  bimDeliverable?: string[];
  bimDeliverableOther?: string;
  bimVersion?: string;
  customTemplate?: string;
  customTemplateOther?: string;
  sqftAssumptions?: string;
  assumedGrossMargin?: string;
  caveatsProfitability?: string;
  projectNotes?: string;
  mixedScope?: string;
  insuranceRequirements?: string;
  accountContact?: string;
  accountContactEmail?: string;
  accountContactPhone?: string;
  phoneNumber?: string;
  designProContact?: string;
  designProCompanyContact?: string;
  otherContact?: string;
  estimatedTimeline?: string;
  timelineNotes?: string;
  paymentTerms?: string;
  paymentTermsOther?: string;
  paymentNotes?: string;
  source?: string;
  sourceNote?: string;
  assist?: string;
  probabilityOfClosing?: string;
  projectStatus?: string;
  projectStatusOther?: string;
  tierAScanningCost?: string;
  tierAScanningCostOther?: string;
  tierAModelingCost?: string;
  tierAMargin?: string;
  proofLinks?: string;
  customTemplateFiles?: UploadedFile[];
  sqftAssumptionsFiles?: UploadedFile[];
  scopingDocuments?: UploadedFile[];
  ndaFiles?: UploadedFile[];
}

const BUILDING_TYPE_MAP: Record<string, string> = {
  "1": "Commercial - Simple",
  "2": "Residential - Standard",
  "3": "Residential - Luxury",
  "4": "Commercial / Office",
  "5": "Retail / Restaurants",
  "6": "Kitchen / Catering Facilities",
  "7": "Education",
  "8": "Hotel / Theatre / Museum",
  "9": "Hospitals / Mixed Use",
  "10": "Mechanical / Utility Rooms",
  "11": "Warehouse / Storage",
  "12": "Religious Buildings",
  "13": "Infrastructure / Roads / Bridges",
  "14": "Built Landscape",
  "15": "Natural Landscape",
  "16": "ACT",
};

const DISCIPLINE_MAP: Record<string, string> = {
  "architecture": "Architecture",
  "structure": "Structure",
  "mepf": "MEPF",
  "site": "Site/Topography",
};

const SCOPE_MAP: Record<string, string> = {
  "full": "Full Building",
  "interior": "Interior Only",
  "exterior": "Exterior Only",
  "roof": "Roof/Facades Only",
};

async function loadLogoAsBase64(): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
          } else {
            console.warn('Could not get canvas context for logo');
            resolve(null);
          }
        } catch (e) {
          console.warn('Failed to convert logo to base64:', e);
          resolve(null);
        }
      };
      img.onerror = () => {
        console.warn('Failed to load logo image');
        resolve(null);
      };
      img.src = logoUrl;
    } catch (e) {
      console.warn('Error in logo loading:', e);
      resolve(null);
    }
  });
}

function addHeader(doc: jsPDF, logoBase64: string | null, title: string, quoteNumber?: string) {
  const pageWidth = doc.internal.pageSize.getWidth();

  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', 20, 15, 50, 15);
    } catch (e) {
      doc.setFontSize(16);
      doc.setTextColor(...COLORS.primary);
      doc.text('Scan2Plan', 20, 25);
    }
  } else {
    doc.setFontSize(16);
    doc.setTextColor(...COLORS.primary);
    doc.text('Scan2Plan', 20, 25);
  }

  doc.setFontSize(10);
  doc.setTextColor(...COLORS.muted);
  doc.text('Professional Scan-to-BIM Services', pageWidth - 20, 20, { align: 'right' });
  doc.text('www.scan2plan.com', pageWidth - 20, 26, { align: 'right' });

  doc.setDrawColor(...COLORS.primary);
  doc.setLineWidth(0.5);
  doc.line(20, 38, pageWidth - 20, 38);

  doc.setFontSize(18);
  doc.setTextColor(...COLORS.text);
  doc.text(title, 20, 50);

  if (quoteNumber) {
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.muted);
    doc.text(`Quote #: ${quoteNumber}`, pageWidth - 20, 50, { align: 'right' });
  }

  doc.setFontSize(10);
  doc.setTextColor(...COLORS.muted);
  doc.text(`Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 20, 58);

  return 65;
}

function addFooter(doc: jsPDF) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageCount = doc.getNumberOfPages();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.3);
    doc.line(20, pageHeight - 20, pageWidth - 20, pageHeight - 20);

    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    doc.text('Scan2Plan - Professional Scan-to-BIM Services', 20, pageHeight - 12);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 20, pageHeight - 12, { align: 'right' });
  }
}

function addSectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFillColor(...COLORS.background);
  doc.rect(20, y - 4, doc.internal.pageSize.getWidth() - 40, 10, 'F');

  doc.setFontSize(11);
  doc.setTextColor(...COLORS.primary);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 24, y + 3);
  doc.setFont('helvetica', 'normal');

  return y + 14;
}

function addField(doc: jsPDF, label: string, value: string, y: number, pageWidth: number): number {
  if (!value || value === 'N/A') return y;

  doc.setFontSize(9);
  doc.setTextColor(...COLORS.muted);
  doc.text(label + ':', 24, y);

  doc.setTextColor(...COLORS.text);
  const maxWidth = pageWidth - 90;
  const lines = doc.splitTextToSize(value, maxWidth);
  doc.text(lines, 80, y);

  return y + (lines.length * 5) + 3;
}

function checkPageBreak(doc: jsPDF, currentY: number, neededSpace: number = 40): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (currentY + neededSpace > pageHeight - 30) {
    doc.addPage();
    return 30;
  }
  return currentY;
}

function addAttachmentsSection(doc: jsPDF, scopingData: ScopingData, y: number, pageWidth: number): number {
  const allFiles: { category: string; files: UploadedFile[] }[] = [];

  if (scopingData.customTemplateFiles && scopingData.customTemplateFiles.length > 0) {
    allFiles.push({ category: 'Custom Templates', files: scopingData.customTemplateFiles });
  }
  if (scopingData.sqftAssumptionsFiles && scopingData.sqftAssumptionsFiles.length > 0) {
    allFiles.push({ category: 'SQFT Assumptions', files: scopingData.sqftAssumptionsFiles });
  }
  if (scopingData.scopingDocuments && scopingData.scopingDocuments.length > 0) {
    allFiles.push({ category: 'Scoping Documents', files: scopingData.scopingDocuments });
  }
  if (scopingData.ndaFiles && scopingData.ndaFiles.length > 0) {
    allFiles.push({ category: 'NDA Documents', files: scopingData.ndaFiles });
  }

  if (allFiles.length === 0) return y;

  y = checkPageBreak(doc, y, 50);
  y = addSectionTitle(doc, 'ATTACHMENTS', y);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  for (const { category, files } of allFiles) {
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.muted);
    doc.text(category + ':', 24, y);
    y += 5;

    for (const file of files) {
      y = checkPageBreak(doc, y, 10);

      const fullUrl = file.url.startsWith('http') ? file.url : `${baseUrl}${file.url}`;
      const fileSizeKB = Math.round(file.size / 1024);
      const displayText = `${file.name} (${fileSizeKB} KB)`;

      doc.setTextColor(...COLORS.primary);
      doc.setFontSize(8);
      doc.textWithLink(displayText, 30, y, { url: fullUrl });

      y += 5;
    }
    y += 3;
  }

  doc.setTextColor(...COLORS.muted);
  doc.setFontSize(7);
  doc.text('Note: Click on file names to open attachments. Files are also included in the export zip.', 24, y);
  y += 8;

  return y;
}

export async function generateScopePDF(
  projectDetails: ProjectDetails,
  areas: Area[],
  risks: string[],
  dispatch: string,
  distance: number | null,
  distanceCalculated: boolean,
  services: Record<string, number>,
  scopingData: ScopingData,
  quoteNumber?: string,
  returnBlob?: boolean
): Promise<Blob | void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  const logoBase64 = await loadLogoAsBase64();

  let y = addHeader(doc, logoBase64, 'Scoping Document', quoteNumber);

  y = addSectionTitle(doc, 'PROJECT INFORMATION', y);
  y = addField(doc, 'Client', projectDetails.clientName || 'N/A', y, pageWidth);
  y = addField(doc, 'Project', projectDetails.projectName || 'N/A', y, pageWidth);
  y = addField(doc, 'Address', projectDetails.projectAddress || 'N/A', y, pageWidth);
  if (projectDetails.specificBuilding) {
    y = addField(doc, 'Building', projectDetails.specificBuilding, y, pageWidth);
  }
  if (projectDetails.typeOfBuilding) {
    y = addField(doc, 'Type', projectDetails.typeOfBuilding, y, pageWidth);
  }
  if (projectDetails.hasBasement || projectDetails.hasAttic) {
    const features = [];
    if (projectDetails.hasBasement) features.push('Basement');
    if (projectDetails.hasAttic) features.push('Attic');
    y = addField(doc, 'Features', features.join(', '), y, pageWidth);
  }
  if (projectDetails.notes) {
    y = addField(doc, 'Notes', projectDetails.notes, y, pageWidth);
  }

  y += 5;
  y = checkPageBreak(doc, y, 60);

  if (areas.length > 0) {
    y = addSectionTitle(doc, 'AREAS & DISCIPLINES', y);

    const areaRows = areas.map((area, index) => {
      const isLandscape = area.buildingType === "14" || area.buildingType === "15";
      const buildingType = BUILDING_TYPE_MAP[area.buildingType] || area.buildingType;
      const scope = SCOPE_MAP[area.scope] || area.scope;

      let sizeDisplay = '';
      if (isLandscape) {
        const acres = parseFloat(area.squareFeet) || 0;
        sizeDisplay = `${acres} acres`;
      } else {
        const sqft = parseInt(area.squareFeet) || 0;
        sizeDisplay = `${sqft.toLocaleString()} sqft`;
      }

      const disciplines = area.disciplines.map(d => {
        const label = DISCIPLINE_MAP[d] || d;
        const lod = area.disciplineLods[d];
        return lod ? `${label} (LOD ${lod})` : label;
      }).join(', ') || 'None';

      return [
        area.name || `Area ${index + 1}`,
        buildingType,
        sizeDisplay,
        scope,
        disciplines
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [['Area Name', 'Building Type', 'Size', 'Scope', 'Disciplines']],
      body: areaRows,
      theme: 'striped',
      headStyles: {
        fillColor: COLORS.primary,
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold',
      },
      bodyStyles: {
        fontSize: 8,
        textColor: COLORS.text,
      },
      alternateRowStyles: {
        fillColor: COLORS.background,
      },
      margin: { left: 20, right: 20 },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 35 },
        2: { cellWidth: 25 },
        3: { cellWidth: 30 },
        4: { cellWidth: 'auto' },
      },
    });

    y = (doc as any).lastAutoTable.finalY + 10;
  }

  y = checkPageBreak(doc, y, 50);
  y = addSectionTitle(doc, 'DELIVERABLES', y);
  if (scopingData.bimDeliverable && scopingData.bimDeliverable.length > 0) {
    let deliverables = scopingData.bimDeliverable.join(', ');
    if (scopingData.bimDeliverable.includes('Other') && scopingData.bimDeliverableOther) {
      deliverables += ` (${scopingData.bimDeliverableOther})`;
    }
    y = addField(doc, 'BIM Deliverable', deliverables, y, pageWidth);
  }
  if (scopingData.bimVersion) {
    y = addField(doc, 'BIM Version', scopingData.bimVersion, y, pageWidth);
  }
  if (scopingData.customTemplate) {
    let template = scopingData.customTemplate;
    if (scopingData.customTemplate === 'other' && scopingData.customTemplateOther) {
      template = scopingData.customTemplateOther;
    }
    y = addField(doc, 'Template', template, y, pageWidth);
  }

  y = checkPageBreak(doc, y, 50);
  y = addSectionTitle(doc, 'CONTACTS', y);
  if (scopingData.accountContact) {
    y = addField(doc, 'Account Contact', scopingData.accountContact, y, pageWidth);
    if (scopingData.accountContactEmail) {
      y = addField(doc, 'Email', scopingData.accountContactEmail, y, pageWidth);
    }
    if (scopingData.accountContactPhone) {
      y = addField(doc, 'Phone', scopingData.accountContactPhone, y, pageWidth);
    }
  }
  if (scopingData.designProContact) {
    y = addField(doc, 'Design Pro', scopingData.designProContact, y, pageWidth);
  }
  if (scopingData.otherContact) {
    y = addField(doc, 'Other Contact', scopingData.otherContact, y, pageWidth);
  }

  y = checkPageBreak(doc, y, 50);
  y = addSectionTitle(doc, 'RISK FACTORS', y);
  if (risks.length > 0) {
    const riskLabels: Record<string, string> = {
      'flood': 'Flood (+7%)',
      'occupied': 'Occupied (+15%)',
      'hazardous': 'Hazardous (+25%)',
      'noPower': 'No Power (+20%)',
    };
    const riskList = risks.map(r => riskLabels[r] || r).join(', ');
    y = addField(doc, 'Active Risks', riskList, y, pageWidth);
  } else {
    y = addField(doc, 'Risk Factors', 'None selected', y, pageWidth);
  }

  y = checkPageBreak(doc, y, 50);
  y = addSectionTitle(doc, 'TRAVEL & DISPATCH', y);
  const dispatchLabels: Record<string, string> = {
    'troy': 'Troy, NY',
    'woodstock': 'Woodstock, NY',
    'brooklyn': 'Brooklyn, NY',
  };
  y = addField(doc, 'Dispatch', dispatchLabels[dispatch] || dispatch, y, pageWidth);
  if (distanceCalculated && distance !== null) {
    y = addField(doc, 'Distance', `${distance} miles`, y, pageWidth);
    const ratePerMile = dispatch === 'brooklyn' ? 4 : 3;
    y = addField(doc, 'Travel Rate', `$${ratePerMile}/mile`, y, pageWidth);
  }

  const serviceEntries = Object.entries(services).filter(([_, qty]) => qty > 0);
  if (serviceEntries.length > 0) {
    y = checkPageBreak(doc, y, 50);
    y = addSectionTitle(doc, 'ADDITIONAL SERVICES', y);
    serviceEntries.forEach(([serviceId, quantity]) => {
      let serviceLabel = '';
      if (serviceId === 'georeferencing') serviceLabel = 'Georeferencing ($1,000 flat)';
      else if (serviceId === 'cadDeliverable') serviceLabel = `CAD Deliverable (${quantity} sets)`;
      else if (serviceId === 'matterport') serviceLabel = `Matterport Virtual Tours (${quantity.toLocaleString()} sqft)`;
      else if (serviceId === 'actSqft') serviceLabel = `ACT Modeling (${quantity.toLocaleString()} sqft)`;
      else if (serviceId === 'scanningFullDay') serviceLabel = 'Scanning & Registration - Full Day';
      else if (serviceId === 'scanningHalfDay') serviceLabel = 'Scanning & Registration - Half Day';
      else serviceLabel = serviceId;

      y = addField(doc, 'Service', serviceLabel, y, pageWidth);
    });
  }

  y = checkPageBreak(doc, y, 50);
  y = addSectionTitle(doc, 'TIMELINE & PAYMENT', y);
  if (scopingData.estimatedTimeline) {
    y = addField(doc, 'Timeline', scopingData.estimatedTimeline, y, pageWidth);
  }
  if (scopingData.timelineNotes) {
    y = addField(doc, 'Timeline Notes', scopingData.timelineNotes, y, pageWidth);
  }
  if (scopingData.paymentTerms) {
    let terms = scopingData.paymentTerms;
    if (scopingData.paymentTerms === 'other' && scopingData.paymentTermsOther) {
      terms = scopingData.paymentTermsOther;
    }
    y = addField(doc, 'Payment Terms', terms, y, pageWidth);
  }
  if (scopingData.paymentNotes) {
    y = addField(doc, 'Payment Notes', scopingData.paymentNotes, y, pageWidth);
  }

  if (scopingData.sqftAssumptions || scopingData.projectNotes || scopingData.mixedScope || scopingData.insuranceRequirements) {
    y = checkPageBreak(doc, y, 50);
    y = addSectionTitle(doc, 'ASSUMPTIONS & NOTES', y);
    if (scopingData.sqftAssumptions) {
      y = addField(doc, 'SQFT Assumptions', scopingData.sqftAssumptions, y, pageWidth);
    }
    if (scopingData.projectNotes) {
      y = addField(doc, 'Project Notes', scopingData.projectNotes, y, pageWidth);
    }
    if (scopingData.mixedScope) {
      y = addField(doc, 'Mixed Scope', scopingData.mixedScope, y, pageWidth);
    }
    if (scopingData.insuranceRequirements) {
      y = addField(doc, 'Insurance', scopingData.insuranceRequirements, y, pageWidth);
    }
  }

  y = addAttachmentsSection(doc, scopingData, y, pageWidth);

  addFooter(doc);

  if (returnBlob) {
    return doc.output('blob');
  }

  const filename = `scope-${projectDetails.projectName || 'draft'}-${Date.now()}.pdf`;
  doc.save(filename);
}

export async function generateQuoteClientPDF(
  projectDetails: ProjectDetails,
  pricingItems: PricingLineItem[],
  quoteNumber?: string
): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  const logoBase64 = await loadLogoAsBase64();

  let y = addHeader(doc, logoBase64, 'Quote', quoteNumber);

  y = addSectionTitle(doc, 'PROJECT INFORMATION', y);
  y = addField(doc, 'Client', projectDetails.clientName || 'N/A', y, pageWidth);
  y = addField(doc, 'Project', projectDetails.projectName || 'N/A', y, pageWidth);
  y = addField(doc, 'Address', projectDetails.projectAddress || 'N/A', y, pageWidth);
  if (projectDetails.typeOfBuilding) {
    y = addField(doc, 'Building Type', projectDetails.typeOfBuilding, y, pageWidth);
  }

  y += 10;
  y = addSectionTitle(doc, 'PRICING SUMMARY', y);

  const grandTotalItem = pricingItems.find(item => item.isTotal);
  const effectivePriceItem = pricingItems.find(item => item.label.includes("Effective Price"));

  if (grandTotalItem) {
    doc.setFontSize(14);
    doc.setTextColor(...COLORS.text);
    doc.setFont('helvetica', 'bold');
    doc.text('Grand Total:', 24, y);
    doc.text(`$${grandTotalItem.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, pageWidth - 24, y, { align: 'right' });
    y += 10;
    doc.setFont('helvetica', 'normal');
  }

  if (effectivePriceItem) {
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.success);
    doc.text(effectivePriceItem.label + ':', 24, y);
    doc.text(`$${effectivePriceItem.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, pageWidth - 24, y, { align: 'right' });
    y += 8;
  }

  if (projectDetails.notes) {
    y += 10;
    y = addSectionTitle(doc, 'NOTES', y);
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.text);
    const lines = doc.splitTextToSize(projectDetails.notes, pageWidth - 48);
    doc.text(lines, 24, y);
    y += lines.length * 5;
  }

  y += 20;
  doc.setFillColor(...COLORS.background);
  doc.rect(20, y - 5, pageWidth - 40, 35, 'F');

  doc.setFontSize(9);
  doc.setTextColor(...COLORS.muted);
  doc.text('Terms & Conditions:', 24, y + 3);
  doc.setFontSize(8);
  const terms = [
    '• Quote valid for 30 days from date of issue',
    '• Payment terms: 50% deposit, 50% upon completion',
    '• Scope modifications may affect final pricing',
  ];
  terms.forEach((term, i) => {
    doc.text(term, 24, y + 12 + (i * 6));
  });

  addFooter(doc);

  const filename = `quote-${projectDetails.projectName || 'draft'}-${Date.now()}.pdf`;
  doc.save(filename);
}

export async function generateQuoteInternalPDF(
  projectDetails: ProjectDetails,
  pricingItems: PricingLineItem[],
  totalClientPrice: number,
  totalUpteamCost: number,
  quoteNumber?: string
): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  const logoBase64 = await loadLogoAsBase64();

  let y = addHeader(doc, logoBase64, 'Quote - Internal', quoteNumber);

  y = addSectionTitle(doc, 'PROJECT INFORMATION', y);
  y = addField(doc, 'Client', projectDetails.clientName || 'N/A', y, pageWidth);
  y = addField(doc, 'Project', projectDetails.projectName || 'N/A', y, pageWidth);
  y = addField(doc, 'Address', projectDetails.projectAddress || 'N/A', y, pageWidth);
  if (projectDetails.typeOfBuilding) {
    y = addField(doc, 'Building Type', projectDetails.typeOfBuilding, y, pageWidth);
  }

  y += 5;
  y = addSectionTitle(doc, 'PRICING BREAKDOWN', y);

  const nonTotalItems = pricingItems.filter(item => !item.isTotal);
  const rows = nonTotalItems.map(item => [
    item.label,
    item.isDiscount ? `-$${item.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}` :
      `$${item.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Description', 'Amount']],
    body: rows,
    theme: 'striped',
    headStyles: {
      fillColor: COLORS.primary,
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 9,
      textColor: COLORS.text,
    },
    alternateRowStyles: {
      fillColor: COLORS.background,
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 40, halign: 'right' },
    },
    margin: { left: 20, right: 20 },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  const grandTotalItem = pricingItems.find(item => item.isTotal);
  if (grandTotalItem) {
    doc.setFillColor(...COLORS.primary);
    doc.rect(pageWidth - 100, y - 2, 80, 12, 'F');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('Grand Total:', pageWidth - 96, y + 6);
    doc.text(`$${grandTotalItem.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, pageWidth - 24, y + 6, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += 20;
  }

  y = checkPageBreak(doc, y, 80);
  y = addSectionTitle(doc, 'COST SUMMARY (Internal)', y);

  doc.setFontSize(10);
  doc.setTextColor(...COLORS.text);
  y = addField(doc, 'Total Client Price', `$${totalClientPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, y, pageWidth);
  y = addField(doc, 'Total Upteam Cost', `$${totalUpteamCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, y, pageWidth);

  const profitMargin = totalClientPrice - totalUpteamCost;
  const profitMarginPercent = totalUpteamCost > 0 ? ((profitMargin / totalUpteamCost) * 100) : 0;

  y += 5;
  doc.setFillColor(34, 197, 94, 0.1);
  doc.rect(20, y - 3, pageWidth - 40, 16, 'F');

  doc.setFontSize(11);
  doc.setTextColor(...COLORS.success);
  doc.setFont('helvetica', 'bold');
  doc.text('Profit Margin:', 24, y + 5);
  doc.text(`$${profitMargin.toLocaleString('en-US', { minimumFractionDigits: 2 })} (${profitMarginPercent.toFixed(1)}% markup)`, pageWidth - 24, y + 5, { align: 'right' });
  doc.setFont('helvetica', 'normal');

  if (projectDetails.notes) {
    y += 25;
    y = addSectionTitle(doc, 'NOTES', y);
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.text);
    const lines = doc.splitTextToSize(projectDetails.notes, pageWidth - 48);
    doc.text(lines, 24, y);
  }

  addFooter(doc);

  const filename = `quote-internal-${projectDetails.projectName || 'draft'}-${Date.now()}.pdf`;
  doc.save(filename);
}

export async function generateCRMPDF(
  projectDetails: ProjectDetails,
  scopingData: ScopingData,
  quoteNumber?: string
): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  const logoBase64 = await loadLogoAsBase64();

  let y = addHeader(doc, logoBase64, 'CRM Data', quoteNumber);

  y = addSectionTitle(doc, 'PROJECT INFORMATION', y);
  y = addField(doc, 'Client', projectDetails.clientName || 'N/A', y, pageWidth);
  y = addField(doc, 'Project', projectDetails.projectName || 'N/A', y, pageWidth);

  y += 5;
  y = addSectionTitle(doc, 'LEAD TRACKING', y);
  if (scopingData.source) {
    y = addField(doc, 'Source', scopingData.source, y, pageWidth);
    if (scopingData.sourceNote) {
      y = addField(doc, 'Source Note', scopingData.sourceNote, y, pageWidth);
    }
  }
  if (scopingData.assist) {
    y = addField(doc, 'Assist', scopingData.assist, y, pageWidth);
  }
  if (scopingData.probabilityOfClosing) {
    y = addField(doc, 'Probability', `${scopingData.probabilityOfClosing}%`, y, pageWidth);
  }
  if (scopingData.projectStatus) {
    let status = scopingData.projectStatus;
    if (scopingData.projectStatus === 'other' && scopingData.projectStatusOther) {
      status = scopingData.projectStatusOther;
    }
    y = addField(doc, 'Status', status, y, pageWidth);
  }

  y += 5;
  y = addSectionTitle(doc, 'TIER A PRICING', y);
  if (scopingData.tierAScanningCost) {
    let cost = scopingData.tierAScanningCost;
    if (scopingData.tierAScanningCost === 'other' && scopingData.tierAScanningCostOther) {
      cost = scopingData.tierAScanningCostOther;
    }
    y = addField(doc, 'Scanning Cost', cost, y, pageWidth);
  }
  if (scopingData.tierAModelingCost) {
    y = addField(doc, 'Modeling Cost', scopingData.tierAModelingCost, y, pageWidth);
  }
  if (scopingData.tierAMargin) {
    y = addField(doc, 'Margin', scopingData.tierAMargin, y, pageWidth);
  }

  if (scopingData.proofLinks) {
    y += 5;
    y = addSectionTitle(doc, 'PROOF LINKS', y);
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.text);
    const lines = doc.splitTextToSize(scopingData.proofLinks, pageWidth - 48);
    doc.text(lines, 24, y);
  }

  addFooter(doc);

  const filename = `crm-${projectDetails.projectName || 'draft'}-${Date.now()}.pdf`;
  doc.save(filename);
}

export async function generateScopeQuotePDF(
  projectDetails: ProjectDetails,
  areas: Area[],
  risks: string[],
  dispatch: string,
  distance: number | null,
  distanceCalculated: boolean,
  services: Record<string, number>,
  scopingData: ScopingData,
  pricingItems: PricingLineItem[],
  isInternal: boolean,
  totalClientPrice?: number,
  totalUpteamCost?: number,
  quoteNumber?: string,
  returnBlob?: boolean
): Promise<Blob | void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  const logoBase64 = await loadLogoAsBase64();

  const title = isInternal ? 'Scope & Quote - Internal' : 'Scope & Quote';
  let y = addHeader(doc, logoBase64, title, quoteNumber);

  y = addSectionTitle(doc, 'PROJECT INFORMATION', y);
  y = addField(doc, 'Client', projectDetails.clientName || 'N/A', y, pageWidth);
  y = addField(doc, 'Project', projectDetails.projectName || 'N/A', y, pageWidth);
  y = addField(doc, 'Address', projectDetails.projectAddress || 'N/A', y, pageWidth);
  if (projectDetails.typeOfBuilding) {
    y = addField(doc, 'Building Type', projectDetails.typeOfBuilding, y, pageWidth);
  }

  y += 5;

  if (areas.length > 0) {
    y = checkPageBreak(doc, y, 60);
    y = addSectionTitle(doc, 'AREAS & DISCIPLINES', y);

    const areaRows = areas.map((area, index) => {
      const isLandscape = area.buildingType === "14" || area.buildingType === "15";
      const buildingType = BUILDING_TYPE_MAP[area.buildingType] || area.buildingType;
      const scope = SCOPE_MAP[area.scope] || area.scope;

      let sizeDisplay = '';
      if (isLandscape) {
        const acres = parseFloat(area.squareFeet) || 0;
        sizeDisplay = `${acres} acres`;
      } else {
        const sqft = parseInt(area.squareFeet) || 0;
        sizeDisplay = `${sqft.toLocaleString()} sqft`;
      }

      const disciplines = area.disciplines.map(d => {
        const label = DISCIPLINE_MAP[d] || d;
        const lod = area.disciplineLods[d];
        return lod ? `${label} (LOD ${lod})` : label;
      }).join(', ') || 'None';

      return [
        area.name || `Area ${index + 1}`,
        buildingType,
        sizeDisplay,
        scope,
        disciplines
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [['Area', 'Type', 'Size', 'Scope', 'Disciplines']],
      body: areaRows,
      theme: 'striped',
      headStyles: {
        fillColor: COLORS.primary,
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold',
      },
      bodyStyles: {
        fontSize: 7,
        textColor: COLORS.text,
      },
      alternateRowStyles: {
        fillColor: COLORS.background,
      },
      margin: { left: 20, right: 20 },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 30 },
        2: { cellWidth: 22 },
        3: { cellWidth: 25 },
        4: { cellWidth: 'auto' },
      },
    });

    y = (doc as any).lastAutoTable.finalY + 10;
  }

  y = checkPageBreak(doc, y, 80);
  y = addSectionTitle(doc, 'PRICING', y);

  if (isInternal) {
    const nonTotalItems = pricingItems.filter(item => !item.isTotal);
    const rows = nonTotalItems.map(item => [
      item.label,
      item.isDiscount ? `-$${item.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}` :
        `$${item.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Description', 'Amount']],
      body: rows,
      theme: 'striped',
      headStyles: {
        fillColor: COLORS.primary,
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold',
      },
      bodyStyles: {
        fontSize: 8,
        textColor: COLORS.text,
      },
      alternateRowStyles: {
        fillColor: COLORS.background,
      },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 35, halign: 'right' },
      },
      margin: { left: 20, right: 20 },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  const grandTotalItem = pricingItems.find(item => item.isTotal);
  if (grandTotalItem) {
    doc.setFillColor(...COLORS.primary);
    doc.rect(pageWidth - 100, y - 2, 80, 12, 'F');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('Grand Total:', pageWidth - 96, y + 6);
    doc.text(`$${grandTotalItem.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, pageWidth - 24, y + 6, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += 20;
  }

  if (isInternal && totalClientPrice !== undefined && totalUpteamCost !== undefined) {
    y = checkPageBreak(doc, y, 50);
    y = addSectionTitle(doc, 'COST SUMMARY (Internal)', y);

    y = addField(doc, 'Client Price', `$${totalClientPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, y, pageWidth);
    y = addField(doc, 'Upteam Cost', `$${totalUpteamCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, y, pageWidth);

    const profitMargin = totalClientPrice - totalUpteamCost;
    const profitMarginPercent = totalUpteamCost > 0 ? ((profitMargin / totalUpteamCost) * 100) : 0;

    y += 3;
    doc.setFillColor(34, 197, 94, 0.1);
    doc.rect(20, y - 3, pageWidth - 40, 12, 'F');

    doc.setFontSize(10);
    doc.setTextColor(...COLORS.success);
    doc.setFont('helvetica', 'bold');
    doc.text('Profit:', 24, y + 4);
    doc.text(`$${profitMargin.toLocaleString('en-US', { minimumFractionDigits: 2 })} (${profitMarginPercent.toFixed(1)}%)`, pageWidth - 24, y + 4, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += 15;
  }

  y = checkPageBreak(doc, y, 50);
  y = addSectionTitle(doc, 'CONTACTS', y);
  if (scopingData.accountContact) {
    y = addField(doc, 'Account Contact', scopingData.accountContact, y, pageWidth);
    if (scopingData.accountContactEmail) {
      y = addField(doc, 'Email', scopingData.accountContactEmail, y, pageWidth);
    }
    if (scopingData.accountContactPhone) {
      y = addField(doc, 'Phone', scopingData.accountContactPhone, y, pageWidth);
    }
  }

  y = checkPageBreak(doc, y, 40);
  y = addSectionTitle(doc, 'TIMELINE & PAYMENT', y);
  if (scopingData.estimatedTimeline) {
    y = addField(doc, 'Timeline', scopingData.estimatedTimeline, y, pageWidth);
  }
  if (scopingData.paymentTerms) {
    let terms = scopingData.paymentTerms;
    if (scopingData.paymentTerms === 'other' && scopingData.paymentTermsOther) {
      terms = scopingData.paymentTermsOther;
    }
    y = addField(doc, 'Payment', terms, y, pageWidth);
  }

  y = addAttachmentsSection(doc, scopingData, y, pageWidth);

  addFooter(doc);

  if (returnBlob) {
    return doc.output('blob');
  }

  const suffix = isInternal ? 'internal' : 'client';
  const filename = `scope-quote-${suffix}-${projectDetails.projectName || 'draft'}-${Date.now()}.pdf`;
  doc.save(filename);
}



