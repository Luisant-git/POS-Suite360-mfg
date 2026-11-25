/** Computes the next sequential BCH-XXXX batch code from existing productions. */
export const generateNextBatchCode = (productions: any[]): string => {
  if (!productions || productions.length === 0) return 'BCH-0001';
  let maxNum = 0;
  productions.forEach((p) => {
    if (p.workName) {
      const match = String(p.workName).match(/BCH-(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
  });
  return `BCH-${String(maxNum + 1).padStart(4, '0')}`;
};

/** Splits a stored "BCH-XXXX - Work Name" string into separate batchCode and workName values. */
export const parseBatchWorkName = (rawWorkName?: string | null): { batchCode: string; workName: string } => {
  const text = String(rawWorkName || '').trim();
  if (!text) return { batchCode: '-', workName: '-' };

  const withSeparator = text.match(/^(BCH-\d+)\s*-\s*(.*)$/i);
  if (withSeparator) {
    return {
      batchCode: withSeparator[1].toUpperCase(),
      workName: withSeparator[2].trim() || '-',
    };
  }

  const codeOnly = text.match(/^(BCH-\d+)$/i);
  if (codeOnly) {
    return {
      batchCode: codeOnly[1].toUpperCase(),
      workName: '-',
    };
  }

  return { batchCode: '-', workName: text };
};

/** Formats a raw material as "MaterialName-MaterialCode-MaterialBatchCode" (e.g. CHROMO-MLJ1019-L2609250315/4/6). */
export const formatRawMaterialLabel = (
  material: any,
  overrideBatchCode?: string | null,
  overrideMaterialCode?: string | null
): string => {
  if (!material) return '-';

  // 1. Determine effective batch code:
  // If explicitly passed (even as empty string/null), strictly respect it and do NOT inject unrelated purchase items
  let effectiveBatch = '';
  if (overrideBatchCode !== undefined && overrideBatchCode !== null) {
    effectiveBatch = String(overrideBatchCode).trim();
  } else {
    effectiveBatch = String(material.batchCode || '').trim();
  }

  // 2. Determine effective material code:
  let effectiveCode = '';
  if (overrideMaterialCode !== undefined && overrideMaterialCode !== null) {
    effectiveCode = String(overrideMaterialCode).trim();
  } else {
    effectiveCode = String(material.code || '').trim();
  }

  const parts = [material.name, effectiveCode, effectiveBatch]
    .map((p) => String(p || '').trim())
    .filter(Boolean);
  return parts.join('-') || '-';
};

/** Helper to normalize material codes for comparison (ignoring whitespace, hyphens, underscores, and letter case). */
export const normalizeCode = (s?: string | null): string => {
  return String(s || '').replace(/[\s\-_]+/g, '').toLowerCase().trim();
};

/** Extracts all distinct material codes for a raw material (from purchase items and master material). */
export const getRawMaterialDistinctMaterialCodes = (material: any): string[] => {
  if (!material) return [];
  const set = new Set<string>();
  const masterCode = String(material.code || '').trim();
  if (masterCode) set.add(masterCode);

  if (Array.isArray(material.rawMaterialPurchaseItems)) {
    for (const pi of material.rawMaterialPurchaseItems) {
      const code = String(pi?.materialCode || '').trim();
      if (code) set.add(code);
    }
  }

  return Array.from(set);
};

/** Extracts distinct batch options (batch code only, deduplicated) for a material. */
export const getRawMaterialDistinctBatches = (
  material: any,
  filterMaterialCode?: string | null
): { batchCode: string; materialCode: string; sqM: number }[] => {
  if (!material) return [];
  const map = new Map<string, { batchCode: string; materialCode: string; sqM: number }>();
  const normFilter = normalizeCode(filterMaterialCode);

  if (Array.isArray(material.rawMaterialPurchaseItems)) {
    for (const pi of material.rawMaterialPurchaseItems) {
      const batchCode = String(pi?.batchCode || '').trim();
      const materialCode = String(pi?.materialCode || '').trim();
      const sqM = Number(pi?.sqM || 0);
      if (!batchCode) continue;

      if (normFilter) {
        const normItemCode = normalizeCode(materialCode);
        if (normItemCode && normItemCode !== normFilter) {
          continue;
        }
      }

      if (!map.has(batchCode)) {
        map.set(batchCode, { batchCode, materialCode, sqM });
      }
    }
  }

  const masterBatch = String(material.batchCode || '').trim();
  const masterCode = String(material.code || '').trim();
  if (masterBatch && !map.has(masterBatch)) {
    if (!normFilter || !masterCode || normalizeCode(masterCode) === normFilter) {
      const defaultSqM = Number(material.rawMaterialPurchaseItems?.[0]?.sqM || 0);
      map.set(masterBatch, { batchCode: masterBatch, materialCode: masterCode, sqM: defaultSqM });
    }
  }

  return Array.from(map.values());
};

/** Extracts distinct material code + batch options (with latest sqM per roll) from purchases. */
export const getRawMaterialBatchOptions = (
  material: any
): { batchCode: string; materialCode: string; sqM: number }[] => {
  if (!material) return [];
  const map = new Map<string, { batchCode: string; materialCode: string; sqM: number }>();

  if (Array.isArray(material.rawMaterialPurchaseItems)) {
    for (const pi of material.rawMaterialPurchaseItems) {
      const batchCode = String(pi?.batchCode || '').trim();
      const materialCode = String(pi?.materialCode || '').trim();
      const sqM = Number(pi?.sqM || 0);
      const key = `${materialCode}::${batchCode}`;
      if ((batchCode || materialCode) && !map.has(key)) {
        map.set(key, { batchCode, materialCode, sqM });
      }
    }
  }

  const masterBatch = String(material.batchCode || '').trim();
  const masterCode = String(material.code || '').trim();
  if (masterBatch && !Array.from(map.values()).some((v) => v.batchCode === masterBatch)) {
    const defaultSqM = Number(material.rawMaterialPurchaseItems?.[0]?.sqM || 0);
    map.set(`${masterCode}::${masterBatch}`, { batchCode: masterBatch, materialCode: masterCode, sqM: defaultSqM });
  }

  return Array.from(map.values());
};

export const isProductionCompleted = (production: any): boolean => {
  if (!production) return false;
  if (production.status) {
    return production.status === 'COMPLETED';
  }
  return Number(production.outcomeQuantity || 0) > 0;
};

export const getEffectiveIntakes = (production: any): any[] => {
  if (!production) return [];
  if (Array.isArray(production.intakes) && production.intakes.length > 0) {
    return production.intakes;
  }
  if (production.rawMaterialId) {
    return [
      {
        rawMaterialId: production.rawMaterialId,
        rawMaterial: production.rawMaterial,
        materialCode: production.materialCode || production.rawMaterial?.rawMaterialPurchaseItems?.[0]?.materialCode || '',
        materialBatchCode: production.materialBatchCode || production.rawMaterial?.batchCode || '',
        intakeQuantity: Number(production.intakeQuantity || 0),
        sqM: 0,
      },
    ];
  }
  return [];
};

export const getEffectiveOutcomes = (production: any): any[] => {
  if (!production) return [];
  if (Array.isArray(production.outcomes) && production.outcomes.length > 0) {
    return production.outcomes;
  }
  if (production.finishedProductId) {
    return [
      {
        finishedProductId: production.finishedProductId,
        finishedProduct: production.finishedProduct,
        outcomeQuantity: Number(production.outcomeQuantity || 0),
        sqM: 0,
      },
    ];
  }
  return [];
};

export const formatDateTime = (val?: string | Date | null): string => {
  if (!val) return '-';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

/**
 * Returns individual display rows for each production's outcomes and logged updates
 * so multi-product outcomes and multi-day updates appear on separate rows.
 */
export const getEffectiveOutcomeEntries = (production: any): any[] => {
  if (!production) return [];
  const outcomes = getEffectiveOutcomes(production);
  const logs = Array.isArray(production.outcomeLogs) ? production.outcomeLogs : [];
  const outcomeByPid = new Map<number, any>();
  outcomes.forEach((o: any) => {
    outcomeByPid.set(Number(o.finishedProductId), o);
  });

  if (logs.length > 0) {
    const loggedProductIds = new Set(logs.map((l: any) => Number(l.finishedProductId)));
    const entries = logs.map((l: any) => {
      const pid = Number(l.finishedProductId);
      const parentOutcome = outcomeByPid.get(pid);
      const status = parentOutcome?.status || production.status || 'PENDING';
      return {
        key: `log-${l.id}`,
        finishedProductId: pid,
        finishedProduct: l.finishedProduct,
        outcomeQuantity: Number(l.outcomeQuantity || 0),
        sqM: Number(l.sqM || 0),
        date: l.date || l.createdAt || production.date,
        isUpdateLog: true,
        status,
        isFinished: status === 'COMPLETED',
        completedAt: parentOutcome?.completedAt || null,
      };
    });

    outcomes.forEach((o: any, idx: number) => {
      const pid = Number(o.finishedProductId);
      if (!loggedProductIds.has(pid)) {
        const status = o.status || production.status || 'PENDING';
        entries.push({
          key: `out-pending-${o.id || idx}`,
          finishedProductId: pid,
          finishedProduct: o.finishedProduct,
          outcomeQuantity: Number(o.outcomeQuantity || 0),
          sqM: Number(o.sqM || 0),
          date: production.date,
          isUpdateLog: false,
          status,
          isFinished: status === 'COMPLETED',
          completedAt: o.completedAt || null,
        });
      }
    });

    return entries;
  }

  return outcomes.map((o: any, idx: number) => {
    const status = o.status || production.status || 'PENDING';
    return {
      key: `out-${o.id || idx}`,
      finishedProductId: Number(o.finishedProductId),
      finishedProduct: o.finishedProduct,
      outcomeQuantity: Number(o.outcomeQuantity || 0),
      sqM: Number(o.sqM || 0),
      date: production.date,
      isUpdateLog: false,
      status,
      isFinished: status === 'COMPLETED',
      completedAt: o.completedAt || null,
    };
  });
};
