import * as XLSX from 'xlsx';

export const exportToExcel = (
  data: any[],
  filename: string,
  options?: { sheetName?: string; shopName?: string; title?: string; totalCount?: number | string } | string
) => {
  if (!data || data.length === 0) {
    return;
  }
  
  const opts = typeof options === 'string' ? { sheetName: options } : (options || {});

  // Create a new workbook
  const wb = XLSX.utils.book_new();
  
  const headers = [];
  if (opts.shopName) headers.push([opts.shopName]);
  if (opts.title) headers.push([opts.title]);
  if (opts.totalCount !== undefined) headers.push([`Total Count: ${opts.totalCount}`]);
  if (headers.length > 0) headers.push([]); // empty row before table
  
  const origin = headers.length > 0 ? `A${headers.length + 1}` : "A1";

  // Convert JSON to worksheet
  const ws = XLSX.utils.json_to_sheet(data, { origin } as any);
  
  if (headers.length > 0) {
    XLSX.utils.sheet_add_aoa(ws, headers, { origin: "A1" });
  }

  // Auto-size columns based on content
  const colWidths = Object.keys(data[0]).map(key => ({ wch: Math.max(key.length, 10) }));
  
  // A simple heuristic for column widths: iterate rows to find max width per column
  data.forEach(row => {
    Object.keys(row).forEach((key, index) => {
      const val = row[key];
      const valLen = val !== null && val !== undefined ? val.toString().length : 0;
      if (valLen > colWidths[index].wch) {
        colWidths[index].wch = Math.min(valLen + 2, 50); // Cap at 50 chars
      }
    });
  });
  
  ws['!cols'] = colWidths;
  
  // Append worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, opts.sheetName || 'Sheet 1');
  
  // Write file to client
  XLSX.writeFile(wb, `${filename}.xlsx`);
};
