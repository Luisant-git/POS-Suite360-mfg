import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Edit, Trash2, CheckCircle, Box, Grid, Maximize, Minimize, Search, PlusCircle, RotateCcw, Eye, X, Flag, Layers, Calendar } from 'lucide-react';
import DeleteConfirmationModal from '../../components/DeleteConfirmationModal';
import api from '../../services/api';
import SearchableSelect from '../../components/SearchableSelect';
import toast from 'react-hot-toast';
import ProductionGridEntry from './ProductionGridEntry';
import ProductionViewModal from '../../components/ProductionViewModal';
import LeaveConfirmModal from '../../components/LeaveConfirmModal';
import { useNavigate } from 'react-router-dom';
import {
  formatDateTime,
  formatRawMaterialLabel,
  generateNextBatchCode,
  getEffectiveIntakes,
  getEffectiveOutcomeEntries,
  getEffectiveOutcomes,
  getRawMaterialBatchOptions,
  isProductionCompleted,
  parseBatchWorkName,
} from '../../utils/productionBatch';

interface IntakeRow {
  rawMaterialId: number;
  materialCode: string;
  materialBatchCode: string;
  sqMPerRoll: number;
  intakeQuantity: string;
  sqM: string;
}

interface OutcomeRow {
  finishedProductId: number;
  previousQuantity: number;
  outcomeQuantity: string;
  status?: string;
  completedAt?: string | null;
}

const createEmptyIntake = (): IntakeRow => ({
  rawMaterialId: 0,
  materialCode: '',
  materialBatchCode: '',
  sqMPerRoll: 0,
  intakeQuantity: '',
  sqM: '',
});

const createEmptyOutcome = (): OutcomeRow => ({
  finishedProductId: 0,
  previousQuantity: 0,
  outcomeQuantity: '',
});

const getCombinedOutcomeQty = (o: OutcomeRow): number =>
  Math.max(0, Number(o.previousQuantity || 0)) + Math.max(0, parseInt(o.outcomeQuantity || '0', 10) || 0);

const Production = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'master' | 'grid'>('master');
  const [filterStatus, setFilterStatus] = useState<'pending' | 'completed'>('pending');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [workName, setWorkName] = useState('');
  const [batchCode, setBatchCode] = useState('');

  const [intakes, setIntakes] = useState<IntakeRow[]>([createEmptyIntake()]);
  const [outcomes, setOutcomes] = useState<OutcomeRow[]>([createEmptyOutcome()]);
  const [originalIntakeMap, setOriginalIntakeMap] = useState<Record<number, number>>({});

  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingProduction, setEditingProduction] = useState<any>(null);
  const [viewingProduction, setViewingProduction] = useState<any>(null);
  const [productionToFinish, setProductionToFinish] = useState<any>(null);
  const [confirmFinishFromForm, setConfirmFinishFromForm] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFullTable, setIsFullTable] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  const [updatingProductOutcome, setUpdatingProductOutcome] = useState<{
    productionId: number;
    batchCode: string;
    workName: string;
    finishedProductId: number;
    finishedProduct: any;
    previousQuantity: number;
    isFinished: boolean;
  } | null>(null);
  const [outcomeUpdateQty, setOutcomeUpdateQty] = useState('');
  const [outcomeUpdateDateTime, setOutcomeUpdateDateTime] = useState('');
  const [outcomeUpdateFinish, setOutcomeUpdateFinish] = useState(false);

  const [productToFinish, setProductToFinish] = useState<{
    productionId: number;
    batchCode: string;
    workName: string;
    finishedProductId: number;
    finishedProduct: any;
    outcomeQuantity: number;
  } | null>(null);

  const { data: rawMaterials = [] } = useQuery({
    queryKey: ['rawMaterials'],
    queryFn: async () => (await api.get('/raw-materials')).data,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: async () => (await api.get('/products')).data,
  });

  const { data: productions = [], isLoading } = useQuery({
    queryKey: ['productions'],
    queryFn: async () => (await api.get('/production')).data,
  });

  useEffect(() => {
    if (!isLoading && !editingId && productions) {
      setBatchCode(generateNextBatchCode(productions));
    }
  }, [isLoading, editingId, productions]);

  const addIntake = () => {
    setIntakes((prev) => [...prev, createEmptyIntake()]);
  };

  const removeIntake = (index: number) => {
    setIntakes((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  };

  const addOutcome = () => {
    setOutcomes((prev) => [...prev, createEmptyOutcome()]);
  };

  const removeOutcome = (index: number) => {
    setOutcomes((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  };

  const handleClear = () => {
    setBatchCode(generateNextBatchCode(productions));
    setWorkName('');
    setDate(new Date().toISOString().split('T')[0]);
    setIntakes([createEmptyIntake()]);
    setOutcomes([createEmptyOutcome()]);
    setOriginalIntakeMap({});
    setEditingId(null);
    setEditingProduction(null);
  };

  const handleAddNew = () => {
    setIsFullTable(false);
    setEditingId(null);
    setEditingProduction(null);
    handleClear();
    setIsMobileDrawerOpen(true);
  };

  const getAvailableStockForMaterial = (rawMaterialId: number, currentIndex: number) => {
    const material = rawMaterials.find((m: any) => m.id === rawMaterialId);
    const baseStock = Number(material?.currentStock || 0);
    const originalQty = Number(originalIntakeMap[rawMaterialId] || 0);
    const otherRowsQty = intakes.reduce(
      (sum, row, idx) => (idx !== currentIndex && row.rawMaterialId === rawMaterialId ? sum + (Number(row.intakeQuantity) || 0) : sum),
      0
    );
    return baseStock + originalQty - otherRowsQty;
  };

  const updateIntake = (index: number, field: keyof IntakeRow, value: any) => {
    const newIntakes = [...intakes];
    const row = { ...newIntakes[index] };

    if (field === 'rawMaterialId') {
      const matId = Number(value);
      const material = rawMaterials.find((m: any) => m.id === matId);
      const batchOpts = getRawMaterialBatchOptions(material);
      const defaultOpt =
        batchOpts.find((b) => b.batchCode === (material?.batchCode || '')) || batchOpts[0];
      const defaultBatch = defaultOpt?.batchCode || material?.batchCode || '';
      const defaultMatCode =
        defaultOpt?.materialCode || material?.rawMaterialPurchaseItems?.[0]?.materialCode || '';
      const defaultSqMPerRoll =
        defaultOpt?.sqM ||
        Number(material?.rawMaterialPurchaseItems?.[0]?.sqM || 0);
      row.rawMaterialId = matId;
      row.materialCode = defaultMatCode;
      row.materialBatchCode = defaultBatch;
      row.sqMPerRoll = defaultSqMPerRoll;
      const qty = Number(row.intakeQuantity) || 0;
      row.sqM = (qty * defaultSqMPerRoll).toFixed(3);
    } else if (field === 'materialCode') {
      row.materialCode = String(value);
    } else if (field === 'materialBatchCode') {
      const material = rawMaterials.find((m: any) => m.id === row.rawMaterialId);
      const batchOpts = getRawMaterialBatchOptions(material);
      const matchedBatch = batchOpts.find((b) => b.batchCode === String(value).trim());
      const nextSqMPerRoll =
        matchedBatch?.sqM ||
        row.sqMPerRoll ||
        Number(material?.rawMaterialPurchaseItems?.[0]?.sqM || 0);
      row.materialBatchCode = String(value);
      if (matchedBatch?.materialCode) {
        row.materialCode = matchedBatch.materialCode;
      }
      row.sqMPerRoll = nextSqMPerRoll;
      const qty = Number(row.intakeQuantity) || 0;
      row.sqM = (qty * nextSqMPerRoll).toFixed(3);
    } else if (field === 'intakeQuantity') {
      const numVal = Number(value || 0);
      const availableStock = getAvailableStockForMaterial(row.rawMaterialId, index);
      if (row.rawMaterialId > 0 && numVal > availableStock) {
        toast.error(`Quantity Intake cannot exceed Available Stock (${availableStock})`);
        return;
      }
      const material = rawMaterials.find((m: any) => m.id === row.rawMaterialId);
      const sqMPerRoll = row.sqMPerRoll || Number(material?.rawMaterialPurchaseItems?.[0]?.sqM || 0);
      row.intakeQuantity = String(value);
      row.sqM = (numVal * sqMPerRoll).toFixed(3);
    }

    newIntakes[index] = row;
    setIntakes(newIntakes);
  };

  const updateOutcome = (index: number, field: keyof OutcomeRow, value: any) => {
    const newOutcomes = [...outcomes];
    const row = { ...newOutcomes[index] };

    if (field === 'finishedProductId') {
      const prodId = Number(value);
      if (row.finishedProductId !== prodId) {
        row.previousQuantity = 0;
      }
      row.finishedProductId = prodId;
      // Auto-populate intake only when starting fresh and user hasn't picked a raw material yet
      if (
        !editingId &&
        prodId > 0 &&
        intakes.length === 1 &&
        intakes[0].rawMaterialId === 0
      ) {
        const product = products.find((p: any) => p.id === prodId);
        if (product?.rawMaterials?.length > 0) {
          const suggestedIntakes: IntakeRow[] = product.rawMaterials.map((rmMap: any) => {
            const material = rawMaterials.find((m: any) => m.id === rmMap.rawMaterialId);
            const batchOpts = getRawMaterialBatchOptions(material);
            const defaultOpt =
              batchOpts.find((b) => b.batchCode === (material?.batchCode || '')) || batchOpts[0];
            const defaultBatch = defaultOpt?.batchCode || material?.batchCode || '';
            const defaultMatCode =
              defaultOpt?.materialCode || material?.rawMaterialPurchaseItems?.[0]?.materialCode || '';
            const sqMPerRoll =
              defaultOpt?.sqM ||
              Number(material?.rawMaterialPurchaseItems?.[0]?.sqM || 0);
            return {
              rawMaterialId: rmMap.rawMaterialId,
              materialCode: defaultMatCode,
              materialBatchCode: defaultBatch,
              sqMPerRoll,
              intakeQuantity: '',
              sqM: '0.000',
            };
          });
          setIntakes(suggestedIntakes);
        }
      }
    } else if (field === 'outcomeQuantity') {
      row.outcomeQuantity = String(value);
    }

    newOutcomes[index] = row;
    setOutcomes(newOutcomes);
  };

  const totalOutcomeQty = useMemo(
    () => outcomes.reduce((sum, o) => sum + getCombinedOutcomeQty(o), 0),
    [outcomes]
  );

  const buildPayload = (finishBatch = false) => {
    const finalWorkName = batchCode ? `${batchCode} - ${workName}` : workName;
    const validIntakes = intakes
      .filter((i) => i.rawMaterialId > 0)
      .map((i) => ({
        rawMaterialId: Number(i.rawMaterialId),
        materialCode: i.materialCode?.trim() || '',
        materialBatchCode: i.materialBatchCode?.trim() || '',
        intakeQuantity: Math.max(0, parseInt(i.intakeQuantity || '0', 10) || 0),
        sqM: Math.max(0, parseFloat(i.sqM || '0') || 0),
      }));

    const validOutcomes = outcomes
      .filter((o) => o.finishedProductId > 0)
      .map((o) => {
        const qty = getCombinedOutcomeQty(o);
        const prod = products.find((p: any) => p.id === o.finishedProductId);
        const prodSqM = Number(prod?.sqM || 0);
        return {
          finishedProductId: Number(o.finishedProductId),
          outcomeQuantity: qty,
          sqM: Number((qty * prodSqM).toFixed(4)),
        };
      });

    return {
      date,
      workName: finalWorkName,
      finish: finishBatch,
      status: finishBatch ? 'COMPLETED' : 'PENDING',
      intakes: validIntakes,
      outcomes: validOutcomes,
    };
  };

  const saveMutation = useMutation({
    mutationFn: async (finishBatch: boolean) => {
      const payload = buildPayload(finishBatch);
      if (editingId) {
        if (finishBatch) {
          return api.patch(`/production/${editingId}/finish`, payload);
        }
        return api.patch(`/production/${editingId}`, payload);
      }
      return api.post('/production', payload);
    },
    onSuccess: (_res, finishBatch) => {
      queryClient.invalidateQueries({ queryKey: ['productions'] });
      queryClient.invalidateQueries({ queryKey: ['rawMaterials'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      if (editingId) {
        toast.success(
          finishBatch
            ? 'Production finished and marked Completed!'
            : 'Production updated (kept in Pending for further updates)'
        );
      } else {
        toast.success('Production started and saved in Pending');
      }
      handleClear();
      setProductionToFinish(null);
      setConfirmFinishFromForm(false);
      setIsMobileDrawerOpen(false);
    },
    onError: (err: any) => {
      console.error(err);
      toast.error(err?.response?.data?.message || 'Failed to save production entry');
    },
  });

  const quickFinishMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/production/${id}/finish`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productions'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Production batch marked Completed!');
      setProductionToFinish(null);
      setConfirmFinishFromForm(false);
    },
    onError: (err: any) => {
      console.error(err);
      toast.error(err?.response?.data?.message || 'Failed to finish production');
    },
  });

  const productOutcomeMutation = useMutation({
    mutationFn: async (payload: {
      productionId: number;
      finishedProductId: number;
      outcomeQuantity: number;
      finish: boolean;
      date: string;
    }) => {
      const { data } = await api.patch(
        `/production/${payload.productionId}/outcome-update`,
        {
          finishedProductId: payload.finishedProductId,
          outcomeQuantity: payload.outcomeQuantity,
          finish: payload.finish,
          date: payload.date,
        },
      );
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['productions'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success(
        variables.finish
          ? 'Product outcome updated and marked Completed!'
          : 'Product outcome updated successfully!',
      );
      setUpdatingProductOutcome(null);
      setOutcomeUpdateQty('');
      setOutcomeUpdateFinish(false);
    },
    onError: (err: any) => {
      console.error(err);
      toast.error(err?.response?.data?.message || 'Failed to update product outcome');
    },
  });

  const finishSingleProductMutation = useMutation({
    mutationFn: async (payload: { productionId: number; finishedProductId: number }) => {
      const { data } = await api.patch(
        `/production/${payload.productionId}/outcome-finish/${payload.finishedProductId}`,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productions'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product marked as Completed!');
      setProductToFinish(null);
    },
    onError: (err: any) => {
      console.error(err);
      toast.error(err?.response?.data?.message || 'Failed to finish product');
    },
  });

  const handleOpenProductOutcomeUpdate = (production: any, entry: any) => {
    const { batchCode: bCode, workName: wName } = parseBatchWorkName(production.workName);
    const outcomesList = getEffectiveOutcomes(production);
    const parentOutcome = outcomesList.find(
      (o: any) => Number(o.finishedProductId) === Number(entry.finishedProductId),
    );
    const prevQty = Number(parentOutcome?.outcomeQuantity || 0);
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const localDateTimeStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;

    setUpdatingProductOutcome({
      productionId: production.id,
      batchCode: bCode,
      workName: wName,
      finishedProductId: Number(entry.finishedProductId),
      finishedProduct: entry.finishedProduct,
      previousQuantity: prevQty,
      isFinished: parentOutcome?.status === 'COMPLETED' || entry.isFinished,
    });
    setOutcomeUpdateQty('');
    setOutcomeUpdateDateTime(localDateTimeStr);
    setOutcomeUpdateFinish(false);
  };

  const handleSaveProductOutcomeUpdate = () => {
    if (!updatingProductOutcome) return;
    const addedQty = Math.max(0, parseInt(outcomeUpdateQty || '0', 10) || 0);
    if (addedQty <= 0 && !outcomeUpdateFinish) {
      toast.error('Please enter an outcome quantity greater than 0, or mark as Completed');
      return;
    }
    productOutcomeMutation.mutate({
      productionId: updatingProductOutcome.productionId,
      finishedProductId: updatingProductOutcome.finishedProductId,
      outcomeQuantity: addedQty,
      finish: outcomeUpdateFinish,
      date: outcomeUpdateDateTime ? new Date(outcomeUpdateDateTime).toISOString() : new Date().toISOString(),
    });
  };

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/production/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productions'] });
      queryClient.invalidateQueries({ queryKey: ['rawMaterials'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Production entry deleted and stock restored');
      setItemToDelete(null);
    },
    onError: (err: any) => {
      console.error(err);
      toast.error('Failed to delete production entry');
      setItemToDelete(null);
    },
  });

  const validateAndSubmit = (finishBatch = false) => {
    if (!workName.trim()) {
      toast.error('Please fill Work Name');
      return;
    }
    const validIntakes = intakes.filter((i) => i.rawMaterialId > 0);
    const validOutcomes = outcomes.filter((o) => o.finishedProductId > 0);
    if (validIntakes.length === 0) {
      toast.error('Please add at least one Raw Material.');
      return;
    }
    if (validOutcomes.length === 0) {
      toast.error('Please add at least one Finished Product.');
      return;
    }
    if (finishBatch && validOutcomes.every((o) => getCombinedOutcomeQty(o) <= 0)) {
      toast.error('Please enter Outcome Quantity before finishing production.');
      return;
    }
    saveMutation.mutate(finishBatch);
  };

  const handleRequestFinishFromForm = () => {
    if (!workName.trim()) {
      toast.error('Please fill Work Name');
      return;
    }
    const validIntakes = intakes.filter((i) => i.rawMaterialId > 0);
    const validOutcomes = outcomes.filter((o) => o.finishedProductId > 0);
    if (validIntakes.length === 0) {
      toast.error('Please add at least one Raw Material.');
      return;
    }
    if (validOutcomes.length === 0) {
      toast.error('Please add at least one Finished Product.');
      return;
    }
    if (validOutcomes.every((o) => getCombinedOutcomeQty(o) <= 0)) {
      toast.error('Please enter Outcome Quantity before finishing production.');
      return;
    }

    const baseLogs = editingProduction ? getEffectiveOutcomeEntries(editingProduction).filter((e: any) => Number(e.outcomeQuantity || 0) !== 0) : [];
    const addedLogs = validOutcomes
      .map((o, idx) => {
        const addedQty = Math.max(0, parseInt(o.outcomeQuantity || '0', 10) || 0);
        if (addedQty <= 0) return null;
        const finishedProduct = products.find((p: any) => p.id === Number(o.finishedProductId));
        return {
          id: `preview-${idx}-${Date.now()}`,
          finishedProductId: Number(o.finishedProductId),
          finishedProduct,
          outcomeQuantity: addedQty,
          sqM: Number((addedQty * Number(finishedProduct?.sqM || 0)).toFixed(4)),
          date: new Date().toISOString(),
        };
      })
      .filter(Boolean);

    const previewProduction = {
      id: editingId,
      date,
      workName: batchCode ? `${batchCode} - ${workName}` : workName,
      status: 'PENDING',
      intakes: validIntakes.map((i) => ({
        rawMaterialId: Number(i.rawMaterialId),
        rawMaterial: rawMaterials.find((m: any) => m.id === Number(i.rawMaterialId)),
        materialCode: i.materialCode?.trim() || '',
        materialBatchCode: i.materialBatchCode?.trim() || '',
        intakeQuantity: Math.max(0, parseInt(i.intakeQuantity || '0', 10) || 0),
        sqM: Math.max(0, parseFloat(i.sqM || '0') || 0),
      })),
      outcomes: validOutcomes.map((o) => {
        const finishedProduct = products.find((p: any) => p.id === Number(o.finishedProductId));
        const qty = getCombinedOutcomeQty(o);
        return {
          finishedProductId: Number(o.finishedProductId),
          finishedProduct,
          outcomeQuantity: qty,
          sqM: Number((qty * Number(finishedProduct?.sqM || 0)).toFixed(4)),
        };
      }),
      outcomeLogs: [...baseLogs, ...addedLogs],
    };

    setConfirmFinishFromForm(true);
    setProductionToFinish(previewProduction);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    validateAndSubmit(false);
  };

  const handleEdit = (production: any) => {
    setIsFullTable(false);
    setEditingId(production.id);
    setEditingProduction(production);
    setDate(new Date(production.date).toISOString().split('T')[0]);

    const { batchCode: parsedBatchCode, workName: parsedWorkName } = parseBatchWorkName(production.workName);
    setBatchCode(parsedBatchCode !== '-' ? parsedBatchCode : '');
    setWorkName(parsedWorkName !== '-' ? parsedWorkName : '');

    const loadedIntakes = getEffectiveIntakes(production);
    const loadedOutcomes = getEffectiveOutcomes(production);

    const origMap: Record<number, number> = {};
    const formattedIntakes: IntakeRow[] = loadedIntakes.map((i: any) => {
      const rmId = Number(i.rawMaterialId);
      const qty = Number(i.intakeQuantity || 0);
      origMap[rmId] = (origMap[rmId] || 0) + qty;
      const material = rawMaterials.find((m: any) => m.id === rmId) || i.rawMaterial;
      const batchOpts = getRawMaterialBatchOptions(material);
      const batch = i.materialBatchCode || material?.batchCode || batchOpts[0]?.batchCode || '';
      const matchedOpt = batchOpts.find((b) => b.batchCode === batch);
      const sqMPerRoll =
        matchedOpt?.sqM ||
        Number(material?.rawMaterialPurchaseItems?.[0]?.sqM || 0) ||
        (qty > 0 && Number(i.sqM || 0) > 0 ? Number(i.sqM) / qty : 0);
      const sqMVal = Number(i.sqM || 0) > 0 ? Number(i.sqM) : qty * sqMPerRoll;
      return {
        rawMaterialId: rmId,
        materialCode:
          i.materialCode ||
          matchedOpt?.materialCode ||
          material?.rawMaterialPurchaseItems?.[0]?.materialCode ||
          '',
        materialBatchCode: batch,
        sqMPerRoll,
        intakeQuantity: String(qty),
        sqM: sqMVal.toFixed(3),
      };
    });

    const formattedOutcomes: OutcomeRow[] = loadedOutcomes.map((o: any) => ({
      finishedProductId: Number(o.finishedProductId),
      previousQuantity: Number(o.outcomeQuantity || 0),
      outcomeQuantity: '',
      status: o.status || 'PENDING',
      completedAt: o.completedAt || null,
    }));

    setOriginalIntakeMap(origMap);
    setIntakes(formattedIntakes.length > 0 ? formattedIntakes : [createEmptyIntake()]);
    setOutcomes(formattedOutcomes.length > 0 ? formattedOutcomes : [createEmptyOutcome()]);
    setIsMobileDrawerOpen(true);
  };

  const handleView = (production: any) => {
    setViewingProduction(production);
  };

  useEffect(() => {
    if (activeTab !== 'master') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F10') {
        e.preventDefault();
        validateAndSubmit(false);
      } else if (e.key === 'F2') {
        e.preventDefault();
        addIntake();
      } else if (e.key === 'F4') {
        e.preventDefault();
        handleClear();
      } else if (e.key === 'Escape') {
        if (isMobileDrawerOpen) {
          setIsMobileDrawerOpen(false);
        } else if (showLeaveModal) {
          setShowLeaveModal(false);
        } else {
          setShowLeaveModal(true);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, intakes, outcomes, workName, batchCode, date, editingId, showLeaveModal, isMobileDrawerOpen]);

  const filteredProductions = productions.filter((p: any) => {
    const completed = isProductionCompleted(p);
    if (filterStatus === 'pending' && completed) return false;
    if (filterStatus === 'completed' && !completed) return false;

    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const rowIntakes = getEffectiveIntakes(p);
    const rowOutcomes = getEffectiveOutcomes(p);
    return (
      p.workName?.toLowerCase().includes(term) ||
      p.materialBatchCode?.toLowerCase().includes(term) ||
      rowIntakes.some(
        (i: any) =>
          formatRawMaterialLabel(i.rawMaterial, i.materialBatchCode).toLowerCase().includes(term)
      ) ||
      rowOutcomes.some((o: any) => o.finishedProduct?.name?.toLowerCase().includes(term))
    );
  });

  return (
    <div className="absolute inset-0 bg-[#F3F4F6] flex flex-col z-10 font-sans overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-gray-300 shrink-0 bg-white shadow-sm overflow-x-auto">
        <button
          className={`px-4 sm:px-6 py-3 text-[12px] sm:text-[13px] font-bold tracking-wider uppercase transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'master'
              ? 'border-b-2 border-[#3B82F6] text-[#3B82F6] bg-blue-50/50'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
          onClick={() => setActiveTab('master')}
        >
          <Box size={16} /> Master View
        </button>
        <button
          className={`px-4 sm:px-6 py-3 text-[12px] sm:text-[13px] font-bold tracking-wider uppercase transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'grid'
              ? 'border-b-2 border-[#10B981] text-[#10B981] bg-emerald-50/50'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
          onClick={() => setActiveTab('grid')}
        >
          <Grid size={16} /> Grid Entry View
        </button>
      </div>

      {activeTab === 'grid' ? (
        <div className="flex-1 min-h-0 overflow-hidden relative">
          <ProductionGridEntry onSwitchToMaster={() => setActiveTab('master')} />
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 grid-rows-1 gap-3 sm:gap-4 flex-1 min-h-0 overflow-hidden p-2 sm:p-4 relative">
          {/* Mobile Drawer Backdrop */}
          {isMobileDrawerOpen && (
            <div
              className="xl:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-xs transition-opacity duration-200"
              onClick={() => setIsMobileDrawerOpen(false)}
            />
          )}

          {/* Left Column: Form */}
          {!isFullTable && (
            <div
              className={`
              bg-white border border-[#E6E9ED] shadow-sm rounded-sm flex-col min-h-0 overflow-hidden
              xl:col-span-5 2xl:col-span-4 xl:static xl:z-auto xl:h-full xl:min-h-0 xl:overflow-hidden xl:max-w-none xl:shadow-sm xl:rounded-sm xl:flex
              ${
                isMobileDrawerOpen
                  ? 'fixed inset-y-0 right-0 z-50 w-full max-w-lg shadow-2xl flex h-full animate-in slide-in-from-right duration-200'
                  : 'hidden'
              }
            `}
            >
              <div className="bg-[#EBF5FF] border-b border-[#3B82F6] px-4 py-2 flex items-center justify-between rounded-t-sm shrink-0">
                <div className="flex items-center gap-2">
                  <Box size={16} className="text-[#1E3A8A]" />
                  <h2 className="font-bold text-[14px] text-[#1E3A8A] uppercase">
                    {editingId ? 'UPDATE / FINISH PRODUCTION' : 'PRODUCTION ENTRY'}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-[#EF4444] hover:bg-red-50 px-2 py-1 rounded flex items-center gap-1 text-[11px] font-bold transition-colors"
                  >
                    <RotateCcw size={12} /> CLEAR (F4)
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsMobileDrawerOpen(false)}
                    className="xl:hidden p-1 rounded hover:bg-blue-100 text-[#1E3A8A] transition-colors"
                    title="Close drawer"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                <div className="p-3 flex flex-col gap-3">
                  {/* Batch Code, Work Name & Date */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[12px] font-bold text-[#1F2937] mb-1">Batch Code (Auto)</label>
                      <input
                        type="text"
                        value={batchCode}
                        readOnly
                        className="w-full px-3 py-1.5 border border-[#ccc] rounded shadow-inner outline-none text-[13px] bg-gray-100 text-gray-500 cursor-not-allowed font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-bold text-[#1F2937] mb-1">Work Name *</label>
                      <input
                        type="text"
                        value={workName}
                        onChange={(e) => setWorkName(e.target.value)}
                        placeholder="e.g. Manufacturing A"
                        className="w-full px-3 py-1.5 border border-[#ccc] rounded shadow-inner outline-none text-[13px] focus:border-[#3B82F6]"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[12px] font-bold text-[#1F2937] mb-1">Production Date *</label>
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full px-3 py-1.5 border border-[#ccc] rounded shadow-inner outline-none text-[13px] focus:border-[#3B82F6]"
                      />
                    </div>
                  </div>

                  {/* Finished Products Section (Multiple Allowed) */}
                  <div className="bg-emerald-50/50 p-3 rounded-md border border-emerald-200 mt-1 space-y-2.5">
                    <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                      <h3 className="font-bold text-[13px] text-emerald-800">Finished Products (Outcome)</h3>
                      <button
                        type="button"
                        onClick={addOutcome}
                        className="text-emerald-700 hover:bg-emerald-100 px-2 py-1 rounded flex items-center gap-1 text-[11px] font-bold transition-colors border border-emerald-300 bg-white"
                      >
                        <PlusCircle size={13} /> ADD PRODUCT
                      </button>
                    </div>

                    {outcomes.map((outRow, idx) => {
                      const prod = products.find((p: any) => p.id === outRow.finishedProductId);
                      return (
                        <div key={idx} className="bg-white p-2.5 rounded border border-emerald-200/80 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-bold text-emerald-800 uppercase">Product #{idx + 1}</span>
                              {editingId && (
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                    outRow.status === 'COMPLETED'
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                                  }`}
                                >
                                  {outRow.status === 'COMPLETED' ? 'Completed' : 'Pending'}
                                </span>
                              )}
                            </div>
                            {outcomes.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeOutcome(idx)}
                                className="text-red-500 hover:bg-red-50 p-1 rounded border border-red-200"
                                title="Remove Product"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                          <div>
                            <SearchableSelect
                              value={outRow.finishedProductId}
                              onChange={(val) => updateOutcome(idx, 'finishedProductId', Number(val))}
                              options={[
                                { label: 'Select product...', value: 0 },
                                ...products.map((p: any) => ({ label: `${p.name}`, value: p.id })),
                              ]}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-bold text-gray-600 mb-0.5">Prod Sq.M</label>
                              <input
                                type="text"
                                readOnly
                                tabIndex={-1}
                                value={prod?.sqM ? Number(prod.sqM).toFixed(3) : '0.000'}
                                className="w-full px-2 py-1 border border-[#ccc] rounded bg-gray-100 text-[12px] outline-none text-right font-bold text-gray-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-gray-600 mb-0.5">Out Sq.M</label>
                              <input
                                type="text"
                                readOnly
                                tabIndex={-1}
                                value={(Number(outRow.previousQuantity || 0) * Number(prod?.sqM || 0)).toFixed(3)}
                                className="w-full px-2 py-1 border border-[#E5E7EB] rounded bg-emerald-50 text-[12px] outline-none text-right font-bold text-emerald-700"
                              />
                            </div>
                          </div>
                          {editingId && (
                            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-emerald-100">
                              <span className="font-bold text-gray-600">Produced so far:</span>
                              <span className="font-extrabold text-emerald-900">{outRow.previousQuantity || 0} units</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Raw Materials Section (Multiple Allowed + Name-Code-BatchCode format) */}
                  <div className="flex justify-between items-center mt-1 border-b border-[#E5E7EB] pb-2">
                    <h3 className="font-bold text-[13px] text-blue-800">Raw Materials Used (Intake)</h3>
                    <button
                      type="button"
                      onClick={addIntake}
                      className="text-blue-600 hover:bg-blue-50 px-2.5 py-1 rounded flex items-center gap-1 text-[11px] font-bold transition-colors border border-blue-200 border-dashed bg-white"
                    >
                      <PlusCircle size={13} /> ADD MATERIAL (F2)
                    </button>
                  </div>

                  <div className="flex flex-col gap-3">
                    {intakes.map((item, index) => {
                      const selectedMat = rawMaterials.find((m: any) => m.id === item.rawMaterialId);
                      const batchOptions = getRawMaterialBatchOptions(selectedMat);
                      const datalistId = `rm-batch-opts-${index}`;
                      const formattedLabel = selectedMat
                        ? formatRawMaterialLabel(selectedMat, item.materialBatchCode, item.materialCode)
                        : '';

                      return (
                        <div key={index} className="bg-blue-50/40 p-2.5 rounded-md border border-blue-100 flex flex-col gap-2">
                          <div className="w-full min-w-0">
                            <label className="block text-[10px] font-bold text-blue-800 mb-1">
                              Material Name - Code - Batch Code
                            </label>
                            <SearchableSelect
                              value={item.rawMaterialId}
                              onChange={(val) => updateIntake(index, 'rawMaterialId', Number(val))}
                              options={[
                                { label: 'Select material...', value: 0 },
                                ...rawMaterials.map((m: any) => ({
                                  label: `${formatRawMaterialLabel(m)} (Stock: ${m.currentStock})`,
                                  value: m.id,
                                })),
                              ]}
                            />
                            {formattedLabel && (
                              <p className="text-[10px] font-bold text-blue-700 mt-1 truncate">
                                {formattedLabel}
                              </p>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full min-w-0">
                            <div className="w-full min-w-0">
                              <label className="block text-[10px] font-bold text-gray-700 mb-1">
                                Material Code
                              </label>
                              <input
                                type="text"
                                value={item.materialCode}
                                onChange={(e) => updateIntake(index, 'materialCode', e.target.value)}
                                placeholder="e.g. MLJ1019"
                                className="w-full px-2.5 py-1.5 border border-[#ccc] rounded text-[12px] bg-white outline-none focus:border-blue-500"
                              />
                            </div>
                            <div className="w-full min-w-0">
                              <label className="block text-[10px] font-bold text-gray-700 mb-1">
                                Material Batch Code
                              </label>
                              <input
                                type="text"
                                list={datalistId}
                                value={item.materialBatchCode}
                                onChange={(e) => updateIntake(index, 'materialBatchCode', e.target.value)}
                                placeholder="e.g. L2609250315/4/6"
                                className="w-full px-2.5 py-1.5 border border-[#ccc] rounded text-[12px] bg-white outline-none focus:border-blue-500"
                              />
                              <datalist id={datalistId}>
                                {batchOptions.map((b) => (
                                  <option key={`${b.materialCode}-${b.batchCode}`} value={b.batchCode}>
                                    {b.materialCode ? `${b.materialCode} - ` : ''}{b.batchCode} ({b.sqM.toFixed(3)} m²/roll)
                                  </option>
                                ))}
                              </datalist>
                            </div>
                          </div>

                          <div className="flex items-end gap-2 w-full">
                            <div className="flex-1 min-w-0">
                              <label className="block text-[10px] font-bold text-gray-600 mb-1">Quantity</label>
                              <input
                                type="number"
                                min="0"
                                value={item.intakeQuantity}
                                onChange={(e) => updateIntake(index, 'intakeQuantity', e.target.value)}
                                placeholder="0"
                                onFocus={(e) => e.target.select()}
                                className="w-full px-2 py-1.5 border border-[#ccc] rounded text-[13px] outline-none text-right font-bold focus:border-blue-500 text-blue-700 bg-white"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <label className="block text-[10px] font-bold text-gray-600 mb-1">Sq.M</label>
                              <input
                                type="text"
                                value={item.sqM || '0.000'}
                                readOnly
                                tabIndex={-1}
                                className="w-full px-2 py-1.5 border border-[#E5E7EB] rounded bg-gray-100 text-[13px] outline-none text-right font-bold text-gray-500 cursor-not-allowed"
                              />
                            </div>
                            {intakes.length > 1 && (
                              <div className="pb-0.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => removeIntake(index)}
                                  className="text-red-500 hover:bg-red-50 p-1.5 rounded border border-red-200 bg-white"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Product Outcomes Summary (Shown only when viewing/editing existing batch) */}
                  {editingId && (
                    <div className="mt-2 border-t-[3px] border-emerald-500 bg-emerald-50 p-3 rounded-lg shadow-sm space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-[11px] font-black text-emerald-900 uppercase tracking-wide">
                          Product Outcomes Summary
                        </label>
                        <span className="text-[10px] font-extrabold text-emerald-800">
                          Total Produced: {totalOutcomeQty}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {outcomes.map((outRow, idx) => {
                          const prod = products.find((p: any) => p.id === outRow.finishedProductId);
                          const isDone = outRow.status === 'COMPLETED';
                          return (
                            <div key={idx} className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded border border-emerald-200 text-xs">
                              <span className="font-bold text-gray-800 truncate">{prod?.name || `Product #${idx + 1}`}</span>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="font-extrabold text-emerald-800">{outRow.previousQuantity || 0} units</span>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${isDone ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-800 border border-amber-300'}`}>
                                  {isDone ? 'Completed' : 'Pending'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-[10px] text-gray-500 italic leading-snug">
                        Tip: Update or finish each product individually in the table using the <strong>+ Update</strong> and <strong>Finish</strong> buttons.
                      </p>
                    </div>
                  )}

                  {/* Action Buttons: Save (Green), Update (Keep Pending), Finish Production */}
                  <div className="flex flex-col gap-2 mt-4 shrink-0">
                    {!editingId ? (
                      <button
                        type="submit"
                        disabled={saveMutation.isPending}
                        className="w-full bg-[#16A34A] hover:bg-[#15803D] text-white font-bold py-2.5 rounded flex justify-center items-center gap-2 transition-colors disabled:opacity-50"
                      >
                        <CheckCircle size={16} />
                        {saveMutation.isPending ? 'SAVING...' : 'SAVE PRODUCTION (F10)'}
                      </button>
                    ) : (
                      <>
                        <button
                          type="submit"
                          disabled={saveMutation.isPending}
                          className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold py-2.5 rounded flex justify-center items-center gap-2 transition-colors disabled:opacity-50"
                        >
                          <Edit size={16} />
                          {saveMutation.isPending ? 'UPDATING...' : 'UPDATE PRODUCTION (KEEP PENDING)'}
                        </button>
                        <button
                          type="button"
                          disabled={saveMutation.isPending}
                          onClick={handleRequestFinishFromForm}
                          className="w-full bg-[#16A34A] hover:bg-[#15803D] text-white font-bold py-2.5 rounded flex justify-center items-center gap-2 transition-colors disabled:opacity-50 shadow-sm"
                        >
                          <Flag size={16} />
                          FINISH PRODUCTION
                        </button>
                        <button
                          type="button"
                          onClick={handleClear}
                          className="w-full bg-[#6B7280] hover:bg-[#4B5563] text-white font-bold py-2 rounded flex justify-center items-center gap-2 transition-colors"
                        >
                          <RotateCcw size={15} />
                          CANCEL EDIT
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* Right Column: List */}
          <div
            className={`${isFullTable ? 'xl:col-span-12' : 'xl:col-span-7 2xl:col-span-8'} bg-white border border-[#E6E9ED] shadow-sm rounded-sm overflow-hidden flex flex-col h-full min-h-0 min-w-0 w-full`}
          >
            <div className="bg-[#EBF5FF] border-b border-[#3B82F6] px-3 sm:px-4 py-2.5 sm:py-3 flex flex-wrap justify-between items-center gap-2 shrink-0">
              <div className="flex items-center gap-2 text-[#1E3A8A]">
                <Grid size={16} className="text-[#1E3A8A] shrink-0" />
                <h2 className="font-bold text-[13px] sm:text-[14px]">PRODUCTION LIST</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddNew}
                  className="xl:hidden bg-[#16A34A] hover:bg-[#15803D] text-white px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1 shadow-xs transition-colors whitespace-nowrap"
                >
                  <PlusCircle size={13} /> New Entry
                </button>
                <div className="bg-gray-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-xl whitespace-nowrap">
                  {filteredProductions.length} Entries
                </div>
              </div>
            </div>

            <div className="p-2.5 sm:p-3 border-b border-[#E6E9ED] bg-white flex flex-wrap justify-between items-center gap-2.5 shrink-0">
              <div className="relative flex-1 min-w-[200px]">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                  <Search size={14} className="text-gray-400" />
                </div>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search batch, work, material code/batch, product..."
                  className="w-full pl-8 pr-3 py-1.5 border border-[#ccc] rounded text-[13px] outline-none focus:border-[#3B82F6]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end shrink-0">
                <div className="flex bg-gray-100 p-0.5 rounded border border-gray-300 flex-1 sm:flex-none">
                  <button
                    type="button"
                    onClick={() => setFilterStatus('pending')}
                    className={`flex-1 sm:flex-none px-3 py-1 text-[12px] font-bold rounded-sm transition-colors whitespace-nowrap ${
                      filterStatus === 'pending'
                        ? 'bg-white shadow-sm text-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Pending
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterStatus('completed')}
                    className={`flex-1 sm:flex-none px-3 py-1 text-[12px] font-bold rounded-sm transition-colors whitespace-nowrap ${
                      filterStatus === 'completed'
                        ? 'bg-white shadow-sm text-emerald-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Completed
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFullTable(!isFullTable)}
                  className="hidden xl:flex items-center gap-1.5 text-[#3B82F6] hover:bg-[#EFF6FF] px-3 py-1.5 rounded text-[12px] font-bold transition-colors border border-[#3B82F6] whitespace-nowrap"
                >
                  {isFullTable ? <Minimize size={14} /> : <Maximize size={14} />}
                  {isFullTable ? 'Show Form' : 'View Full Table'}
                </button>
              </div>
            </div>

            {/* Mobile & Small Tablet Card List (< MD) */}
            <div className="md:hidden flex-1 min-h-0 overflow-y-auto custom-scrollbar p-2.5 sm:p-3 space-y-2.5 bg-gray-50">
              {isLoading ? (
                <div className="text-center p-6 text-gray-500">Loading...</div>
              ) : filteredProductions.length === 0 ? (
                <div className="text-center p-6 text-gray-500 bg-white rounded-lg border border-dashed border-gray-300">
                  No production entries found.
                </div>
              ) : (
                filteredProductions.map((production: any) => {
                  const completed = isProductionCompleted(production);
                  const { batchCode: rowBatchCode, workName: rowWorkName } = parseBatchWorkName(production.workName);
                  const rowIntakes = getEffectiveIntakes(production);
                  const outcomeEntries = getEffectiveOutcomeEntries(production);
                  const totalIn = rowIntakes.reduce((s: number, i: any) => s + Number(i.intakeQuantity || 0), 0);
                  const totalOut = outcomeEntries.reduce((s: number, o: any) => s + Number(o.outcomeQuantity || 0), 0);

                  return (
                    <div key={production.id} className="bg-white rounded-xl p-3 border border-gray-200 shadow-xs space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-black text-[11px]">{rowBatchCode}</span>
                            {rowBatchCode !== '-' && <span className="text-gray-400">·</span>}
                            <p className="font-extrabold text-black text-sm leading-snug">{rowWorkName}</p>
                          </div>
                          <p className="text-[11px] text-gray-500 mt-0.5">{formatDateTime(production.date)}</p>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                            completed
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {completed ? 'Completed' : 'Pending'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-2 bg-gray-50 p-2 rounded-lg border border-gray-100 text-xs">
                        <div>
                          <span className="text-[10px] font-bold text-gray-400 uppercase block">Intake Materials</span>
                          <p className="font-bold text-gray-800 truncate">
                            {rowIntakes.map((i: any) => formatRawMaterialLabel(i.rawMaterial, i.materialBatchCode, i.materialCode)).join(', ')}
                          </p>
                          <p className="text-blue-600 font-extrabold mt-0.5">Qty: {totalIn}</p>
                        </div>
                        <div className="border-t border-gray-200 pt-1.5">
                          <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">
                            Outcome Entries ({outcomeEntries.length}) — Total Qty: {totalOut}
                          </span>
                          <div className="space-y-1.5">
                            {outcomeEntries.map((entry: any) => {
                              const isEntryDone = entry.isFinished || completed;
                              return (
                                <div key={entry.key} className="flex flex-col gap-1 bg-white p-2 rounded border border-gray-200">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-bold text-gray-900 text-xs truncate">
                                      {entry.finishedProduct?.name || '-'}
                                    </span>
                                    <span
                                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                        isEntryDone
                                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                          : 'bg-amber-100 text-amber-800 border border-amber-300'
                                      }`}
                                    >
                                      {isEntryDone ? 'Completed' : 'Pending'}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between text-[11px] text-gray-500">
                                    <span>{formatDateTime(entry.date || production.date)}</span>
                                    <span className="font-black text-emerald-700">Qty: {entry.outcomeQuantity}</span>
                                  </div>
                                  {!isEntryDone && (
                                    <div className="flex justify-end gap-1.5 pt-1 border-t border-gray-100">
                                      <button
                                        type="button"
                                        onClick={() => handleOpenProductOutcomeUpdate(production, entry)}
                                        className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-300 flex items-center gap-1"
                                      >
                                        <PlusCircle size={11} /> + Update
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setProductToFinish({
                                            productionId: production.id,
                                            batchCode: rowBatchCode,
                                            workName: rowWorkName,
                                            finishedProductId: Number(entry.finishedProductId),
                                            finishedProduct: entry.finishedProduct,
                                            outcomeQuantity: Number(entry.outcomeQuantity || 0),
                                          });
                                        }}
                                        className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-100 text-emerald-800 border border-gray-300 flex items-center gap-1"
                                      >
                                        <Flag size={11} /> Finish
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-1.5 border-t border-gray-100">
                        <button
                          type="button"
                          onClick={() => handleView(production)}
                          className="flex items-center gap-1 text-xs text-gray-700 hover:text-gray-900 font-bold px-2.5 py-1 rounded-lg border border-gray-200 bg-gray-50"
                        >
                          <Eye size={13} /> View
                        </button>
                        {!completed && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleEdit(production)}
                              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-bold px-2.5 py-1 rounded-lg border border-blue-200 bg-blue-50/50"
                            >
                              <Edit size={13} /> Edit Batch
                            </button>
                            <button
                              type="button"
                              onClick={() => setItemToDelete(production)}
                              className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-bold px-2.5 py-1 rounded-lg border border-red-200 bg-red-50/50"
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop & Tablet Table (>= MD) */}
            <div className="hidden md:block flex-1 min-h-0 overflow-auto custom-scrollbar">
              <table className="w-full min-w-max text-left text-[12px] xl:text-[13px] border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[#2A2A2A] text-white font-bold whitespace-nowrap">
                    <th className="px-2.5 py-2.5 border-r border-[#444] text-center w-9">#</th>
                    <th className="px-2.5 py-2.5 border-r border-[#444] text-center">Date & Time</th>
                    <th className="px-2.5 py-2.5 border-r border-[#444]">Batch Code</th>
                    <th className="px-2.5 py-2.5 border-r border-[#444]">Work Name</th>
                    <th className="px-2.5 py-2.5 border-r border-[#444]">Material (Name-Code-Batch)</th>
                    <th className="px-2.5 py-2.5 border-r border-[#444] text-center">Intake Qty</th>
                    <th className="px-2.5 py-2.5 border-r border-[#444]">Product (Outcome)</th>
                    <th className="px-2.5 py-2.5 border-r border-[#444] text-center">Outcome Qty</th>
                    <th className="px-2.5 py-2.5 border-r border-[#444] text-center">Status</th>
                    <th className="px-2.5 py-2.5 text-center w-36">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={10} className="text-center p-4">Loading...</td>
                    </tr>
                  ) : filteredProductions.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center p-4">No production entries found.</td>
                    </tr>
                  ) : (
                    filteredProductions.flatMap((production: any, index: number) => {
                      const completed = isProductionCompleted(production);
                      const { batchCode: rowBatchCode, workName: rowWorkName } = parseBatchWorkName(production.workName);
                      const rowIntakes = getEffectiveIntakes(production);
                      const outcomeEntries = getEffectiveOutcomeEntries(production);
                      const totalIn = rowIntakes.reduce((s: number, i: any) => s + Number(i.intakeQuantity || 0), 0);
                      const materialLabel = rowIntakes
                        .map((i: any) =>
                          `${formatRawMaterialLabel(i.rawMaterial, i.materialBatchCode, i.materialCode)}${rowIntakes.length > 1 ? ` (${i.intakeQuantity})` : ''}`
                        )
                        .join(', ');

                      return outcomeEntries.map((entry: any, entryIdx: number) => {
                        const isPrimaryRow = entryIdx === 0;
                        const entryQty = Number(entry.outcomeQuantity || 0);
                        const isEntryDone = entry.isFinished || completed;

                        return (
                          <tr
                            key={`${production.id}-${entry.key}`}
                            className={`border-b border-[#E5E7EB] ${
                              isPrimaryRow
                                ? index % 2 === 0
                                  ? 'bg-white'
                                  : 'bg-[#F9F9F9]'
                                : 'bg-blue-50/20'
                            } hover:bg-blue-50`}
                          >
                            <td data-label="#" className="px-2.5 py-2.5 border-r border-[#E5E7EB] text-center font-bold text-gray-700 whitespace-nowrap">
                              {isPrimaryRow ? index + 1 : `${index + 1}.${entryIdx + 1}`}
                            </td>
                            <td data-label="Date & Time" className="px-2.5 py-2.5 border-r border-[#E5E7EB] text-center font-medium text-gray-600 whitespace-nowrap">
                              {formatDateTime(entry.date || production.date)}
                            </td>
                            <td data-label="Batch Code" className="px-2.5 py-2.5 border-r border-[#E5E7EB] text-[11px] font-bold text-black whitespace-nowrap">
                              {rowBatchCode}
                            </td>
                            <td data-label="Work Name" className="px-2.5 py-2.5 border-r border-[#E5E7EB] font-semibold text-gray-900 whitespace-nowrap">
                              {rowWorkName}
                            </td>
                            <td data-label="Material" className={`px-2.5 py-2.5 border-r border-[#E5E7EB] whitespace-nowrap ${isPrimaryRow ? 'text-gray-800' : 'text-gray-500'}`}>
                              {materialLabel}
                            </td>
                            <td data-label="Intake Qty" className={`px-2.5 py-2.5 border-r border-[#E5E7EB] text-center font-bold whitespace-nowrap ${isPrimaryRow ? 'text-blue-600' : 'text-gray-400'}`}>
                              {isPrimaryRow ? totalIn : '-'}
                            </td>
                            <td data-label="Product" className="px-2.5 py-2.5 border-r border-[#E5E7EB] font-medium text-gray-800 whitespace-nowrap">
                              {entry.finishedProduct?.name || '-'}
                            </td>
                            <td data-label="Outcome Qty" className={`px-2.5 py-2.5 border-r border-[#E5E7EB] text-center font-bold whitespace-nowrap ${entryQty < 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                              {entryQty}
                            </td>
                            <td data-label="Status" className="px-2.5 py-2.5 border-r border-[#E5E7EB] text-center whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  isEntryDone
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                    : 'bg-amber-100 text-amber-800 border border-amber-300'
                                }`}
                              >
                                {isEntryDone ? 'Completed' : 'Pending'}
                              </span>
                            </td>
                            <td data-label="Actions" className="px-2.5 py-2.5 text-center whitespace-nowrap">
                              <div className="flex justify-center items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleView(production)}
                                  className="text-[#6B7280] border border-[#D1D5DB] rounded p-1 hover:bg-gray-700 hover:text-white transition-colors"
                                  title="View Details"
                                >
                                  <Eye size={12} />
                                </button>
                                {!isEntryDone && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenProductOutcomeUpdate(production, entry)}
                                      className="text-emerald-700 border border-emerald-300 bg-emerald-50 hover:bg-emerald-600 hover:text-white rounded p-1 transition-colors flex items-center gap-0.5"
                                      title="Update Outcome Quantity for this product"
                                    >
                                      <PlusCircle size={12} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setProductToFinish({
                                          productionId: production.id,
                                          batchCode: rowBatchCode,
                                          workName: rowWorkName,
                                          finishedProductId: Number(entry.finishedProductId),
                                          finishedProduct: entry.finishedProduct,
                                          outcomeQuantity: entryQty,
                                        });
                                      }}
                                      className="text-[#16A34A] border border-[#16A34A] rounded p-1 hover:bg-[#16A34A] hover:text-white transition-colors"
                                      title="Finish this Product (Mark Completed)"
                                    >
                                      <Flag size={12} />
                                    </button>
                                  </>
                                )}
                                {isPrimaryRow && !completed && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleEdit(production)}
                                      className="text-[#3B82F6] border border-[#3B82F6] rounded p-1 hover:bg-[#3B82F6] hover:text-white transition-colors"
                                      title="Edit Batch Entry"
                                    >
                                      <Edit size={12} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setItemToDelete(production)}
                                      className="text-[#EF4444] border border-[#EF4444] rounded p-1 hover:bg-[#EF4444] hover:text-white transition-colors"
                                      title="Delete Pending Entry"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      });
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Floating Action Button */}
          <button
            type="button"
            onClick={handleAddNew}
            className="xl:hidden fixed bottom-6 right-6 z-30 bg-[#16A34A] hover:bg-[#15803D] text-white p-3.5 rounded-full shadow-2xl active:scale-95 transition-transform flex items-center justify-center"
            title="Create new production entry"
          >
            <PlusCircle size={24} />
          </button>

          <DeleteConfirmationModal
            isOpen={!!itemToDelete}
            itemName={itemToDelete?.workName}
            isDeleting={deleteMutation.isPending}
            onConfirm={() => {
              if (itemToDelete) {
                deleteMutation.mutate(itemToDelete.id);
              }
            }}
            onCancel={() => setItemToDelete(null)}
          />

          <ProductionViewModal
            isOpen={!!viewingProduction}
            onClose={() => setViewingProduction(null)}
            production={viewingProduction}
          />
          <ProductionViewModal
            isOpen={!!productionToFinish}
            onClose={() => {
              setProductionToFinish(null);
              setConfirmFinishFromForm(false);
            }}
            production={productionToFinish}
            confirmFinish={true}
            isFinishing={confirmFinishFromForm ? saveMutation.isPending : quickFinishMutation.isPending}
            onConfirmFinish={() => {
              if (!productionToFinish) return;
              if (confirmFinishFromForm) {
                validateAndSubmit(true);
              } else {
                quickFinishMutation.mutate(productionToFinish.id);
              }
            }}
          />
          <LeaveConfirmModal
            isOpen={showLeaveModal}
            onConfirm={() => navigate('/dashboard')}
            onClose={() => setShowLeaveModal(false)}
          />

          {/* Modal: Update Outcome Quantity for a Single Product */}
          {updatingProductOutcome && (
            <div className="fixed top-[60px] inset-x-0 bottom-0 z-20 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-emerald-200 animate-in fade-in zoom-in duration-150">
                <div className="bg-[#047857] text-white px-5 py-3.5 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Layers size={18} />
                    <div>
                      <h3 className="font-bold text-sm tracking-wide">UPDATE PRODUCT OUTCOME</h3>
                      <p className="text-[11px] text-emerald-100">
                        Batch: {updatingProductOutcome.batchCode} · {updatingProductOutcome.workName}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setUpdatingProductOutcome(null)}
                    className="text-white hover:bg-white/20 p-1.5 rounded-full transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="p-5 space-y-4">
                  <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-3">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-emerald-800 block">Product</span>
                        <h4 className="text-sm font-black text-emerald-950">
                          {updatingProductOutcome.finishedProduct?.name}
                        </h4>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          updatingProductOutcome.isFinished
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}
                      >
                        {updatingProductOutcome.isFinished ? 'Completed' : 'Pending'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-emerald-200/60 text-xs">
                      <div>
                        <span className="text-[10px] text-gray-500 font-bold block">Produced so far:</span>
                        <span className="font-black text-gray-800">
                          {updatingProductOutcome.previousQuantity} units
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 font-bold block">Unit Area:</span>
                        <span className="font-bold text-gray-700">
                          {Number(updatingProductOutcome.finishedProduct?.sqM || 0).toFixed(3)} m²
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center gap-1 text-[11px] font-bold text-gray-700 mb-1">
                      <Calendar size={13} className="text-emerald-700" /> Date & Time of this Update Run *
                    </label>
                    <input
                      type="datetime-local"
                      value={outcomeUpdateDateTime}
                      onChange={(e) => setOutcomeUpdateDateTime(e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs font-bold text-gray-800 outline-none focus:border-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="flex items-center justify-between text-[11px] font-bold text-emerald-900 mb-1">
                      <span>Add Outcome Quantity (+) *</span>
                      <span className="text-[10px] font-extrabold text-emerald-700">
                        New Total: {updatingProductOutcome.previousQuantity + (parseInt(outcomeUpdateQty || '0', 10) || 0)} units
                      </span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      autoFocus
                      value={outcomeUpdateQty}
                      onChange={(e) => setOutcomeUpdateQty(e.target.value)}
                      placeholder="Enter quantity produced..."
                      onFocus={(e) => e.target.select()}
                      className="w-full px-3 py-2 border-2 border-emerald-500 rounded-lg text-lg font-black text-emerald-900 text-right outline-none focus:ring-4 focus:ring-emerald-500/20"
                    />
                  </div>

                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={outcomeUpdateFinish}
                        onChange={(e) => setOutcomeUpdateFinish(e.target.checked)}
                        className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                      />
                      <div className="text-xs">
                        <span className="font-bold text-gray-900 block">Mark this product as Finished (Completed)</span>
                        <span className="text-[11px] text-gray-500 leading-tight block">
                          Locks this product from further updates. The overall batch will finish when all products are completed.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="bg-gray-50 px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setUpdatingProductOutcome(null)}
                    className="px-3 py-1.5 rounded text-xs font-bold text-gray-600 hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={productOutcomeMutation.isPending}
                    onClick={handleSaveProductOutcomeUpdate}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {productOutcomeMutation.isPending ? 'Saving...' : 'Save Product Update'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal: Confirm Finish for a Single Product */}
          {productToFinish && (
            <div className="fixed top-[60px] inset-x-0 bottom-0 z-20 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border border-emerald-200 animate-in fade-in zoom-in duration-150">
                <div className="bg-emerald-600 text-white px-5 py-3.5 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Flag size={18} />
                    <h3 className="font-bold text-sm tracking-wide">FINISH PRODUCT PRODUCTION</h3>
                  </div>
                  <button
                    onClick={() => setProductToFinish(null)}
                    className="text-white hover:bg-white/20 p-1 rounded-full transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="p-5 space-y-3">
                  <p className="text-xs text-gray-700">
                    Mark <strong>{productToFinish.finishedProduct?.name}</strong> as completed for batch <strong>{productToFinish.batchCode}</strong>?
                  </p>
                  <div className="bg-emerald-50 p-3 rounded border border-emerald-200 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Outcome:</span>
                      <span className="font-black text-emerald-800">{productToFinish.outcomeQuantity} units</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Batch:</span>
                      <span className="font-bold text-gray-800">{productToFinish.workName}</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-500">
                    This product will be locked as Completed. Other unfinished products in this batch will remain pending.
                  </p>
                </div>
                <div className="bg-gray-50 px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setProductToFinish(null)}
                    className="px-3 py-1.5 rounded text-xs font-bold text-gray-600 hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={finishSingleProductMutation.isPending}
                    onClick={() => {
                      finishSingleProductMutation.mutate({
                        productionId: productToFinish.productionId,
                        finishedProductId: productToFinish.finishedProductId,
                      });
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    {finishSingleProductMutation.isPending ? 'Finishing...' : 'Confirm Finish'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Production;
