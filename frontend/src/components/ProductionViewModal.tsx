import { X, Box, Calendar, Package, Tag, ArrowRight, Hash } from 'lucide-react';
import { parseBatchWorkName } from '../utils/productionBatch';

interface ProductionViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  production: any;
}

const ProductionViewModal = ({ isOpen, onClose, production }: ProductionViewModalProps) => {
  if (!isOpen || !production) return null;
  const { batchCode, workName } = parseBatchWorkName(production.workName);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-[#1E3A8A] px-6 py-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <Box className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide">PRODUCTION DETAILS</h2>
              <p className="text-blue-200 text-xs font-medium">View Completed Batch Information</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-white hover:bg-white/20 p-2 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1 bg-gray-50">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-start gap-3">
              <div className="bg-amber-50 p-2 rounded-lg text-amber-600 mt-0.5 shrink-0">
                <Hash size={18} />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Batch Code</p>
                <p className="text-xs font-bold text-black">{batchCode}</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-start gap-3">
              <div className="bg-blue-50 p-2 rounded-lg text-blue-600 mt-0.5 shrink-0">
                <Tag size={18} />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Work Name</p>
                <p className="text-sm font-bold text-gray-900">{workName}</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-start gap-3">
              <div className="bg-purple-50 p-2 rounded-lg text-purple-600 mt-0.5 shrink-0">
                <Calendar size={18} />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Production Date</p>
                <p className="text-sm font-bold text-gray-900">{new Date(production.date).toLocaleDateString('en-GB')}</p>
              </div>
            </div>
          </div>

          <div className="mt-8 relative">
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-200 -translate-y-1/2 rounded-full hidden md:block"></div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
              
              {/* Intake */}
              <div className="bg-white rounded-xl border border-blue-100 shadow-sm overflow-hidden relative z-10">
                <div className="bg-blue-50/80 px-4 py-2 border-b border-blue-100 flex items-center gap-2">
                  <Package size={14} className="text-blue-700" />
                  <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">Material Intake</span>
                </div>
                <div className="p-5">
                  <p className="text-sm font-bold text-gray-900 mb-4">{production.rawMaterial?.name}</p>
                  
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Quantity</p>
                      <p className="text-xl font-black text-blue-600">{production.intakeQuantity}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Arrow Indicator (Mobile only) */}
              <div className="flex justify-center -my-4 md:hidden relative z-20">
                <div className="bg-gray-100 border border-gray-200 p-2 rounded-full text-gray-400">
                  <ArrowRight size={16} className="rotate-90" />
                </div>
              </div>

              {/* Arrow Indicator (Desktop) */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-100 border-2 border-white p-2 rounded-full text-gray-400 hidden md:block z-20 shadow-sm">
                <ArrowRight size={16} />
              </div>

              {/* Outcome */}
              <div className="bg-white rounded-xl border border-emerald-100 shadow-sm overflow-hidden relative z-10">
                <div className="bg-emerald-50/80 px-4 py-2 border-b border-emerald-100 flex items-center gap-2">
                  <Package size={14} className="text-emerald-700" />
                  <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Product Outcome</span>
                </div>
                <div className="p-5">
                  <p className="text-sm font-bold text-gray-900 mb-4">{production.finishedProduct?.name}</p>
                  
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Quantity</p>
                      <p className="text-2xl font-black text-emerald-600">{production.outcomeQuantity}</p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-white border-t border-gray-100 px-6 py-4 flex justify-end shrink-0">
          <button 
            onClick={onClose}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 px-6 rounded-lg transition-colors text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductionViewModal;
