import PDFDocument from "pdfkit";
import type { Lead, CpqArea, CpqTravel } from "@shared/schema";
import { CPQ_BUILDING_TYPES } from "@shared/schema";

interface EstimatePDFOptions {
  lead: Lead;
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
}

export function generateEstimatePDF(options: EstimatePDFOptions): PDFKit.PDFDocument {
  const { lead, companyName = "Scan2Plan", companyAddress = "Troy, NY", companyPhone = "(518) 362-2403", companyEmail = "admin@scan2plan.io" } = options;
  
  const doc = new PDFDocument({
    size: "LETTER",
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
    info: {
      Title: `Estimate - ${lead.projectName || lead.clientName}`,
      Author: companyName,
      Subject: "Professional Estimate",
    }
  });

  const pageWidth = 612 - 100;
  let y = 50;

  doc.font("Helvetica-Bold").fontSize(24).fillColor("#1a1a2e").text("SCAN2PLAN", 50, y);
  doc.font("Helvetica").fontSize(10).fillColor("#666666")
    .text("Laser Scanning & BIM Documentation", 50, y + 28);
  
  doc.font("Helvetica-Bold").fontSize(14).fillColor("#1a1a2e")
    .text("PROFESSIONAL ESTIMATE", 400, y, { align: "right", width: pageWidth - 350 });
  
  if (lead.projectCode) {
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#2563eb")
      .text(`ID: ${lead.projectCode}`, 400, y + 20, { align: "right", width: pageWidth - 350 });
  }

  y += 60;
  doc.moveTo(50, y).lineTo(562, y).strokeColor("#e5e7eb").lineWidth(1).stroke();
  y += 20;

  doc.font("Helvetica-Bold").fontSize(10).fillColor("#374151").text("PREPARED FOR:", 50, y);
  y += 15;
  doc.font("Helvetica").fontSize(11).fillColor("#1a1a2e").text(lead.clientName, 50, y);
  y += 14;
  
  if (lead.contactName) {
    doc.font("Helvetica").fontSize(10).fillColor("#4b5563").text(`Attn: ${lead.contactName}`, 50, y);
    y += 13;
  }
  if (lead.contactEmail) {
    doc.font("Helvetica").fontSize(10).fillColor("#4b5563").text(lead.contactEmail, 50, y);
    y += 13;
  }
  if (lead.contactPhone) {
    doc.font("Helvetica").fontSize(10).fillColor("#4b5563").text(lead.contactPhone, 50, y);
    y += 13;
  }

  const estimateDate = new Date().toLocaleDateString("en-US", { 
    year: "numeric", month: "long", day: "numeric" 
  });
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#374151").text("DATE:", 400, y - 55);
  doc.font("Helvetica").fontSize(10).fillColor("#1a1a2e").text(estimateDate, 400, y - 40);
  
  if (lead.quoteNumber) {
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#374151").text("QUOTE #:", 400, y - 25);
    doc.font("Helvetica").fontSize(10).fillColor("#1a1a2e").text(lead.quoteNumber, 400, y - 10);
  }

  y += 20;

  doc.font("Helvetica-Bold").fontSize(12).fillColor("#1a1a2e").text("PROJECT DETAILS", 50, y);
  y += 20;

  doc.rect(50, y, pageWidth, 100).fillColor("#f8fafc").fill();
  y += 10;
  
  if (lead.projectName) {
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#374151").text("Project:", 60, y);
    doc.font("Helvetica").fontSize(10).fillColor("#1a1a2e").text(lead.projectName, 120, y);
    y += 16;
  }
  
  if (lead.projectAddress) {
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#374151").text("Address:", 60, y);
    doc.font("Helvetica").fontSize(10).fillColor("#1a1a2e").text(lead.projectAddress, 120, y, { width: 430 });
    y += lead.projectAddress.length > 60 ? 28 : 16;
  }
  
  if (lead.buildingType) {
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#374151").text("Type:", 60, y);
    doc.font("Helvetica").fontSize(10).fillColor("#1a1a2e").text(lead.buildingType, 120, y);
    y += 16;
  }
  
  if (lead.sqft) {
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#374151").text("Size:", 60, y);
    doc.font("Helvetica").fontSize(10).fillColor("#1a1a2e").text(`${lead.sqft.toLocaleString()} sq ft`, 120, y);
    y += 16;
  }

  y += 20;

  const areas = lead.cpqAreas as CpqArea[] | null;
  if (areas && areas.length > 0) {
    doc.font("Helvetica-Bold").fontSize(12).fillColor("#1a1a2e").text("SCOPE OF WORK", 50, y);
    y += 20;

    const tableTop = y;
    const colWidths = [150, 100, 100, 162];
    const headers = ["Area/Building", "Type", "Scope", "Disciplines"];

    doc.rect(50, y, pageWidth, 22).fillColor("#1a1a2e").fill();
    y += 6;
    
    let x = 50;
    headers.forEach((header, i) => {
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#ffffff").text(header, x + 5, y, { width: colWidths[i] - 10 });
      x += colWidths[i];
    });
    y += 16;

    areas.forEach((area, idx) => {
      const bgColor = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
      doc.rect(50, y, pageWidth, 36).fillColor(bgColor).fill();
      
      const areaY = y + 10;
      x = 50;
      
      const areaName = area.name || area.buildingName || `Area ${idx + 1}`;
      doc.font("Helvetica").fontSize(9).fillColor("#1a1a2e").text(areaName, x + 5, areaY, { width: colWidths[0] - 10 });
      x += colWidths[0];
      
      const buildingTypeLabel = CPQ_BUILDING_TYPES[area.buildingType as keyof typeof CPQ_BUILDING_TYPES] || area.buildingType;
      doc.text(buildingTypeLabel, x + 5, areaY, { width: colWidths[1] - 10 });
      x += colWidths[1];
      
      const scopeLabels: Record<string, string> = {
        full: "Full Building",
        interior: "Interior Only",
        exterior: "Exterior Only"
      };
      doc.text(scopeLabels[area.scope] || area.scope, x + 5, areaY, { width: colWidths[2] - 10 });
      x += colWidths[2];
      
      const disciplines = area.disciplines || [];
      const disciplineLabels: Record<string, string> = {
        arch: "Arch", struct: "Struct", mech: "Mech", elec: "Elec", plumb: "Plumb", site: "Site"
      };
      const discText = disciplines.map(d => {
        const lod = area.disciplineLods?.[d] || "300";
        return `${disciplineLabels[d] || d} (LOD ${lod})`;
      }).join(", ");
      doc.text(discText, x + 5, areaY, { width: colWidths[3] - 10 });
      
      y += 36;
    });

    y += 10;
  }

  y += 10;
  doc.font("Helvetica-Bold").fontSize(12).fillColor("#1a1a2e").text("INVESTMENT SUMMARY", 50, y);
  y += 20;

  doc.rect(50, y, pageWidth, 60).fillColor("#f0f9ff").strokeColor("#0ea5e9").lineWidth(2).fillAndStroke();
  
  const estimateValue = lead.value ? Number(lead.value) : 0;
  doc.font("Helvetica-Bold").fontSize(24).fillColor("#0f172a")
    .text(`$${estimateValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 60, y + 18);
  
  if (lead.timeline) {
    doc.font("Helvetica").fontSize(10).fillColor("#64748b")
      .text(`Estimated delivery: ${lead.timeline}`, 350, y + 24);
  }

  y += 80;

  doc.font("Helvetica").fontSize(9).fillColor("#64748b")
    .text("This estimate includes:", 50, y);
  y += 14;
  
  const inclusions = [
    "LiDAR point cloud capture (interior/exterior as scoped)",
    "Scan registration and quality control",
    "BIM modeling per specified LOD standards",
    "LoA 40 (0-1/4\") measured accuracy guarantee",
    "Project management and customer service"
  ];
  
  inclusions.forEach(item => {
    doc.font("Helvetica").fontSize(9).fillColor("#64748b").text(`• ${item}`, 60, y);
    y += 12;
  });

  y += 20;
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#1a1a2e").text("TERMS & CONDITIONS", 50, y);
  y += 14;
  doc.font("Helvetica").fontSize(8).fillColor("#6b7280")
    .text(`Legal Jurisdiction: ${lead.legalJurisdiction || "Welor County"}`, 50, y);
  y += 10;
  doc.text("• 50% retainer due upon engagement", 50, y);
  y += 10;
  doc.text("• Balance due upon delivery of final deliverables", 50, y);
  y += 10;
  doc.text("• Estimate valid for 30 days from date of issue", 50, y);

  const footerY = 750;
  doc.moveTo(50, footerY).lineTo(562, footerY).strokeColor("#e5e7eb").lineWidth(1).stroke();
  
  doc.font("Helvetica").fontSize(8).fillColor("#9ca3af")
    .text(`${companyName} • ${companyAddress} • ${companyPhone} • ${companyEmail}`, 50, footerY + 10, { align: "center", width: pageWidth });
  
  if (lead.projectCode) {
    doc.text(`Document ID: ${lead.projectCode}`, 50, footerY + 22, { align: "center", width: pageWidth });
  }

  return doc;
}
