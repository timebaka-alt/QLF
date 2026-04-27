'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';

interface AuthContextType {
  user: any | null;
  appUser: any | null | "NO_USERS"; // "NO_USERS" implies the database is empty and needs an admin
  originalAppUser: any | null; // The real user when impersonating
  loading: boolean;
  signIn: (email: string, pass: string) => Promise<void>;
  signOut: () => Promise<void>;
  checkSystemEmpty: () => Promise<boolean>;
  impersonate: (userId: string | null) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  appUser: null,
  originalAppUser: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
  checkSystemEmpty: async () => false,
  impersonate: () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [appUser, setAppUser] = useState<any | null | "NO_USERS">(null);
  const [originalAppUser, setOriginalAppUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const checkSystemEmpty = async () => {
    const state = useStore.getState();
    return state.users.length === 0;
  };

  useEffect(() => {
    // Initial load check
    const checkState = () => {
      const state = useStore.getState();
      const storedUserId = localStorage.getItem('activeUserId');
      const impersonatedId = localStorage.getItem('impersonatedUserId');
      
      if (storedUserId) {
        const found = state.users.find(u => u.id === storedUserId);
        if (found) {
          setOriginalAppUser(found);
          setUser({ email: found.email || '' });
          
          if (impersonatedId && found.isAdmin) {
            const impFound = state.users.find(u => u.id === impersonatedId);
            if (impFound) {
              setAppUser(impFound);
            } else {
              setAppUser(found);
            }
          } else {
            setAppUser(found);
          }
        } else {
          localStorage.removeItem('activeUserId');
          localStorage.removeItem('impersonatedUserId');
          setUser(null);
          setOriginalAppUser(null);
          setAppUser(state.users.length === 0 ? "NO_USERS" : null);
        }
      } else {
        setAppUser(state.users.length === 0 ? "NO_USERS" : null);
        setOriginalAppUser(null);
      }
      setLoading(false);
    };

    checkState();
    
    // Subscribe to store changes
    const unsubscribe = useStore.subscribe((state) => {
        const storedUserId = localStorage.getItem('activeUserId');
        const impersonatedId = localStorage.getItem('impersonatedUserId');
        
        if (storedUserId) {
           const found = state.users.find(u => u.id === storedUserId);
           if (found) {
               setOriginalAppUser(found);
               setUser({ email: found.email || '' });
               
               if (impersonatedId && found.isAdmin) {
                 const impFound = state.users.find(u => u.id === impersonatedId);
                 if (impFound) {
                   setAppUser(impFound);
                 } else {
                   setAppUser(found);
                 }
               } else {
                 setAppUser(found);
               }
           } else {
               localStorage.removeItem('activeUserId');
               localStorage.removeItem('impersonatedUserId');
               setUser(null);
               setOriginalAppUser(null);
               setAppUser(state.users.length === 0 ? "NO_USERS" : null);
           }
        }
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, pass: string) => {
    const state = useStore.getState();
    const userMatch = state.users.find(u => u.email === email && u.password === pass);
    if (!userMatch) {
      throw new Error('Email hoặc mật khẩu không chính xác');
    }
    localStorage.setItem('activeUserId', userMatch.id);
    localStorage.removeItem('impersonatedUserId');
    setUser({ email: userMatch.email || '' });
    setAppUser(userMatch);
    setOriginalAppUser(userMatch);
  };

  const signOut = async () => {
    localStorage.removeItem('activeUserId');
    localStorage.removeItem('impersonatedUserId');
    setUser(null);
    setOriginalAppUser(null);
    const state = useStore.getState();
    setAppUser(state.users.length === 0 ? "NO_USERS" : null);
  };

  const impersonate = (userId: string | null) => {
    if (!originalAppUser?.isAdmin) return;
    
    if (userId) {
      localStorage.setItem('impersonatedUserId', userId);
      const state = useStore.getState();
      const impFound = state.users.find(u => u.id === userId);
      if (impFound) setAppUser(impFound);
    } else {
      localStorage.removeItem('impersonatedUserId');
      setAppUser(originalAppUser);
    }
  };

  return (
    <AuthContext.Provider value={{ user, appUser, originalAppUser, loading, signIn, signOut, checkSystemEmpty, impersonate }}>
      {children}
    </AuthContext.Provider>
  );
}
