import { MsalProvider, useMsal, useIsAuthenticated } from '@azure/msal-react';
import { type ReactNode, createContext, useContext } from 'react';
import { msalInstance } from './msalConfig';
import { IS_LOCAL } from '../config/env';

interface AuthContextValue {
  isAuthenticated: boolean;
  userId: string | null;
  email: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  isAuthenticated: false,
  userId: null,
  email: null,
  login: async () => {},
  logout: async () => {},
});

function AuthContextProvider({ children }: { children: ReactNode }) {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();

  // In local stage bypass, treat as always authenticated
  const effectivelyAuthenticated = IS_LOCAL || isAuthenticated;

  const account = accounts[0];
  const userId = IS_LOCAL
    ? 'test-user-local'
    : (account?.localAccountId ?? null);

  const email = IS_LOCAL
    ? 'dev@local'
    : ((account?.idTokenClaims?.['emails'] as string[] | undefined)?.[0] ??
       account?.username ??
       null);

  const login = async () => {
    if (IS_LOCAL) return;
    await instance.loginRedirect({
      scopes: ['openid', 'profile', 'email'],
    });
  };

  const logout = async () => {
    if (IS_LOCAL) return;
    await instance.logoutRedirect();
  };

  return (
    <AuthContext.Provider
      value={{ isAuthenticated: effectivelyAuthenticated, userId, email, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <MsalProvider instance={msalInstance}>
      <AuthContextProvider>{children}</AuthContextProvider>
    </MsalProvider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
