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

  // Group outcome entries under distinct finished products so the completed status is shown on the final outcome, not duplicated per log
  const productOutcomeGroups: Array<{
    productId: number;
    productName: string;
    prodSqM: number;
    totalQty: number;
    totalSqM: number;
    isDone: boolean;
    entries: any[];
  }> = [];

  const handledPids = new Set<number>();

  for (const o of outcomes) {
    const pid = Number(o.finishedProductId || o.finishedProduct?.id);
    if (!pid || handledPids.has(pid)) continue;
    handledPids.add(pid);
    const prodName = o.finishedProduct?.name || 'Finished Product';
    const prodSqM = Number(o.finishedProduct?.sqM || 0);
    const entries = outcomeEntries.filter((e: any) => Number(e.finishedProductId || e.finishedProduct?.id) === pid);
    const totalQty = entries.length > 0
      ? entries.reduce((s: number, e: any) => s + Number(e.outcomeQuantity || 0), 0)
      : Number(o.outcomeQuantity || 0);
    const isDone = o.status === 'COMPLETED' || completed;
    productOutcomeGroups.push({
      productId: pid,
      productName: prodName,
      prodSqM,
      totalQty,
      totalSqM: totalQty * prodSqM,
      isDone,
      entries,
    });
  }

  for (const e of outcomeEntries) {
    const pid = Number(e.finishedProductId || e.finishedProduct?.id);
    if (!pid || handledPids.has(pid)) continue;
    handledPids.add(pid);
    const prodName = e.finishedProduct?.name || 'Finished Product';
    const prodSqM = Number(e.finishedProduct?.sqM || 0);
    const entries = outcomeEntries.filter((x: any) => Number(x.finishedProductId || x.finishedProduct?.id) === pid);
    const totalQty = entries.reduce((s: number, x: any) => s + Number(x.outcomeQuantity || 0), 0);
    productOutcomeGroups.push({
      productId: pid,
      productName: prodName,
      prodSqM,
      totalQty,
      totalSqM: totalQty * prodSqM,
      isDone: completed,
      entries,
    });
  }

  const wastageSqM = totalIntakeSqM > 0 ? Math.max(0, totalIntakeSqM - totalOutcomeSqM) : 0;
  const wastagePct = totalIntakeSqM > 0 ? (wastageSqM / totalIntakeSqM) * 100 : 0;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className={`${confirmFinish ? 'bg-[#16A34A]' : 'bg-[#1E3A8A]'} px-6 py-4 flex justify-between items-center shrink-0`}>
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              {confirmFinish ? <Flag className="text-white" size={24} /> : <Box className="text-white" size={24} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-wide">
                  {confirmFinish ? 'CONFIRM & FINISH PRODUCTION' : 'PRODUCTION DETAILS'}
                </h2>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${completed ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-slate-900'}`}>
                  {completed ? 'Completed' : 'Pending'}
                </span>
              </div>
              <p className={`${confirmFinish ? 'text-emerald-100' : 'text-blue-200'} text-xs font-medium`}>
                {confirmFinish
                  ? 'Review all batch details before moving this production to Completed'
                  : 'View Batch Materials, Products & Yield'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isFinishing}
            className="text-white hover:bg-white/20 p-2 rounded-full transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1 bg-gray-50">
          {confirmFinish && (
            <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-start gap-3">
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

          <div className="mt-6 relative">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
              {/* Intake */}
              <div className="bg-white rounded-xl border border-blue-100 shadow-sm overflow-hidden relative z-10">
                <div className="bg-blue-50/80 px-4 py-2 border-b border-blue-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package size={14} className="text-blue-700" />
                    <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">Material Intake ({intakes.length})</span>
                  </div>
                  <span className="text-xs font-bold text-blue-700">{totalIntakeSqM.toFixed(3)} m²</span>
                </div>
                <div className="divide-y divide-gray-100">
                  {intakes.map((intake: any, idx: number) => (
                    <div key={idx} className="p-3.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-900 break-words">
                          {formatRawMaterialLabel(intake.rawMaterial, intake.materialBatchCode, intake.materialCode)}
                        </p>
                        {Number(intake.sqM || 0) > 0 && (
                          <p className="text-[11px] text-gray-500 mt-0.5">Area: {Number(intake.sqM).toFixed(3)} m²</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Qty</p>
                        <p className="text-base font-black text-blue-600">{intake.intakeQuantity}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Outcome */}
              <div className="bg-white rounded-xl border border-emerald-100 shadow-sm overflow-hidden relative z-10 flex flex-col">
                <div className="bg-emerald-50/80 px-4 py-2 border-b border-emerald-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ArrowRight size={14} className="text-emerald-700" />
                    <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                      Product Outcome ({productOutcomeGroups.length})
                    </span>
                  </div>
                  <span className="text-xs font-bold text-emerald-700">{totalOutcomeSqM.toFixed(3)} m²</span>
                </div>
                <div className="divide-y divide-gray-100 flex-1">
                  {productOutcomeGroups.map((group: any, idx: number) => (
                    <div key={group.productId || idx} className="p-3.5 space-y-2.5">
                      {/* Product Summary Header with Final Status */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                              #{idx + 1}
                            </span>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                group.isDone
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : 'bg-amber-100 text-amber-800 border border-amber-300'
                              }`}
                            >
                              {group.isDone ? 'Completed' : 'Pending'}
                            </span>
                            <p className="text-xs font-black text-gray-900 break-words">{group.productName}</p>
                          </div>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            Prod Sq.M: {group.prodSqM.toFixed(3)} · Total Sq.M: {group.totalSqM.toFixed(3)} m²
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[10px] font-bold text-gray-400 uppercase">Total Qty</p>
                          <p className="text-base font-black text-emerald-600">{group.totalQty}</p>
                        </div>
                      </div>

                      {/* Update Logs / Timeline (Audit trail without redundant Completed badges) */}
                      {group.entries.length > 1 ? (
                        <div className="bg-emerald-50/40 rounded-lg p-2.5 border border-emerald-100/80 space-y-1.5">
                          <div className="flex items-center justify-between text-[10px] font-bold text-emerald-900 uppercase tracking-wide">
                            <span>Update History ({group.entries.length} entries)</span>
                            <span className="text-emerald-700">Audit Trail</span>
                          </div>
                          <div className="space-y-1">
                            {group.entries.map((entry: any, eIdx: number) => (
                              <div
                                key={entry.key || eIdx}
                                className="flex items-center justify-between text-xs py-1 px-2 rounded bg-white border border-emerald-100 text-gray-700"
                              >
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-bold text-gray-400">#{eIdx + 1}</span>
                                  <span className="text-[11px] text-gray-600">
                                    {formatDateTime(entry.date || production.date)}
                                  </span>
                                </div>
                                <span className="font-extrabold text-emerald-700">
                                  +{entry.outcomeQuantity} units
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        group.entries.length === 1 && (
                          <p className="text-[10px] text-gray-400 italic">
                            Logged at {formatDateTime(group.entries[0]?.date || production.date)}
                          </p>
                        )
                      )}
                    </div>
                  ))}
                </div>
                {totalOutcomeQty > 0 && (
                  <div className="bg-emerald-50/60 border-t border-emerald-100 px-4 py-2 flex items-center justify-between text-xs font-bold text-emerald-900">
                    <span>Total Batch Outcome</span>
                    <span className="text-sm font-black text-emerald-700">{totalOutcomeQty} units</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {totalIntakeSqM > 0 && (
            <div className="mt-5 bg-white rounded-xl border border-orange-200 p-4 grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase">Intake Sq.M</p>
                <p className="text-sm font-black text-blue-700">{totalIntakeSqM.toFixed(3)} m²</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase">Outcome Sq.M</p>
                <p className="text-sm font-black text-emerald-700">{totalOutcomeSqM.toFixed(3)} m²</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase">Wastage</p>
                <p className="text-sm font-black text-orange-600">
                  {wastageSqM.toFixed(2)} m² ({wastagePct.toFixed(2)}%)
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-white border-t border-gray-100 px-6 py-4 flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isFinishing}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 px-6 rounded-lg transition-colors text-sm disabled:opacity-50"
          >
            {confirmFinish ? 'Cancel' : 'Close'}
          </button>
          {confirmFinish && onConfirmFinish && (
            <button
              type="button"
              onClick={onConfirmFinish}
              disabled={isFinishing}
              className="bg-[#16A34A] hover:bg-[#15803D] text-white font-bold py-2 px-6 rounded-lg transition-colors text-sm flex items-center gap-2 shadow-sm disabled:opacity-50"
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
