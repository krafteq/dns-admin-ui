import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { trpc } from './trpc';

interface AuthUser {
  id: number;
  username: string;
  role: string;
  createdAt: number;
  isOidc: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAdmin: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const loggedOut = useRef(false);

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
  });

  useEffect(() => {
    if (meQuery.data && !loggedOut.current) {
      setUser(meQuery.data);
    } else if (meQuery.isError) {
      setUser(null);
    }
  }, [meQuery.data, meQuery.isError]);

  // Use query data directly to avoid race between isLoading and useEffect
  // But not if user explicitly logged out
  const resolvedUser = loggedOut.current ? null : (user ?? meQuery.data ?? null);

  const loginMutation = trpc.auth.login.useMutation();
  const logoutMutation = trpc.auth.logout.useMutation();
  const utils = trpc.useUtils();

  const login = useCallback(
    async (username: string, password: string) => {
      const result = await loginMutation.mutateAsync({ username, password });
      loggedOut.current = false;
      setUser(result);
      await utils.auth.me.invalidate();
    },
    [loginMutation, utils]
  );

  const logout = useCallback(async () => {
    if (resolvedUser?.isOidc) {
      // Redirect to backend OIDC logout which clears cookie and redirects to IdP
      loggedOut.current = true;
      setUser(null);
      utils.auth.me.reset();
      window.location.href = '/auth/oidc/logout';
      return;
    }
    await logoutMutation.mutateAsync();
    loggedOut.current = true;
    setUser(null);
    utils.auth.me.reset();
  }, [logoutMutation, utils, resolvedUser]);

  const isAdmin = resolvedUser?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{ user: resolvedUser, isLoading: meQuery.isLoading, isAdmin, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
