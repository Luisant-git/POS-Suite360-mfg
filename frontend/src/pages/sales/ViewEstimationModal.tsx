import { useQuery } from '@tanstack/react-query';
import { X, Printer, FileText, CheckCircle2, Loader2 } from 'lucide-react';
import api from '../../services/api';
import { useSettings } from '../../contexts/SettingsContext';
import { useState } from 'react';
import InvoicePrintModal from '../../components/InvoicePrintModal';
import jsPDF from 'jspdf';

interface Props {
  estimationId: number;
  onClose: () => void;
}

export default function ViewEstimationModal({ estimationId, onClose }: Props) {
  const { settings, formatCurrency } = useSettings();
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const { data: est, isLoading } = useQuery({
    queryKey: ['estimations', estimationId],
    queryFn: async () => (await api.get(`/estimations/${estimationId}`)).data,
    enabled: !!estimationId,
  });

  const handleShare = async () => {
    if (!est) return;
    setIsSharing(true);
    const estNo = est.estimationNo || '';
    const date = est.date ? new Date(est.date).toISOString().split('T')[0] : '';
    const customerName = est.customer?.name || 'CASH A/C';
    const items = est.items || [];
    const grandTotal = est.grandTotal || 0;
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
    t('BILL', W - margin, margin + 4, { size: 18, bold: true, color: '#1A63A8' });
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor('#334155');
    doc.text(`Est No: #${estNo}`, W - margin, margin + 11, { align: 'right' });
    doc.text(`Date: ${date}`, W - margin, margin + 17, { align: 'right' });
    y += 4; doc.setDrawColor('#e2e8f0'); doc.setLineWidth(0.3); doc.line(col, y, W - margin, y); y += 6;
    t('CUSTOMER', col, y, { size: 8, bold: true, color: '#64748b' }); y += 5;
    t(customerName, col, y, { size: 11, bold: true }); y += 5;
    if (est.customer?.phone) { t(`Phone: ${est.customer.phone}`, col, y, { size: 9, color: '#475569' }); y += 5; }
    if (est.customer?.address) { t(est.customer.address, col, y, { size: 9, color: '#475569', maxWidth: 80 }); y += 5; }
    t('STATUS', W - margin - 60, margin + 22, { size: 8, bold: true, color: '#64748b' });
    t(est.status || 'Pending', W - margin - 60, margin + 27, { size: 10, bold: true });
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
    doc.text('Subtotal:', tx, y); doc.text(Number(est.subtotal || 0).toFixed(2), W - margin, y, { align: 'right' }); y += lineH;
    if (Number(est.discount) > 0) { doc.text('Discount:', tx, y); doc.text(Number(est.discount).toFixed(2), W - margin, y, { align: 'right' }); y += lineH; }
    if (Number(est.tax) > 0) { doc.text('Tax:', tx, y); doc.text(Number(est.tax).toFixed(2), W - margin, y, { align: 'right' }); y += lineH; }
    doc.setFillColor('#F0F5FA'); doc.rect(tx - 4, y - 4, W - margin - tx + 4 + margin, 10, 'F');
    doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor('#04325E');
    doc.text('Total Due:', tx, y + 3); doc.text(`${currency} ${Number(grandTotal).toFixed(2)}`, W - margin, y + 3, { align: 'right' }); y += 16;
    
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor('#94a3b8');
    doc.text('Thank you for your business!', W / 2, y, { align: 'center' });

    const pdfBlob = doc.output('blob');
    const file = new File([pdfBlob], `Estimation_${estNo}.pdf`, { type: 'application/pdf' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `Estimation ${estNo}` });
      } else {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(pdfBlob);
        link.download = `Estimation_${estNo}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Error sharing:', err);
      }
    } finally {
      setIsSharing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white p-6 rounded-md shadow-lg font-bold text-[#1E3A8A]">Loading estimation details...</div>
      </div>
    );
  }

  if (!est) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4">
      <div className="bg-white w-full max-w-5xl rounded-xl sm:rounded-md shadow-2xl overflow-hidden flex flex-col max-h-[96vh] sm:max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-[#1E3A8A] text-white px-3 sm:px-5 py-3 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center justify-between sm:justify-start gap-3">
              <div>
                <h2 className="font-bold text-[14px] sm:text-[16px] flex items-center gap-1.5">
                  <span>Estimation Bill</span>
                  <span className="text-blue-200">#{est.estimationNo}</span>
                </h2>
                <div className="flex gap-2 items-center text-[11px] sm:text-[12px] text-blue-100 mt-0.5">
                  <span>{est.date ? new Date(est.date).toISOString().split('T')[0] : ''}</span>
                  <span>•</span>
                  <span className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded text-[10px] ${
                    est.status === 'Converted' ? 'bg-[#D1FAE5] text-emerald-800' : 'bg-[#FEF3C7] text-amber-800'
                  }`}>
                    <CheckCircle2 size={11} /> {est.status?.toUpperCase() || 'PENDING'}
                  </span>
                </div>
              </div>
              <button onClick={onClose} className="sm:hidden p-1.5 hover:bg-blue-800 rounded-full transition-colors text-white/90">
                <X size={18} />
              </button>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-2 pt-1 sm:pt-0 border-t border-blue-700/60 sm:border-0">
              <div className="flex items-center gap-2 flex-1 sm:flex-initial">
                <button 
                  onClick={() => setIsPrintModalOpen(true)}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-blue-700 hover:bg-blue-800 px-3 py-1.5 rounded font-bold text-[11px] sm:text-[12px] transition-colors"
                >
                  <Printer size={13} /> Print
                </button>
                <button 
                  onClick={handleShare}
                  disabled={isSharing}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-[#22C55E] hover:bg-[#16A34A] disabled:opacity-70 px-3 py-1.5 rounded font-bold text-[11px] sm:text-[12px] transition-colors"
                >
                  {isSharing ? (
                    <><Loader2 size={13} className="animate-spin" /> Preparing...</>
                  ) : (
                    <><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg> Share</>
                  )}
                </button>
              </div>
              <button onClick={onClose} className="hidden sm:block hover:bg-blue-800 p-1.5 rounded transition-colors ml-1 text-white/90">
                <X size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-6 overflow-y-auto bg-[#F8FAFC]">
          <div className="flex gap-4 sm:gap-6 flex-col md:flex-row">
            
            {/* Left Column */}
            <div className="flex-1 space-y-4 sm:space-y-6">
              <div className="bg-white rounded-lg sm:rounded shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-[#1E293B] px-3.5 sm:px-4 py-2 flex items-center gap-2 text-white">
                  <FileText size={15} />
                  <h3 className="font-bold text-[13px] sm:text-[14px]">ESTIMATION DETAILS</h3>
                </div>
                <div className="p-3.5 sm:p-5 flex flex-col sm:flex-row justify-between gap-3">
                  <div>
                    <p className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">Customer</p>
                    <p className="font-bold text-[14px] sm:text-[15px] text-gray-800">{est.customer?.name || 'Counter Sale'}</p>
                    <p className="text-[12px] sm:text-[13px] text-gray-600 mt-0.5">{est.customer?.phone || 'No phone number'}</p>
                    {est.customer?.address && <p className="text-[12px] sm:text-[13px] text-gray-600 mt-0.5 max-w-[280px]">{est.customer.address}</p>}
                  </div>
                  <div className="sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-100">
                    <p className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">Status</p>
                    <span className={`inline-block font-bold text-[12px] sm:text-[13px] px-2.5 py-0.5 rounded ${
                      est.status === 'Converted' ? 'bg-[#D1FAE5] text-emerald-800' : 'bg-[#FEF3C7] text-amber-800'
                    }`}>
                      {est.status?.toUpperCase() || 'PENDING'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg sm:rounded shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-[#F8FAFC] px-3.5 sm:px-4 py-2 border-b border-gray-200 flex justify-between items-center">
                  <h3 className="font-bold text-[13px] sm:text-[14px] text-gray-800">ITEMIZED BILLING</h3>
                  <span className="text-[11px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                    {est.items?.length || 0} {est.items?.length === 1 ? 'Item' : 'Items'}
                  </span>
                </div>

                {/* Mobile Cards View */}
                <div className="sm:hidden p-2.5 space-y-2">
                  {est.items?.map((item: any, idx: number) => (
                    <div key={idx} className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1">
                          <span className="font-bold text-[13px] text-gray-800 block">{item.product?.name}</span>
                          {item.product?.code && (
                            <span className="text-[11px] text-gray-500 block mt-0.5">Code: {item.product.code}</span>
                          )}
                        </div>
                        <span className="font-bold text-[14px] text-[#2563EB] shrink-0">
                          {formatCurrency(item.amount)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-200 text-[12px] text-gray-600">
                        <div>
                          Qty: <span className="font-bold text-gray-800">{item.quantity}</span> {item.product?.unit?.shortCode || item.product?.unit?.name || 'Nos'}
                          <span className="mx-1 text-gray-300">|</span>
                          Rate: <span className="font-medium text-gray-700">{formatCurrency(item.rate)}</span>
                        </div>
                        {item.discount > 0 && (
                          <div className="text-red-500 text-[11px] font-bold">
                            Disc: -{formatCurrency(item.discount)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop / Tablet Table View */}
                <div className="hidden sm:block overflow-x-auto p-4">
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
                      {est.items?.map((item: any, idx: number) => (
                        <tr key={idx} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                          <td className="py-3 px-2 font-medium text-gray-600">{item.product?.code || '-'}</td>
                          <td className="py-3 px-2 font-bold text-gray-800">{item.product?.name}</td>
                          <td className="py-3 px-2 text-right">{item.quantity}</td>
                          <td className="py-3 px-2 text-center text-gray-500">{item.product?.unit?.name || 'Nos'}</td>
                          <td className="py-3 px-2 text-right font-medium">{formatCurrency(item.rate)}</td>
                          <td className="py-3 px-2 text-right text-red-500">{item.discount > 0 ? formatCurrency(item.discount) : '-'}</td>
                          <td className="py-3 px-2 text-right font-bold text-gray-900">{formatCurrency(item.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right Column - Summary */}
            <div className="w-full md:w-[320px] shrink-0">
              <div className="bg-white rounded-lg sm:rounded shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-[#F8FAFC] px-3.5 sm:px-4 py-2 border-b border-gray-200">
                  <h3 className="font-bold text-[13px] sm:text-[14px] text-gray-800">SUMMARY</h3>
                </div>
                <div className="p-3.5 sm:p-4 space-y-2.5 sm:space-y-3 text-[13px] sm:text-[14px]">
                  <div className="flex justify-between items-center text-gray-600">
                    <span>Subtotal</span>
                    <span className="font-bold">{formatCurrency(est.subtotal)}</span>
                  </div>
                  {Number(est.discount) > 0 && (
                    <div className="flex justify-between items-center text-red-500 border-b border-gray-100 pb-2.5">
                      <span>Discount</span>
                      <span className="font-bold">- {formatCurrency(est.discount)}</span>
                    </div>
                  )}
                  {settings?.enableTax && (
                    (() => {
                      if (Number(est.tax) === 0) return null;
                      const storeState = (settings.state || '').trim().toLowerCase();
                      const custState = (est.customer?.state || '').trim().toLowerCase();
                      if (storeState && custState && storeState === custState) {
                        const splitTax = Number(est.tax) / 2;
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
                            <span className="font-bold">{formatCurrency(est.tax)}</span>
                          </div>
                        );
                      }
                    })()
                  )}
                  <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                    <span className="text-[14px] sm:text-[16px] font-black text-gray-900">GRAND TOTAL</span>
                    <span className="text-[18px] sm:text-[20px] font-black text-[#2563EB]">{formatCurrency(est.grandTotal)}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-100 border-t border-gray-200 px-3 sm:px-5 py-2.5 sm:py-3 flex justify-end rounded-b-xl sm:rounded-b-md shrink-0">
          <button onClick={onClose} className="w-full sm:w-auto bg-gray-600 hover:bg-gray-700 text-white px-4 sm:px-5 py-2 rounded text-[12px] sm:text-[13px] font-bold transition-colors shadow-sm text-center">
            Close Window
          </button>
        </div>
      </div>

      <InvoicePrintModal 
        isOpen={isPrintModalOpen} 
        onClose={() => setIsPrintModalOpen(false)} 
        sale={est}
        isEstimation={true} 
      />
    </div>
  );
}
