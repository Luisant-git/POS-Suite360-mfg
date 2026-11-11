import { useQuery } from '@tanstack/react-query';
import { Printer, Download, FileText, Layers, Calendar, X } from 'lucide-react';
import api from '../../services/api';
import { useSettings } from '../../contexts/SettingsContext';
import { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import toast from 'react-hot-toast';
import { parseBatchWorkName } from '../../utils/productionBatch';

interface ProductionModalProps {
  productionId: number;
  onClose: () => void;
}

const ProductionModal = ({ productionId, onClose }: ProductionModalProps) => {
  const { settings } = useSettings();

  const { data: production, isLoading, isError } = useQuery({
    queryKey: ['production', productionId],
    queryFn: async () => {
      const { data } = await api.get(`/production/${productionId}`);
      return data;
    },
    enabled: !!productionId
  });

  const generatePDF = () => {
    if (!production) return;
    try {
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(20);
      doc.text(settings?.shopName || 'Company Name', 14, 22);
      
      doc.setFontSize(10);
      doc.text(settings?.shopAddress || '', 14, 30);
      doc.text(`Phone: ${settings?.phone || ''}`, 14, 36);
      
      // Document Title
      doc.setFontSize(16);
      doc.text('PRODUCTION REPORT DETAILS', 14, 50);
      
      // Info Grid
      const { batchCode: pdfBatchCode, workName: pdfWorkName } = parseBatchWorkName(production.workName);
      doc.setFontSize(10);
      doc.text(`Batch Code: ${pdfBatchCode}`, 14, 60);
      doc.text(`Work Name: ${pdfWorkName}`, 14, 66);
      doc.text(`Date: ${new Date(production.date).toLocaleDateString()}`, 14, 72);
      
      // Intake Table
      doc.setFontSize(12);
      doc.text('Raw Material Intake', 14, 84);
      const intakeColumns = ["Raw Material", "Quantity Intake"];
      const intakeRows = [
        [production.rawMaterial?.name, production.intakeQuantity.toString()]
      ];
      autoTable(doc, {
        head: [intakeColumns],
        body: intakeRows,
        startY: 89,
        theme: 'striped',
        headStyles: { fillColor: [180, 83, 9] } // amber-700
      });

      // Outcome Table
      const finalY = (doc as any).lastAutoTable.finalY + 15;
      doc.setFontSize(12);
      doc.text('Finished Product Outcome', 14, finalY);
      const outcomeColumns = ["Finished Product", "Quantity Produced"];
      const outcomeRows = [
        [production.finishedProduct?.name, production.outcomeQuantity.toString()]
      ];
      autoTable(doc, {
        head: [outcomeColumns],
        body: outcomeRows,
        startY: finalY + 5,
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129] } // emerald-500
      });
      
      doc.save(`Production_${production.workName}_${productionId}.pdf`);
      toast.success('PDF Downloaded');
    } catch (error) {
      toast.error('Failed to generate PDF');
    }
  };

  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Production_Report_${production?.workName || ''}`,
  });

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex justify-center items-center p-2 sm:p-6 font-sans">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden relative">
        
        {/* Modal Header */}
        <div className="bg-[#0F172A] text-white px-4 sm:px-6 py-3 sm:py-4 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center justify-between sm:justify-start gap-2">
              <div className="flex items-center gap-2">
                <Layers size={18} className="text-amber-400" />
                <h2 className="text-base sm:text-lg font-bold">Production Details</h2>
              </div>
              <button onClick={onClose} className="sm:hidden p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/80 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="flex items-center gap-2 justify-end pt-1 sm:pt-0 border-t border-white/10 sm:border-0">
              <button onClick={() => handlePrint()} className="flex-1 sm:flex-initial justify-center bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded flex items-center gap-1.5 text-[11px] sm:text-[12px] font-bold transition-colors">
                <Printer size={13} /> Print
              </button>
              <button onClick={generatePDF} className="flex-1 sm:flex-initial justify-center bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded flex items-center gap-1.5 text-[11px] sm:text-[12px] font-bold transition-colors">
                <Download size={13} /> PDF
              </button>
              <div className="hidden sm:block w-px h-6 bg-white/20"></div>
              <button onClick={onClose} className="hidden sm:block p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/80 hover:text-white">
                <X size={18} />
              </button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex-1 flex justify-center items-center p-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          </div>
        ) : isError || !production ? (
          <div className="flex-1 flex justify-center items-center p-12 text-gray-500 font-medium">
            Production Entry Not Found
          </div>
        ) : (
          <>
            {/* --- WEB UI --- */}
            <div className="flex-1 overflow-auto p-3 sm:p-6 custom-scrollbar">
            {/* Invoice Header */}
            <div className="border-b border-gray-200 pb-4 sm:pb-6 mb-4 sm:mb-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4">
                <div>
                  <h1 className="text-lg sm:text-2xl font-black text-gray-800 uppercase tracking-wide">Production Entry</h1>
                  <p className="text-gray-500 text-xs sm:text-sm font-medium mt-0.5 print:hidden">Status: <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded">Completed</span></p>
                </div>
                <div className="text-left sm:text-right">
                  <h2 className="text-base sm:text-xl font-bold text-blue-600">{settings?.shopName || 'Suite360'}</h2>
                  <p className="text-gray-500 text-xs sm:text-sm mt-0.5">{settings?.shopAddress}</p>
                  <p className="text-gray-500 text-xs sm:text-sm">{settings?.phone}</p>
                </div>
              </div>
            </div>

            {/* Info Grid */}
            {(() => {
              const { batchCode, workName } = parseBatchWorkName(production.workName);
              return (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6 bg-slate-50 border border-gray-200 rounded-xl p-3.5 sm:p-5 mb-4 sm:mb-8">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                      <FileText size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Batch Code</p>
                      <p className="text-xs font-bold text-black">{batchCode}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                      <FileText size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Work Name</p>
                      <p className="font-bold text-gray-800">{workName}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                      <Calendar size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Production Date</p>
                      <p className="font-bold text-gray-800">{new Date(production.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Intake Details */}
              <div className="min-w-0">
                <h3 className="font-bold text-amber-800 mb-3 text-sm uppercase tracking-wider bg-amber-50 px-3 py-1.5 rounded-md inline-block">Raw Material Intake</h3>
                <div className="border border-gray-200 rounded-lg overflow-x-auto">
                  <table className="w-full text-left text-[13px] whitespace-nowrap">
                    <thead>
                      <tr className="bg-gray-100 text-gray-600 font-bold">
                        <th className="px-4 py-3 border-b">Raw Material</th>
                        <th className="px-4 py-3 border-b text-right">Quantity Intake</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      <tr className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-bold text-gray-800">{production.rawMaterial?.name}</td>
                        <td className="px-4 py-3 text-right font-bold text-amber-600">{production.intakeQuantity}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Outcome Details */}
              <div className="min-w-0">
                <h3 className="font-bold text-emerald-800 mb-3 text-sm uppercase tracking-wider bg-emerald-50 px-3 py-1.5 rounded-md inline-block">Finished Product Outcome</h3>
                <div className="border border-gray-200 rounded-lg overflow-x-auto">
                  <table className="w-full text-left text-[13px] whitespace-nowrap">
                    <thead>
                      <tr className="bg-gray-100 text-gray-600 font-bold">
                        <th className="px-4 py-3 border-b">Finished Product</th>
                        <th className="px-4 py-3 border-b text-right">Quantity Produced</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      <tr className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-bold text-gray-800">{production.finishedProduct?.name}</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600">{production.outcomeQuantity}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-100 border-t border-gray-200 px-3 sm:px-5 py-2.5 sm:py-3 flex justify-end rounded-b-xl shrink-0">
            <button onClick={onClose} className="w-full sm:w-auto bg-gray-600 hover:bg-gray-700 text-white px-4 sm:px-5 py-2 rounded text-[12px] sm:text-[13px] font-bold transition-colors shadow-sm text-center">
              Close Window
            </button>
          </div>

          {/* --- PRINT UI (Hidden in DOM, used by react-to-print) --- */}
          <div style={{ display: 'none' }}>
            <div ref={printRef} className="bg-white text-black font-sans p-10 w-full max-w-[800px] mx-auto print-container">
              {/* Header */}
              <div className="text-center mb-6">
                <h1 className="text-3xl font-bold uppercase mb-1">{settings?.shopName || 'COMPANY NAME'}</h1>
                <p className="text-sm text-gray-600">{settings?.shopAddress}</p>
                <p className="text-sm text-gray-600">Phone: {settings?.phone}</p>
              </div>
              
              <div className="border-b-2 border-black mb-6"></div>
              
              <h2 className="text-center font-bold text-xl mb-6 uppercase tracking-wider">Production Report Details</h2>

              {/* Info */}
              {(() => {
                const { batchCode: printBatchCode, workName: printWorkName } = parseBatchWorkName(production.workName);
                return (
                  <div className="flex justify-between mb-8 text-sm">
                    <div>
                      <p className="mb-1"><strong className="inline-block w-28">Batch Code:</strong> <span className="text-xs font-bold text-black">{printBatchCode}</span></p>
                      <p className="mb-1"><strong className="inline-block w-28">Work Name:</strong> {printWorkName}</p>
                    </div>
                    <div className="text-right">
                      <p className="mb-1"><strong className="inline-block w-16">Date:</strong> {new Date(production.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                );
              })()}

              {/* Tables */}
              <div className="mb-8">
                <h3 className="font-bold text-lg mb-2">Raw Material Intake</h3>
                <table className="w-full text-left text-sm border-collapse border border-black mb-6">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-black px-3 py-2 font-bold">Raw Material</th>
                      <th className="border border-black px-3 py-2 text-right font-bold w-48">Quantity Intake</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-black px-3 py-2">{production.rawMaterial?.name}</td>
                      <td className="border border-black px-3 py-2 text-right font-bold">{production.intakeQuantity}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mb-8">
                <h3 className="font-bold text-lg mb-2">Finished Product Outcome</h3>
                <table className="w-full text-left text-sm border-collapse border border-black mb-6">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-black px-3 py-2 font-bold">Finished Product</th>
                      <th className="border border-black px-3 py-2 text-right font-bold w-48">Quantity Produced</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-black px-3 py-2">{production.finishedProduct?.name}</td>
                      <td className="border border-black px-3 py-2 text-right font-bold">{production.outcomeQuantity}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Signatures */}
              <div className="flex justify-between mt-32 pt-8">
                <div className="text-center">
                  <div className="border-t border-black w-48 pt-2 font-bold">Supervisor Signature</div>
                </div>
                <div className="text-center">
                  <div className="border-t border-black w-48 pt-2 font-bold">Manager Signature</div>
                </div>
              </div>
            </div>
          </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ProductionModal;
