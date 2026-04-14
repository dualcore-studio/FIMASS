import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { api } from '../utils/api';

type UnreadCtx = {
  unreadTotal: number;
  refreshUnread: () => Promise<void>;
};

const UnreadMessagesContext = createContext<UnreadCtx | null>(null);

export function UnreadMessagesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [unreadTotal, setUnreadTotal] = useState(0);

  const refreshUnread = useCallback(async () => {
    if (!user) {
      setUnreadTotal(0);
      return;
    }
    try {
      const res = await api.get<{ total: number }>('/conversations/unread-total');
      setUnreadTotal(Math.max(0, Number(res.total) || 0));
    } catch {
      /* mantieni il valore precedente */
    }
  }, [user]);

  useEffect(() => {
    void refreshUnread();
  }, [refreshUnread]);

  useEffect(() => {
    if (!user) return undefined;
    const t = window.setInterval(() => void refreshUnread(), 45000);
    const onFocus = () => void refreshUnread();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(t);
      window.removeEventListener('focus', onFocus);
    };
  }, [user, refreshUnread]);

  return (
    <UnreadMessagesContext.Provider value={{ unreadTotal, refreshUnread }}>
      {children}
    </UnreadMessagesContext.Provider>
  );
}

export function useUnreadMessages() {
  const ctx = useContext(UnreadMessagesContext);
  if (!ctx) {
    throw new Error('useUnreadMessages must be used within UnreadMessagesProvider');
  }
  return ctx;
}
