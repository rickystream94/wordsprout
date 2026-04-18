import { GoogleOAuthProvider } from '@react-oauth/google';
import { MsalProvider, useMsal, useIsAuthenticated } from '@azure/msal-react';
import { type ReactNode, createContext, useContext, useState } from 'react';
import { msalInstance } from './msalConfig';
import {
  setGoogleCredential,
  getGoogleCredential,
  isGoogleAuthenticated,
  getGoogleEmail,
  getGoogleSub,
} from './googleAuth';
import { GOOGLE_CLIENT_ID } from '../config/env';

// GIS attaches to window.google at runtime — declare minimally to avoid ts-ignore
declare global {
  interface Window {
    google?: { accounts?: { id?: { disableAutoSelect: () => void } } };
  }
}

type AuthProvider = 'microsoft' | 'google' | null;

interface AuthContextValue {
  isAuthenticated: boolean;
  provider: AuthProvider;
  userId: string | null;
  email: string | null;
  sub: string | null;
  login: () => Promise<void>;
  loginWithMicrosoft: () => Promise<void>;
  loginWithGoogle: (credential: string) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  isAuthenticated: false,
  provider: null,
  userId: null,
  email: null,
  sub: null,
  login: async () => {},
  loginWithMicrosoft: async () => {},
  loginWithGoogle: () => {},
  logout: async () => {},
});

function AuthContextProvider({ children }: { children: ReactNode }) {
  const { instance, accounts } = useMsal();
  const msIsAuthenticated = useIsAuthenticated();

  // Google credential state — initialised from module store so it survives
  // StrictMode double-renders without losing the token.
  const [googleCredential, setGoogleCredentialState] = useState<string | null>(
    () => (isGoogleAuthenticated() ? getGoogleCredential() : null),
  );

  const googleActive = googleCredential !== null && isGoogleAuthenticated();
  const msActive = msIsAuthenticated && accounts.length > 0;

  const effectivelyAuthenticated = googleActive || msActive;

  const provider: AuthProvider = googleActive
    ? 'google'
    : msActive
      ? 'microsoft'
      : null;

  const msAccount = accounts[0];

  const userId = googleActive && googleCredential
    ? getGoogleSub(googleCredential)
    : (msAccount?.localAccountId ?? null);

  const email = googleActive && googleCredential
    ? getGoogleEmail(googleCredential)
    : (msAccount?.idTokenClaims?.['email'] as string | undefined ??
       msAccount?.username ??
       null);

  const sub = googleActive && googleCredential
    ? getGoogleSub(googleCredential)
    : ((msAccount?.idTokenClaims?.['sub'] as string | undefined) ?? null);

  const loginWithMicrosoft = async () => {
    await instance.loginRedirect({ scopes: ['openid', 'profile', 'email'] });
  };

  const loginWithGoogle = (credential: string) => {
    setGoogleCredential(credential);
    setGoogleCredentialState(credential);
  };

  // Backward-compatible alias
  const login = loginWithMicrosoft;

  const logout = async () => {
    if (googleActive) {
      setGoogleCredential(null);
      setGoogleCredentialState(null);
      // Disable One Tap auto-select so the account picker shows next time
      window.google?.accounts?.id?.disableAutoSelect();
    } else {
      try {
        await instance.logoutRedirect({ postLogoutRedirectUri: window.location.origin });
      } catch {
        // logoutRedirect can fail intermittently (e.g. if the account entry was
        // already cleared). Fall back to a hard redirect so the user is never stranded.
        window.location.replace('/login');
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: effectivelyAuthenticated,
        provider,
        userId,
        email,
        sub,
        login,
        loginWithMicrosoft,
        loginWithGoogle,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <MsalProvider instance={msalInstance}>
        <AuthContextProvider>{children}</AuthContextProvider>
      </MsalProvider>
    </GoogleOAuthProvider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
