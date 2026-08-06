import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { countUnreadSuggestions } from '../lib/decksApi';

const NotificationsContext = createContext(null);

const POLL_MS = 2 * 60 * 1000;

// Conteggio dei suggerimenti ricevuti e non ancora letti, condiviso tra navbar e pagine.
export function NotificationsProvider({ children }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnread = useCallback(() => {
    if (!user) {
      setUnreadCount(0);
      return Promise.resolve(0);
    }
    return countUnreadSuggestions(user.id)
      .then((n) => {
        setUnreadCount(n);
        return n;
      })
      .catch(() => 0);
  }, [user]);

  useEffect(() => {
    refreshUnread();
    if (!user) return;
    const timer = setInterval(refreshUnread, POLL_MS);
    return () => clearInterval(timer);
  }, [user, refreshUnread]);

  return (
    <NotificationsContext.Provider value={{ unreadCount, refreshUnread }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications deve essere usato dentro NotificationsProvider');
  return ctx;
}
