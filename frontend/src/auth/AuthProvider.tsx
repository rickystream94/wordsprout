import { GoogleOAuthProvider } from '@react-oauth/google';
import { MsalProvider, useMsal, useIsAuthenticated } from '@azure/msal-react';
import type { AccountInfo } from '@azure/msal-browser';
import { type ReactNode, createContext, useEffect, useState } from 'react';
import { msalInstance } from './msalConfig';
import {
  setGoogleCredential,
  getGoogleCredential,
  isGoogleAuthenticated,
  getGoogleEmail,
  getGooglePicture,
  getGoogleSub,
} from './googleAuth';
import { fetchMsProfilePhoto, clearMsPhotoCache } from './msGraphAuth';
import { clearSession, getSessionClaims, getStoredRefreshToken, hasValidSession, storeSession } from './sessionTokens';
import { exchangeOidcForSession, getAccessToken } from '../services/api';
import { API_BASE, GOOGLE_CLIENT_ID } from '../config/env';

// GIS attaches to window.google at runtime — declare minimally to avoid ts-ignore
declare global {
  interface Window {
    google?: { accounts?: { id?: { disableAutoSelect: () => void } } };
  }
}

type AuthProvider = 'microsoft' | 'google' | null;

interface AuthContextValue {
  isAuthenticated: boolean;
  /** True while a session-restore (refresh) is in progress on app startup. */
  sessionRestoring: boolean;
  provider: AuthProvider;
  userId: string | null;
  email: string | null;
  sub: string | null;
  /** Profile picture URL from the OAuth provider, or null if unavailable. */
  picture: string | null;
  login: () => Promise<void>;
  loginWithMicrosoft: () => Promise<void>;
  loginWithGoogle: (credential: string) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  isAuthenticated: false,
  sessionRestoring: false,
  provider: null,
  userId: null,
  email: null,
  sub: null,
  picture: null,
  login: async () => {},
  loginWithMicrosoft: async () => {},
  loginWithGoogle: () => {},
  logout: async () => {},
});

export { AuthContext };

function AuthContextProvider({ children }: { children: ReactNode }) {
  const { instance, accounts } = useMsal();
  const msIsAuthenticated = useIsAuthenticated();

  // Google credential state — initialised from module store so it survives
  // StrictMode double-renders without losing the token.
  const [googleCredential, setGoogleCredentialState] = useState<string | null>(
    () => (isGoogleAuthenticated() ? getGoogleCredential() : null),
  );

  // Backend session state — true when we have a valid access token
  const [sessionActive, setSessionActive] = useState(() => hasValidSession());

  // Microsoft profile photo — fetched from Graph API after MS login
  const [msPicture, setMsPicture] = useState<string | null>(null);

  // True while we're attempting to restore a session from a stored refresh token
  const [sessionRestoring, setSessionRestoring] = useState(
    () => !hasValidSession() && getStoredRefreshToken() !== null,
  );

  const googleActive = googleCredential !== null && isGoogleAuthenticated();
  const msActive = msIsAuthenticated && accounts.length > 0;

  // User is authenticated if they have a backend session, are restoring one,
  // or have an active OIDC session (backward compat for the login→exchange window).
  const effectivelyAuthenticated = sessionActive || sessionRestoring || googleActive || msActive;

  // Derive identity from the stored session token claims (even if the access token
  // is expired — the claims are still valid metadata). This ensures correct
  // provider/email during session restore, before the refresh completes.
  // Falls back to OIDC sources only during the initial login window before
  // the first session exchange completes.
  const sessionClaims = getSessionClaims();

  const provider: AuthProvider = sessionClaims
    ? (sessionClaims.provider as AuthProvider)
    : googleActive
      ? 'google'
      : msActive
        ? 'microsoft'
        : null;

  const msAccount = accounts[0];

  const userId = sessionClaims
    ? sessionClaims.sub
    : googleActive && googleCredential
      ? getGoogleSub(googleCredential)
      : (msAccount?.localAccountId ?? null);

  const email = sessionClaims
    ? sessionClaims.email
    : googleActive && googleCredential
      ? getGoogleEmail(googleCredential)
      : (msAccount?.idTokenClaims?.['email'] as string | undefined ??
         msAccount?.username ??
         null);

  const sub = sessionClaims
    ? sessionClaims.sub
    : googleActive && googleCredential
      ? getGoogleSub(googleCredential)
      : ((msAccount?.idTokenClaims?.['sub'] as string | undefined) ?? null);

  const googlePicture = googleCredential ? getGooglePicture(googleCredential) : null;
  const picture = provider === 'google' ? googlePicture : msPicture;

  // Exchange an OIDC token for a backend session (fire-and-forget)
  const exchangeForSession = async (oidcToken: string) => {
    const session = await exchangeOidcForSession(oidcToken);
    if (session) {
      storeSession(session.accessToken, session.refreshToken);
      setSessionActive(true);
    }
  };

  const loginWithMicrosoft = async () => {
    await instance.loginRedirect({ scopes: ['openid', 'profile', 'email', 'User.Read'] });
  };

  const loginWithGoogle = (credential: string) => {
    setGoogleCredential(credential);
    setGoogleCredentialState(credential);
    // Exchange Google ID token for backend session
    void exchangeForSession(credential);
  };

  // After MSAL redirect completes, exchange the OIDC token for a backend session
  useEffect(() => {
    if (msActive && !sessionActive) {
      const account = accounts[0];
      if (account) {
        instance.acquireTokenSilent({
          account: account as AccountInfo,
          scopes: ['openid', 'profile', 'email', 'User.Read'],
        }).then((result) => {
          void exchangeForSession(result.idToken);
        }).catch(() => {
          // Silent acquire failed — session exchange skipped; OIDC token used as fallback
        });
      }
    }
  // Only run when MS auth state changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msActive]);

  // Fetch Microsoft profile photo when MS session becomes active
  useEffect(() => {
    if (!msActive || !msAccount) {
      setMsPicture(null);
      return;
    }
    void fetchMsProfilePhoto(msAccount as AccountInfo, instance).then((url) => {
      setMsPicture(url);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msActive, msAccount?.localAccountId]);

  // Listen for session-expired event to clear session state
  useEffect(() => {
    const handler = () => {
      clearSession();
      setSessionActive(false);
    };
    window.addEventListener('wordsprout:session-expired', handler);
    return () => window.removeEventListener('wordsprout:session-expired', handler);
  }, []);

  // On mount: if access token is expired but a refresh token exists, proactively
  // refresh the session so the user isn't bounced to /login unnecessarily.
  useEffect(() => {
    if (!sessionActive && getStoredRefreshToken()) {
      setSessionRestoring(true);
      getAccessToken().then((token) => {
        if (token) setSessionActive(true);
      }).catch(() => {
        // Refresh failed — user will see login page
      }).finally(() => {
        setSessionRestoring(false);
      });
    }
  // Only run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Backward-compatible alias
  const login = loginWithMicrosoft;

  const logout = async () => {
    // Revoke backend session if we have one
    const refreshToken = getStoredRefreshToken();
    if (refreshToken) {
      try {
        await fetch(`${API_BASE}/auth/session`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
      } catch {
        // Best-effort — proceed with local cleanup regardless
      }
    }
    clearSession();
    setSessionActive(false);

    if (googleActive) {
      setGoogleCredential(null);
      setGoogleCredentialState(null);
      // Disable One Tap auto-select so the account picker shows next time
      window.google?.accounts?.id?.disableAutoSelect();
    } else {
      if (msAccount) clearMsPhotoCache(msAccount.localAccountId);
      setMsPicture(null);
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
        sessionRestoring,
        provider,
        userId,
        email,
        sub,
        picture,
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


