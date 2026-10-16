export const getMalaysiaDateStr = (date: Date | string | number = new Date()): string => {
  return new Date(date).toLocaleDateString('sv-SE', { timeZone: 'Asia/Kuala_Lumpur' });
};

export const formatMalaysiaDateTime = (date: Date | string | number = new Date()): string => {
  const d = new Date(date);
  return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kuala_Lumpur' })} ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kuala_Lumpur' })}`;
};

export const formatMalaysiaDate = (date: Date | string | number = new Date()): string => {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(date));
};
