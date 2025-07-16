
import { useState, useEffect, createContext, useContext } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { InputValidator } from '@/utils/inputValidation';
import { SecureStorage } from '@/utils/secureStorage';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName?: string) => {
    // Validate input
    if (!InputValidator.validateEmail(email)) {
      return { error: { message: 'Invalid email format' } };
    }
    
    const passwordValidation = InputValidator.validatePassword(password);
    if (!passwordValidation.isValid) {
      return { error: { message: passwordValidation.errors.join(', ') } };
    }
    
    // Sanitize full name if provided
    const sanitizedFullName = fullName ? InputValidator.sanitizeHTML(fullName.trim()) : undefined;
    
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email: email.toLowerCase().trim(),
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: sanitizedFullName ? { full_name: sanitizedFullName } : undefined
      }
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    // Validate email format
    if (!InputValidator.validateEmail(email)) {
      return { error: { message: 'Invalid email format' } };
    }
    
    const { error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password
    });
    return { error };
  };

  const signOut = async () => {
    // Clear secure storage on logout
    SecureStorage.clearAll();
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      signUp,
      signIn,
      signOut
    }}>
      {children}
    </AuthContext.Provider>
  );
};
