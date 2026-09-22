import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type IncomeWorkflowDraft = {
  source: string;
  amount: string;
  typeLabel: string;
  customType: string;
  date: string;
  frequency: 'weekly' | 'monthly' | 'biweekly' | 'yearly';
  recurring: boolean;
  walletId: string | null;
};

type IncomeWorkflow = {
  draft: IncomeWorkflowDraft | null;
  saveDraft: (draft: IncomeWorkflowDraft) => void;
  takeDraft: () => IncomeWorkflowDraft | null;
  completeWallet: (walletId: string) => void;
  takeCreatedWallet: () => string | null;
  clear: () => void;
};
const WorkflowContext = createContext<IncomeWorkflow | null>(null);

export function IncomeWorkflowProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<IncomeWorkflowDraft | null>(null);
  const [createdWalletId, setCreatedWalletId] = useState<string | null>(null);
  const value = useMemo<IncomeWorkflow>(
    () => ({
      draft,
      saveDraft: setDraft,
      takeDraft: () => {
        const value = draft;
        setDraft(null);
        return value;
      },
      completeWallet: setCreatedWalletId,
      takeCreatedWallet: () => {
        const value = createdWalletId;
        setCreatedWalletId(null);
        return value;
      },
      clear: () => {
        setDraft(null);
        setCreatedWalletId(null);
      },
    }),
    [createdWalletId, draft],
  );
  return <WorkflowContext.Provider value={value}>{children}</WorkflowContext.Provider>;
}
export function useIncomeWorkflow() {
  const value = useContext(WorkflowContext);
  if (!value) throw new Error('Income workflow provider is missing.');
  return value;
}
