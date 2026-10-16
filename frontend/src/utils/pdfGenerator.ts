import { getMalaysiaDateStr } from './date';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generateBillByBillPdf = (
  companyName: string,
  entityName: string,
  entityType: 'Customer' | 'Supplier',
  bills: any[],
  totals: any,
  reportTitle: string = 'PENDING BALANCE BILL BY BILL'
) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  
  // Header
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(companyName, 105, 15, { align: 'center' });

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(reportTitle, 105, 22, { align: 'center' });
  
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`${entityType.toUpperCase()}: ${entityName}`, 14, 32);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 37);
  
  const head = [['Type', 'Invoice No.', 'Date', 'Reference No.', 'Amount', 'Outstanding']];
  const typeStr = entityType === 'Customer' ? 'INV' : 'PUR';
  
  const body = bills.map(b => [
    typeStr,
    b.entryNo || '',
    b.date ? getMalaysiaDateStr(b.date) : '-',
    '-',
    Number(b.total).toFixed(2),
    Number(b.pending).toFixed(2)
  ]);
  
  body.push([
    '',
    'TOTAL',
    '',
    '',
    Number(totals.total).toFixed(2),
    Number(totals.pending).toFixed(2)
  ]);

  autoTable(doc, {
    startY: 42,
    head: head,
    body: body,
    theme: 'grid',
    headStyles: { fillColor: [248, 250, 252], textColor: 0, fontStyle: 'bold' },
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { fontStyle: 'bold' },
      4: { halign: 'right' },
      5: { halign: 'right', fontStyle: 'bold' }
    },
    didParseCell: function (data) {
      if (data.section === 'body') {
        if (data.row.index === body.length - 1) { // Total row
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [226, 232, 240];
          data.cell.styles.textColor = [0, 0, 0];
        } else {
          // Color Type (INV/PUR)
          if (data.column.index === 0) {
            data.cell.styles.textColor = [59, 130, 246]; // Blue-500
          }
          // Color Outstanding
          if (data.column.index === 5) {
            if (entityType === 'Customer') {
              data.cell.styles.textColor = [5, 150, 105]; // Emerald-600
            } else {
              data.cell.styles.textColor = [225, 29, 72]; // Rose-600
            }
          }
        }
      }
      if (data.section === 'head') {
        if (data.column.index === 5) {
          if (entityType === 'Customer') {
            data.cell.styles.textColor = [5, 150, 105];
          } else {
            data.cell.styles.textColor = [225, 29, 72];
          }
        }
      }
    }
  });

  return doc.output('bloburl');
};
