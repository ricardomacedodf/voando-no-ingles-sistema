import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { supabase } from '@/api/supabaseClient';

const AuthContext = createContext();

function normalizeUser(rawUser) {
  if (!rawUser) return null;

  const metadata = rawUser.user_metadata || {};

  const fullName =
    metadata.full_name ||
    metadata.name ||
    rawUser.email ||
    'Usuário';

  const firstName = fullName.split(' ')[0] || 'Usuário';

  const avatarUrl =
    metadata.picture ||
    metadata.avatar_url ||
    metadata.photo_url ||
    '';

  return {
    ...rawUser,
    id: rawUser.id,
    email: rawUser.email || '',
    full_name: fullName,
    name: firstName,
    firstName,
    avatar_url: avatarUrl,
  };
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings] = useState({
    id: 'supabase-app',
    public_settings: {
      auth_required: true,
      mode: 'user',
    },
  });

  const checkAppState = useCallback(async () => {
    try {
      setIsLoadingAuth(true);
      setAuthError(null);

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      if (!session?.user) {
        setUser(null);
        setIsAuthenticated(false);
        setAuthError({
          type: 'auth_required',
          message: 'Login necessário',
        });
        return;
      }

      let authUser = session.user;
      if (!authUser?.id) {
        const {
          data: { user: fallbackUser },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError) throw userError;
        authUser = fallbackUser;
      }
      if (!authUser) throw new Error('UsuÃ¡rio autenticado nÃ£o encontrado');

      const normalizedUser = normalizeUser(authUser);

      setUser(normalizedUser);
      setIsAuthenticated(true);
      setAuthError(null);
    } catch (error) {
      console.error('Auth error:', error);
      setUser(null);
      setIsAuthenticated(false);
      setAuthError({
        type: 'auth_required',
        message: error?.message || 'Login necessário',
      });
    } finally {
      setIsLoadingAuth(false);
      setIsLoadingPublicSettings(false);
    }
  }, []);

  useEffect(() => {
    checkAppState();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setUser(null);
        setIsAuthenticated(false);
        setAuthError({
          type: 'auth_required',
          message: 'Login necessário',
        });
        setIsLoadingAuth(false);
        return;
      }

      const normalizedUser = normalizeUser(session.user);
      setUser(normalizedUser);
      setIsAuthenticated(true);
      setAuthError(null);
      setIsLoadingAuth(false);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [checkAppState]);

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAuthenticated(false);
    setAuthError({
      type: 'auth_required',
      message: 'Login necessário',
    });
  };

  const navigateToLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          prompt: 'select_account',
        },
      },
    });

    if (error) {
      console.error('Login error:', error);
      setAuthError({
        type: 'auth_required',
        message: error.message || 'Não foi possível iniciar o login com Google',
      });
      return { success: false, message: error.message };
    }

    return { success: true };
  };

  const loginWithEmail = async ({ email, password }) => {
    try {
      setIsLoadingAuth(true);
      setAuthError(null);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      const normalizedUser = normalizeUser(data.user);

      setUser(normalizedUser);
      setIsAuthenticated(true);
      setAuthError(null);

      return { success: true };
    } catch (error) {
      console.error('Email login error:', error);

      const message =
        error?.message || 'Não foi possível entrar com e-mail e senha';

      setUser(null);
      setIsAuthenticated(false);
      setAuthError({
        type: 'auth_required',
        message,
      });

      return { success: false, message };
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const signUpWithEmail = async ({ email, password }) => {
    try {
      setIsLoadingAuth(true);
      setAuthError(null);

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) throw error;

      if (data?.session?.user) {
        const normalizedUser = normalizeUser(data.session.user);
        setUser(normalizedUser);
        setIsAuthenticated(true);
      }

      return {
        success: true,
        needsEmailConfirmation: !data?.session,
        message: !data?.session
          ? 'Conta criada. Verifique seu e-mail para confirmar o cadastro.'
          : 'Conta criada com sucesso.',
      };
    } catch (error) {
      console.error('Sign up error:', error);

      const message =
        error?.message || 'Não foi possível criar sua conta';

      setAuthError({
        type: 'auth_required',
        message,
      });

      return { success: false, message };
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const requestPasswordReset = async (email) => {
    try {
      setAuthError(null);

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin,
      });

      if (error) throw error;

      return {
        success: true,
        message: 'Enviamos o link de recuperação para o seu e-mail.',
      };
    } catch (error) {
      console.error('Reset password error:', error);

      const message =
        error?.message || 'Não foi possível enviar o e-mail de recuperação';

      setAuthError({
        type: 'auth_required',
        message,
      });

      return { success: false, message };
    }
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
        loginWithEmail,
        signUpWithEmail,
        requestPasswordReset,
        checkAppState,
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
