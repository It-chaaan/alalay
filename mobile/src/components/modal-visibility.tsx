import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type ModalVisibilityContextValue = { modalCount: number; setModalVisible: (visible: boolean) => void };
const ModalVisibilityContext = createContext<ModalVisibilityContextValue | null>(null);

export function ModalVisibilityProvider({ children }: { children: ReactNode }) {
  const [modalCount, setModalCount] = useState(0);
  const setModalVisible = useCallback((visible: boolean) => setModalCount((count) => Math.max(0, count + (visible ? 1 : -1))), []);
  const value = useMemo(() => ({ modalCount, setModalVisible }), [modalCount, setModalVisible]);
  return <ModalVisibilityContext.Provider value={value}>{children}</ModalVisibilityContext.Provider>;
}

export function useModalVisibility() {
  const context = useContext(ModalVisibilityContext);
  if (!context) throw new Error('useModalVisibility must be used inside ModalVisibilityProvider');
  return context;
}
