import { useQuery } from '@tanstack/react-query';
import { X, Printer, FileText, CheckCircle2, Loader2 } from 'lucide-react';
import api from '../../services/api';
import { useSettings } from '../../contexts/SettingsContext';
import { useState } from 'react';
import InvoicePrintModal from '../../components/InvoicePrintModal';
import jsPDF from 'jspdf';

interface Props {
  saleId: number;
  onClose: () => void;
}

export default function ViewSalesModal({ saleId, onClose }: Props) {
  const { settings, formatCurrency } = useSettings();
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const { data: sale, isLoading } = useQuery({
    queryKey: ['sales', saleId],
    queryFn: async () => (await api.get(`/sales/${saleId}`)).data,
    enabled: !!saleId,
  });

  const handleShare = async () => {
    if (!sale) return;
    setIsSharing(true);
    const invoiceNo = sale.invoiceNo || '';
    const date = sale.date ? new Date(sale.date).toISOString().split('T')[0] : '';
    const customerName = sale.customer?.name || 'CASH A/C';
    const items = sale.items || [];
    const grandTotal = sale.grandTotal || 0;
    const currency = settings?.currencySymbol || 'RM';

    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const W = 210, margin = 14, col = margin, lineH = 6;
    let y = margin;

    const t = (text: string, x: number, yp: number, opts: any = {}) => {
      doc.setFontSize(opts.size || 10);
      doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
      doc.setTextColor(opts.color || '#1e293b');
      doc.text(String(text ?? ''), x, yp, { maxWidth: opts.maxWidth });
    };

    t(settings?.shopName || 'POS Suite 360', col, y, { size: 16, bold: true, color: '#04325E' }); y += 7;
    if (settings?.shopAddress) { t(settings.shopAddress, col, y, { size: 9, color: '#475569' }); y += 5; }
    const cityLine = [settings?.city, settings?.state, settings?.country].filter(Boolean).join(', ');
    if (cityLine) { t(cityLine, col, y, { size: 9, bold: true, color: '#475569' }); y += 5; }
    if (settings?.phone) { t(`Tel: ${settings.phone}`, col, y, { size: 9, color: '#475569' }); y += 5; }
    t('INVOICE', W - margin, margin + 4, { size: 20, bold: true, color: '#1A63A8' });
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor('#334155');
    doc.text(`Invoice No: #${invoiceNo}`, W - margin, margin + 11, { align: 'right' });
    doc.text(`Date: ${date}`, W - margin, margin + 17, { align: 'right' });
    y += 4; doc.setDrawColor('#e2e8f0'); doc.setLineWidth(0.3); doc.line(col, y, W - margin, y); y += 6;
    t('BILLED TO', col, y, { size: 8, bold: true, color: '#64748b' }); y += 5;
    t(customerName, col, y, { size: 11, bold: true }); y += 5;
    if (sale.customer?.phone) { t(`Phone: ${sale.customer.phone}`, col, y, { size: 9, color: '#475569' }); y += 5; }
    if (sale.customer?.address) { t(sale.customer.address, col, y, { size: 9, color: '#475569', maxWidth: 80 }); y += 5; }
    t('PAYMENT MODE', W - margin - 60, margin + 22, { size: 8, bold: true, color: '#64748b' });
    t(sale.paymentMode?.name || 'Cash', W - margin - 60, margin + 27, { size: 10, bold: true });
    y += 4; doc.line(col, y, W - margin, y); y += 6;
    doc.setFillColor('#2D6AA1'); doc.rect(col, y - 4, W - margin * 2, 8, 'F');
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor('#ffffff');
    doc.text('#', col + 2, y + 1); doc.text('Item', col + 10, y + 1);
    doc.text('Qty', col + 100, y + 1, { align: 'center' });
    doc.text('Rate', col + 130, y + 1, { align: 'right' });
    doc.text('Amount', W - margin, y + 1, { align: 'right' }); y += 8;
    items.forEach((item: any, idx: number) => {
      if (idx % 2 === 0) { doc.setFillColor('#f8fafc'); doc.rect(col, y - 4, W - margin * 2, lineH + 2, 'F'); }
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor('#1e293b');
      doc.text(String(idx + 1), col + 2, y);
      doc.setFont('helvetica', 'bold'); doc.text(item.product?.name || '', col + 10, y, { maxWidth: 80 });
      doc.setFont('helvetica', 'normal');
      doc.text(`${item.quantity} ${item.product?.unit?.shortCode || 'Nos'}`, col + 100, y, { align: 'center' });
      doc.text(Number(item.rate || 0).toFixed(2), col + 130, y, { align: 'right' });
      doc.setFont('helvetica', 'bold'); doc.text(Number(item.amount || 0).toFixed(2), W - margin, y, { align: 'right' });
      y += lineH + 2;
    });
    doc.setDrawColor('#e2e8f0'); doc.line(col, y, W - margin, y); y += 6;
    const tx = W - margin - 60;
    doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor('#334155');
    doc.text('Subtotal:', tx, y); doc.text(Number(sale.subtotal || 0).toFixed(2), W - margin, y, { align: 'right' }); y += lineH;
    if (Number(sale.discount) > 0) { doc.text('Discount:', tx, y); doc.text(Number(sale.discount).toFixed(2), W - margin, y, { align: 'right' }); y += lineH; }
    if (Number(sale.tax) > 0) { doc.text('Tax:', tx, y); doc.text(Number(sale.tax).toFixed(2), W - margin, y, { align: 'right' }); y += lineH; }
    doc.setFillColor('#F0F5FA'); doc.rect(tx - 4, y - 4, W - margin - tx + 4 + margin, 10, 'F');
    doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor('#04325E');
    doc.text('Total Due:', tx, y + 3); doc.text(`${currency} ${Number(grandTotal).toFixed(2)}`, W - margin, y + 3, { align: 'right' }); y += 16;
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor('#94a3b8');
    doc.text('Thank you for your business!', W / 2, y, { align: 'center' });

    const pdfBlob = doc.output('blob');
    const file = new File([pdfBlob], `Invoice_${invoiceNo}.pdf`, { type: 'application/pdf' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `Invoice ${invoiceNo}` });
      } else {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(pdfBlob);
        link.download = `Invoice_${invoiceNo}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Error sharing:', err);
        // Fallback to error handling if toast isn't imported, but assuming it is
      }
    } finally {
      setIsSharing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white p-6 rounded-md shadow-lg font-bold text-[#1E3A8A]">Loading invoice details...</div>
      </div>
    );
  }

  if (!sale) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white w-full max-w-5xl rounded-md shadow-lg overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-[#3B82F6] text-white px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="font-bold text-[16px]">Sales Invoice - {sale.invoiceNo}</h2>
            <div className="flex gap-2 items-center text-[12px] text-blue-100">
              <span>{sale.date ? new Date(sale.date).toISOString().split('T')[0] : ''}</span>
              <span>•</span>
              <span className={`flex items-center gap-1 font-bold px-2.5 py-0.5 rounded text-[11px] ${
                sale.paymentMode?.name?.toLowerCase() === 'credit'
                  ? 'bg-rose-500 text-white'
                  : 'bg-[#22C55E] text-white'
              }`}>
                {sale.paymentMode?.name?.toLowerCase() === 'credit' ? 'CREDIT' : <><CheckCircle2 size={12} /> PAID</>}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsPrintModalOpen(true)}
              className="flex items-center gap-1.5 bg-blue-700 hover:bg-blue-800 px-3 py-1.5 rounded font-bold text-[12px] transition-colors"
            >
              <Printer size={14} /> Print
            </button>
            <button 
              onClick={handleShare}
              disabled={isSharing}
              className="flex items-center gap-1.5 bg-[#22C55E] hover:bg-[#16A34A] disabled:opacity-70 px-3 py-1.5 rounded font-bold text-[12px] transition-colors"
            >
              {isSharing ? (
                <><Loader2 size={13} className="animate-spin" /> Preparing...</>
              ) : (
                <><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg> Share Invoice</>
              )}
            </button>
            <button onClick={onClose} className="hover:bg-blue-600 p-1.5 rounded transition-colors ml-2"><X size={18} /></button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto bg-[#F8FAFC]">
          <div className="flex gap-6 flex-col md:flex-row">
            
            {/* Left Column - Details */}
            <div className="flex-1 space-y-6">
              <div className="bg-white rounded shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-[#1E293B] px-4 py-2 flex items-center gap-2 text-white">
                  <FileText size={16} />
                  <h3 className="font-bold text-[14px]">INVOICE DETAILS</h3>
                </div>
                <div className="p-5 flex justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">Bill To</p>
                    <p className="font-bold text-[15px] text-gray-800">{sale.customer?.name || 'Counter Sale'}</p>
                    <p className="text-[13px] text-gray-600 mt-1">{sale.customer?.phone || 'No phone number'}</p>
                    {sale.customer?.address && <p className="text-[13px] text-gray-600 mt-1 max-w-[250px]">{sale.customer.address}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">Payment Details</p>
                    <p className={`font-bold text-[13px] sm:text-[14px] inline-block px-2.5 py-0.5 rounded ${
                      sale.paymentMode?.name?.toLowerCase() === 'credit'
                        ? 'bg-rose-500 text-white'
                        : 'bg-[#22C55E] text-white'
                    }`}>
                      {sale.paymentMode?.name?.toUpperCase() || 'CASH'}
                    </p>
                    <p className="text-[13px] text-gray-600 mt-1">Status: {sale.paymentMode?.name?.toLowerCase() === 'credit' ? 'Credit' : 'Paid'}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-[#F8FAFC] px-4 py-2 border-b border-gray-200">
                  <h3 className="font-bold text-[14px] text-gray-800">ITEMIZED BILLING</h3>
                </div>
                <div className="overflow-x-auto p-4">
                  <table className="w-full text-left text-[13px] whitespace-nowrap">
                    <thead>
                      <tr className="border-b-2 border-gray-200 text-gray-500">
                        <th className="py-2 px-2 font-bold">Code</th>
                        <th className="py-2 px-2 font-bold">Product</th>
                        <th className="py-2 px-2 font-bold text-right">Qty</th>
                        <th className="py-2 px-2 font-bold text-center">Unit</th>
                        <th className="py-2 px-2 font-bold text-right">Rate</th>
                        <th className="py-2 px-2 font-bold text-right">Discount</th>
                        <th className="py-2 px-2 font-bold text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sale.items?.map((item: any, idx: number) => {
                        const displayName = item.isService 
                          ? (item.itemName || item.serviceItem?.name || '')
                          : (item.product?.name || '');
                        return (
                        <tr key={idx} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                          <td className="py-3 px-2 font-medium text-gray-600">{!item.isService ? (item.product?.code || '-') : '-'}</td>
                          <td className="py-3 px-2">
                            <span className="font-bold text-gray-800">{displayName}</span>
                            {!item.isService && item.product?.hsnCode && <span className="block text-[11px] text-gray-400">HSN: {item.product.hsnCode}</span>}
                          </td>
                          <td className="py-3 px-2 text-right">{item.quantity}</td>
                          <td className="py-3 px-2 text-center text-gray-500">{item.isService ? 'Svc' : (item.product?.unit?.name || 'Nos')}</td>
                          <td className="py-3 px-2 text-right font-medium">{formatCurrency(item.rate)}</td>
                          <td className="py-3 px-2 text-right text-red-500">{item.discount > 0 ? formatCurrency(item.discount) : '-'}</td>
                          <td className="py-3 px-2 text-right font-bold text-gray-900">{formatCurrency(item.amount)}</td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right Column - Summary */}
            <div className="w-full md:w-[320px] shrink-0">
              <div className="bg-white rounded shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-[#F8FAFC] px-4 py-2 border-b border-gray-200">
                  <h3 className="font-bold text-[14px] text-gray-800">SUMMARY</h3>
                </div>
                <div className="p-4 space-y-3 text-[14px]">
                  <div className="flex justify-between items-center text-gray-600">
                    <span>Subtotal</span>
                    <span className="font-bold">{formatCurrency(sale.subtotal)}</span>
                  </div>
                  <div className="flex justify-between items-center text-red-500 border-b border-gray-100 pb-3">
                    <span>Discount</span>
                    <span className="font-bold">- {formatCurrency(sale.discount)}</span>
                  </div>
                  {settings?.enableTax && (
                    (() => {
                      if (Number(sale.tax) === 0) return null;
                      const storeState = (settings.state || '').trim().toLowerCase();
                      const custState = (sale.customer?.state || '').trim().toLowerCase();
                      if (storeState && custState && storeState === custState) {
                        const splitTax = Number(sale.tax) / 2;
                        return (
                          <>
                            <div className="flex justify-between items-center text-gray-600">
                              <span>CGST</span>
                              <span className="font-bold">{formatCurrency(splitTax)}</span>
                            </div>
                            <div className="flex justify-between items-center text-gray-600">
                              <span>SGST</span>
                              <span className="font-bold">{formatCurrency(splitTax)}</span>
                            </div>
                          </>
                        );
                      } else {
                        return (
                          <div className="flex justify-between items-center text-gray-600">
                            <span>IGST</span>
                            <span className="font-bold">{formatCurrency(sale.tax)}</span>
                          </div>
                        );
                      }
                    })()
                  )}
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-[16px] font-black text-gray-900">GRAND TOTAL</span>
                    <span className="text-[20px] font-black text-[#2563EB]">{formatCurrency(sale.grandTotal)}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-100 border-t border-gray-200 px-3 sm:px-5 py-2 sm:py-3 flex justify-end rounded-b-md shrink-0">
          <button onClick={onClose} className="bg-gray-600 hover:bg-gray-700 text-white px-4 sm:px-5 py-2 rounded text-[12px] sm:text-[13px] font-bold transition-colors shadow-sm">
            Close Window
          </button>
        </div>
      </div>

      <InvoicePrintModal 
        isOpen={isPrintModalOpen} 
        onClose={() => setIsPrintModalOpen(false)} 
        sale={sale} 
      />
    </div>
  );
}
