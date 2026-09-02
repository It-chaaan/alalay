import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { authenticatedApiRequest } from '@/services/api';
import { subscribeFinancialMutations } from '@/services/finance';
import {
  createInsightRequestGate,
  normalizeDashboardInsight,
  type InsightLoadState,
} from '@/utils/dashboard-insight';

type DashboardInsightResponse = {
  ai_insight?: {
    message?: string | null;
  };
};

type DashboardInsightContextValue = {
  insight: string | null;
  state: InsightLoadState;
  refresh: () => Promise<void>;
};

const DashboardInsightContext = createContext<DashboardInsightContextValue | null>(null);

export function DashboardInsightProvider({
  children,
  enabled = true,
}: {
  children: ReactNode;
  enabled?: boolean;
}) {
  const [insight, setInsight] = useState<string | null>(null);
  const [state, setState] = useState<InsightLoadState>('loading');
  const mounted = useRef(true);
  const insightRef = useRef<string | null>(null);
  const requestGate = useRef(createInsightRequestGate()).current;

  const refresh = useCallback(() => {
    return requestGate(() => {
      setState((current) => (insightRef.current ? current : 'loading'));
      return authenticatedApiRequest<DashboardInsightResponse>('/api/dashboard/summary')
        .then((summary) => {
          const message = normalizeDashboardInsight(summary.ai_insight?.message);
          if (!mounted.current) return;
          setInsight(message);
          insightRef.current = message;
          setState(message ? 'ready' : 'empty');
        })
        .catch(() => {
          if (mounted.current) setState('error');
        });
    });
  }, [requestGate]);

  useEffect(() => {
    mounted.current = true;
    if (!enabled) {
      setInsight(null);
      insightRef.current = null;
      setState('empty');
      return;
    }
    void refresh();
    return () => {
      mounted.current = false;
    };
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled) return;
    return subscribeFinancialMutations(() => {
      void refresh();
    });
  }, [enabled, refresh]);

  const value = useMemo(() => ({ insight, state, refresh }), [insight, refresh, state]);
  return (
    <DashboardInsightContext.Provider value={value}>{children}</DashboardInsightContext.Provider>
  );
}

export function useDashboardInsight() {
  const context = useContext(DashboardInsightContext);
  if (!context) throw new Error('useDashboardInsight must be used inside DashboardInsightProvider');
  return context;
}
