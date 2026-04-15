import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState({
    id: 'local-user',
    name: 'Usuário Local',
    email: 'local@offline.app'
  });

  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState({
    id: 'local-app',
    public_settings: {
      auth_required: false,
      mode: 'local'
    }
  });

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setIsLoadingAuth(true);
      setAuthError(null);

      // Modo local/offline:
      // não consulta Base44, não verifica token e não tenta autenticar online.
      setAppPublicSettings({
        id: 'local-app',
        public_settings: {
          auth_required: false,
          mode: 'local'
        }
      });

      setUser({
        id: 'local-user',
        name: 'Usuário Local',
        email: 'local@offline.app'
      });

      setIsAuthenticated(true);
    } catch (error) {
      console.error('Unexpected local auth error:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'Erro ao iniciar modo local'
      });
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  };

  const logout = () => {
    // No modo local, apenas limpa o usuário em memória.
    setUser(null);
    setIsAuthenticated(false);
  };

  const navigateToLogin = () => {
    // No modo local, não existe redirecionamento de login.
    console.warn('Modo local ativo: login online desabilitado.');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings,
        authError,
        appPublicSettings,
        logout,
        navigateToLogin,
        checkAppState
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};