type BillOccurrenceRecord = {
  recurring?: boolean | null;
  frequency?: string | null;
  due_date: string;
  paid_occurrence_date?: string | null;
  paid_at?: string | null;
  status: string;
};

function periodStart(date: string, frequency: string | null | undefined) {
  const [year, month] = date.slice(0, 10).split('-').map(Number);

  if (frequency === 'yearly') {
    return `${year}-01-01`;
  }

  if (frequency === 'quarterly') {
    const quarterMonth = Math.floor((month - 1) / 3) * 3 + 1;
    return `${year}-${String(quarterMonth).padStart(2, '0')}-01`;
  }

  return `${year}-${String(month).padStart(2, '0')}-01`;
}

function paidOccurrenceIsActive(record: BillOccurrenceRecord, today: string) {
  if (
    !record.recurring ||
    !record.paid_occurrence_date ||
    !record.paid_at ||
    record.status === 'paid'
  ) {
    return false;
  }

  if (record.frequency === 'weekly') {
    return record.paid_occurrence_date <= today && today < record.due_date;
  }

  return (
    periodStart(record.paid_occurrence_date, record.frequency) ===
    periodStart(today, record.frequency)
  );
}

/**
 * Selects the occurrence that the primary bill list should represent.
 * The persisted due_date remains the next scheduled occurrence after payment;
 * this read model keeps the paid occurrence visible for the active period.
 */
export function selectCurrentBillOccurrence<T extends BillOccurrenceRecord>(
  record: T,
  today: string,
): T & { next_due_date?: string } {
  if (!paidOccurrenceIsActive(record, today)) {
    return record;
  }

  return {
    ...record,
    due_date: record.paid_occurrence_date as string,
    status: 'paid',
    next_due_date: record.due_date,
  };
}

export function selectCurrentBillOccurrences<T extends BillOccurrenceRecord>(records: T[], today: string) {
  return records.map((record) => selectCurrentBillOccurrence(record, today));
}
