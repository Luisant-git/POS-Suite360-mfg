import { X, Box, Calendar, Package, Tag, ArrowRight, Hash, CheckCircle, Flag, AlertTriangle } from 'lucide-react';
import {
  formatDateTime,
  formatRawMaterialLabel,
  getEffectiveIntakes,
  getEffectiveOutcomeEntries,
  getEffectiveOutcomes,
  isProductionCompleted,
  parseBatchWorkName,
} from '../utils/productionBatch';

interface ProductionViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  production: any;
  confirmFinish?: boolean;
  onConfirmFinish?: () => void;
  isFinishing?: boolean;
}

const ProductionViewModal = ({
  isOpen,
  onClose,
  production,
  confirmFinish = false,
  onConfirmFinish,
  isFinishing = false,
}: ProductionViewModalProps) => {
  if (!isOpen || !production) return null;
  const { batchCode, workName } = parseBatchWorkName(production.workName);
  const completed = isProductionCompleted(production);
  const intakes = getEffectiveIntakes(production);
  const outcomes = getEffectiveOutcomes(production);
  const outcomeEntries = getEffectiveOutcomeEntries(production);

  const totalIntakeQty = intakes.reduce((sum: number, i: any) => sum + Number(i.intakeQuantity || 0), 0);
  const totalOutcomeQty = outcomeEntries.length > 0
    ? outcomeEntries.reduce((sum: number, e: any) => sum + Number(e.outcomeQuantity || 0), 0)
    : outcomes.reduce((sum: number, o: any) => sum + Number(o.outcomeQuantity || 0), 0);

  const totalIntakeSqM = intakes.reduce((sum: number, i: any) => {
    const fallbackPerRoll = Number(i.rawMaterial?.rawMaterialPurchaseItems?.[0]?.sqM || 0);
    const sqM = Number(i.sqM || 0) > 0 ? Number(i.sqM) : Number(i.intakeQuantity || 0) * fallbackPerRoll;
    return sum + sqM;
  }, 0);

  const totalOutcomeSqM = outcomeEntries.length > 0
    ? outcomeEntries.reduce((sum: number, e: any) => {
        const prodSqM = Number(e.finishedProduct?.sqM || 0);
        return sum + Number(e.outcomeQuantity || 0) * prodSqM;
      }, 0)
    : outcomes.reduce((sum: number, o: any) => {
        const prodSqM = Number(o.finishedProduct?.sqM || 0);
        return sum + Number(o.outcomeQuantity || 0) * prodSqM;
      }, 0);

  const wastageSqM = totalIntakeSqM > 0 ? Math.max(0, totalIntakeSqM - totalOutcomeSqM) : 0;
  const wastagePct = totalIntakeSqM > 0 ? (wastageSqM / totalIntakeSqM) * 100 : 0;

  return (
    <div className="fixed top-[60px] inset-x-0 bottom-0 z-20 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/50 backdrop-blur-sm overflow-hidden">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl md:max-w-3xl lg:max-w-4xl max-h-[calc(100vh-76px)] sm:max-h-[calc(100vh-90px)] overflow-hidden flex flex-col transition-all duration-200">
        {/* Header */}
        <div className={`${confirmFinish ? 'bg-[#16A34A]' : 'bg-[#1E3A8A]'} px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center shrink-0`}>
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="bg-white/20 p-1.5 sm:p-2 rounded-lg shrink-0">
              {confirmFinish ? <Flag className="text-white" size={20} /> : <Box className="text-white" size={20} />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base md:text-lg font-bold text-white tracking-wide truncate">
                  {confirmFinish ? 'CONFIRM & FINISH PRODUCTION' : 'PRODUCTION DETAILS'}
                </h2>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${completed ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-slate-900'}`}>
                  {completed ? 'Completed' : 'Pending'}
                </span>
              </div>
              <p className={`${confirmFinish ? 'text-emerald-100' : 'text-blue-200'} text-[11px] sm:text-xs font-medium truncate`}>
                {confirmFinish
                  ? 'Review all batch details before moving this production to Completed'
                  : 'View Batch Materials, Products & Yield'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isFinishing}
            className="text-white hover:bg-white/20 p-1.5 sm:p-2 rounded-full transition-colors disabled:opacity-50 shrink-0 ml-2"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-5 md:p-6 overflow-y-auto custom-scrollbar flex-1 bg-gray-50 space-y-4 sm:space-y-6">
          {confirmFinish && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 sm:p-3.5 flex items-start gap-2.5 sm:gap-3">
              <CheckCircle className="text-emerald-600 shrink-0 mt-0.5" size={18} />
              <div className="text-xs text-emerald-950 space-y-1">
                <p className="font-bold">Move this production batch to Completed?</p>
                <p className="text-emerald-800">
                  Total Intake: <strong>{totalIntakeQty}</strong> | Total Outcome: <strong>{totalOutcomeQty}</strong>. Once marked Completed, this entry will move to the Completed list.
                </p>
                {totalOutcomeQty <= 0 && (
                  <p className="text-amber-700 font-bold flex items-center gap-1 pt-0.5">
                    <AlertTriangle size={14} /> Current Outcome Quantity is 0. You can still confirm or click Cancel to Update Outcome Qty first.
                  </p>
                )}
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4">
            <div className="bg-white p-3 sm:p-4 rounded-xl border border-gray-100 shadow-sm flex items-start gap-3">
              <div className="bg-amber-50 p-2 rounded-lg text-amber-600 mt-0.5 shrink-0">
                <Hash size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-0.5 sm:mb-1">Batch Code</p>
                <p className="text-xs font-bold text-black break-words">{batchCode}</p>
              </div>
            </div>

            <div className="bg-white p-3 sm:p-4 rounded-xl border border-gray-100 shadow-sm flex items-start gap-3">
              <div className="bg-blue-50 p-2 rounded-lg text-blue-600 mt-0.5 shrink-0">
                <Tag size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-0.5 sm:mb-1">Work Name</p>
                <p className="text-xs sm:text-sm font-bold text-gray-900 break-words">{workName}</p>
              </div>
            </div>

            <div className="bg-white p-3 sm:p-4 rounded-xl border border-gray-100 shadow-sm flex items-start gap-3">
              <div className="bg-purple-50 p-2 rounded-lg text-purple-600 mt-0.5 shrink-0">
                <Calendar size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-0.5 sm:mb-1">Production Date</p>
                <p className="text-xs sm:text-sm font-bold text-gray-900">{new Date(production.date).toLocaleDateString('en-GB')}</p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 relative">
              {/* Intake */}
              <div className="bg-white rounded-xl border border-blue-100 shadow-sm overflow-hidden relative z-10">
                <div className="bg-blue-50/80 px-3 sm:px-4 py-2 sm:py-2.5 border-b border-blue-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package size={14} className="text-blue-700 shrink-0" />
                    <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">Material Intake ({intakes.length})</span>
                  </div>
                  <span className="text-xs font-bold text-blue-700">{totalIntakeSqM.toFixed(3)} m²</span>
                </div>
                <div className="divide-y divide-gray-100">
                  {intakes.map((intake: any, idx: number) => (
                    <div key={idx} className="p-3 sm:p-3.5 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-gray-900 break-words">
                          {formatRawMaterialLabel(intake.rawMaterial, intake.materialBatchCode, intake.materialCode)}
                        </p>
                        {Number(intake.sqM || 0) > 0 && (
                          <p className="text-[11px] text-gray-500 mt-0.5">Area: {Number(intake.sqM).toFixed(3)} m²</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Qty</p>
                        <p className="text-sm sm:text-base font-black text-blue-600">{intake.intakeQuantity}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Outcome */}
              <div className="bg-white rounded-xl border border-emerald-100 shadow-sm overflow-hidden relative z-10 flex flex-col">
                <div className="bg-emerald-50/80 px-3 sm:px-4 py-2 sm:py-2.5 border-b border-emerald-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ArrowRight size={14} className="text-emerald-700 shrink-0" />
                    <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                      Product Outcome ({outcomeEntries.length})
                    </span>
                  </div>
                  <span className="text-xs font-bold text-emerald-700">{totalOutcomeSqM.toFixed(3)} m²</span>
                </div>
                <div className="divide-y divide-gray-100 flex-1">
                  {outcomeEntries.map((entry: any, idx: number) => (
                    <div key={entry.key || idx} className="p-3 sm:p-3.5 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                            #{idx + 1}
                          </span>
                          <p className="text-xs font-bold text-gray-900 break-words">{entry.finishedProduct?.name || '-'}</p>
                        </div>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          {formatDateTime(entry.date || production.date)} · Product Sq.M: {Number(entry.finishedProduct?.sqM || 0).toFixed(3)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Qty</p>
                        <p className={`text-sm sm:text-base font-black ${Number(entry.outcomeQuantity || 0) < 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {entry.outcomeQuantity}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                {outcomeEntries.length > 1 && (
                  <div className="bg-emerald-50/60 border-t border-emerald-100 px-3 sm:px-4 py-2 flex items-center justify-between text-xs font-bold text-emerald-900">
                    <span>Total Outcome Qty</span>
                    <span className="text-sm font-black text-emerald-700">{totalOutcomeQty}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {totalIntakeSqM > 0 && (
            <div className="bg-white rounded-xl border border-orange-200 p-3 sm:p-4 grid grid-cols-3 gap-2 sm:gap-3 text-center">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase">Intake Sq.M</p>
                <p className="text-xs sm:text-sm font-black text-blue-700">{totalIntakeSqM.toFixed(3)} m²</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase">Outcome Sq.M</p>
                <p className="text-xs sm:text-sm font-black text-emerald-700">{totalOutcomeSqM.toFixed(3)} m²</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase">Wastage</p>
                <p className="text-xs sm:text-sm font-black text-orange-600">
                  {wastageSqM.toFixed(2)} m² ({wastagePct.toFixed(2)}%)
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-white border-t border-gray-100 px-4 sm:px-6 py-3 sm:py-4 flex justify-end gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isFinishing}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-1.5 sm:py-2 px-4 sm:px-6 rounded-lg transition-colors text-xs sm:text-sm disabled:opacity-50"
          >
            {confirmFinish ? 'Cancel' : 'Close'}
          </button>
          {confirmFinish && onConfirmFinish && (
            <button
              type="button"
              onClick={onConfirmFinish}
              disabled={isFinishing}
              className="bg-[#16A34A] hover:bg-[#15803D] text-white font-bold py-1.5 sm:py-2 px-4 sm:px-6 rounded-lg transition-colors text-xs sm:text-sm flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              <CheckCircle size={16} />
              {isFinishing ? 'Moving to Completed...' : 'Confirm & Finish'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductionViewModal;
