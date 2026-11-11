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

