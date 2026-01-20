import PDFDocument from 'pdfkit';
import type { MissionBrief } from '../shared/missionBrief';

export async function generateMissionBriefPdf(brief: MissionBrief): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ 
      size: 'letter', 
      margin: 50,
      bufferPages: true 
    });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - 100;

    doc.fontSize(24).font('Helvetica-Bold').text('MISSION BRIEF', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(14).font('Helvetica').text(brief.universalProjectId || `Project #${brief.projectId}`, { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#666666').text(`Generated: ${new Date(brief.generatedAt).toLocaleString()}`, { align: 'center' });
    doc.fillColor('#000000');
    doc.moveDown(1);

    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke('#cccccc');
    doc.moveDown(0.5);

    doc.fontSize(12).font('Helvetica-Bold').text('LOCATION');
    doc.moveDown(0.3);
    doc.fontSize(11).font('Helvetica');
    doc.text(brief.clientName || 'Client name not specified');
    doc.text(brief.projectName || 'Project name not specified');
    doc.moveDown(0.3);
    doc.text(brief.projectAddress || 'Address not specified');
    
    if (brief.distance) {
      doc.moveDown(0.3);
      doc.fontSize(10).fillColor('#666666');
      doc.text(`${brief.distance} miles from ${brief.dispatchLocation}${brief.estimatedDriveTime ? ` • ${brief.estimatedDriveTime}` : ''}`);
      doc.fillColor('#000000');
    }
    doc.moveDown(1);

    doc.fontSize(12).font('Helvetica-Bold').text('CLIENT CONTACT');
    doc.moveDown(0.3);
    doc.fontSize(11).font('Helvetica');
    if (brief.contact.name) {
      doc.text(brief.contact.name);
    }
    if (brief.contact.phone) {
      doc.text(`Phone: ${brief.contact.phone}`);
    }
    if (brief.contact.email) {
      doc.text(`Email: ${brief.contact.email}`);
    }
    if (!brief.contact.name && !brief.contact.phone && !brief.contact.email) {
      doc.text('No contact information available');
    }
    doc.moveDown(1);

    doc.fontSize(12).font('Helvetica-Bold').text('SCOPE OVERVIEW');
    doc.moveDown(0.3);
    doc.fontSize(11).font('Helvetica');
    if (brief.scopeSummary) {
      doc.text(brief.scopeSummary, { width: pageWidth });
    }
    doc.moveDown(0.3);
    doc.text(`${brief.areaCount} area${brief.areaCount !== 1 ? 's' : ''} • ${brief.totalSqft.toLocaleString()} sqft total`);
    doc.moveDown(0.5);

    if (brief.areas.length > 0) {
      const tableTop = doc.y;
      const colWidths = [120, 140, 70, 120, 50];
      const headers = ['Area', 'Type', 'Sqft', 'Disciplines', 'LOD'];
      
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#333333');
      let xPos = 50;
      headers.forEach((header, i) => {
        doc.text(header, xPos, tableTop, { width: colWidths[i] });
        xPos += colWidths[i];
      });
      
      doc.moveTo(50, tableTop + 15).lineTo(doc.page.width - 50, tableTop + 15).stroke('#dddddd');
      
      doc.fontSize(9).font('Helvetica').fillColor('#000000');
      let rowY = tableTop + 20;
      
      brief.areas.forEach((area) => {
        if (rowY > doc.page.height - 100) {
          doc.addPage();
          rowY = 50;
        }
        
        xPos = 50;
        doc.text(area.name.substring(0, 18), xPos, rowY, { width: colWidths[0] });
        xPos += colWidths[0];
        doc.text(area.buildingType.substring(0, 22), xPos, rowY, { width: colWidths[1] });
        xPos += colWidths[1];
        doc.text(area.sqft.toLocaleString(), xPos, rowY, { width: colWidths[2] });
        xPos += colWidths[2];
        doc.text(area.disciplines.slice(0, 3).join(', '), xPos, rowY, { width: colWidths[3] });
        xPos += colWidths[3];
        doc.text(area.lod, xPos, rowY, { width: colWidths[4] });
        
        rowY += 18;
      });
      
      doc.y = rowY;
    }
    doc.moveDown(1);

    doc.fontSize(12).font('Helvetica-Bold').text('SITE CONDITIONS');
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica');
    
    const conditions = [
      ['Occupied', brief.siteConditions.occupied === null ? 'Unknown' : brief.siteConditions.occupied ? 'Yes' : 'No'],
      ['Drop Ceilings', brief.siteConditions.dropCeilings || 'Unknown'],
      ['Hazardous Materials', brief.siteConditions.hazardousMaterials || 'Unknown'],
      ['Active Construction', brief.siteConditions.activeConstruction === null ? 'Unknown' : brief.siteConditions.activeConstruction ? 'Yes' : 'No'],
      ['Parking Access', brief.siteConditions.parkingAccess || 'Unknown'],
      ['Access Restrictions', brief.siteConditions.accessRestrictions || 'None noted'],
    ];
    
    conditions.forEach(([label, value]) => {
      doc.text(`${label}: ${value}`);
    });
    
    if (brief.siteConditions.additionalNotes) {
      doc.moveDown(0.3);
      doc.font('Helvetica-Bold').text('Notes: ', { continued: true });
      doc.font('Helvetica').text(brief.siteConditions.additionalNotes);
    }
    doc.moveDown(1);

    if (brief.risks.length > 0) {
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#cc0000').text('RISK FACTORS');
      doc.fillColor('#000000');
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica');
      brief.risks.forEach(risk => {
        doc.text(`• ${risk}`);
      });
      doc.moveDown(1);
    }

    const hasRequirements = brief.requirements.actScanning || 
                           brief.requirements.georeferencing || 
                           brief.requirements.matterport || 
                           brief.requirements.scanningOnly;
    
    if (hasRequirements) {
      doc.fontSize(12).font('Helvetica-Bold').text('SPECIAL REQUIREMENTS');
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica');
      
      if (brief.requirements.actScanning) doc.text('• ACT Scanning Required');
      if (brief.requirements.georeferencing) doc.text('• Georeferencing Required');
      if (brief.requirements.matterport) doc.text('• Matterport Capture');
      if (brief.requirements.scanningOnly) doc.text(`• Scanning Only: ${brief.requirements.scanningOnly}`);
      
      doc.moveDown(1);
    }

    if (doc.y > doc.page.height - 200) {
      doc.addPage();
    }

    doc.fontSize(12).font('Helvetica-Bold').text('SUGGESTED EQUIPMENT');
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica');
    
    const equipmentColumns = 2;
    const equipmentPerColumn = Math.ceil(brief.suggestedEquipment.length / equipmentColumns);
    const colWidth = pageWidth / equipmentColumns;
    
    const startY = doc.y;
    brief.suggestedEquipment.forEach((item, i) => {
      const col = Math.floor(i / equipmentPerColumn);
      const row = i % equipmentPerColumn;
      const x = 50 + (col * colWidth);
      const y = startY + (row * 14);
      
      doc.rect(x, y + 3, 8, 8).stroke('#333333');
      doc.text(item, x + 14, y, { width: colWidth - 20 });
    });
    
    doc.y = startY + (equipmentPerColumn * 14) + 10;
    doc.moveDown(1);

    if (brief.projectNotes) {
      doc.fontSize(12).font('Helvetica-Bold').text('PROJECT NOTES');
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica');
      doc.text(brief.projectNotes, { width: pageWidth });
    }

    doc.moveDown(2);
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke('#cccccc');
    doc.moveDown(0.5);
    doc.fontSize(9).fillColor('#666666').text(
      `Scan2Plan • ${brief.universalProjectId || `Project #${brief.projectId}`} • Generated ${new Date(brief.generatedAt).toLocaleDateString()}`,
      { align: 'center' }
    );

    doc.end();
  });
}
