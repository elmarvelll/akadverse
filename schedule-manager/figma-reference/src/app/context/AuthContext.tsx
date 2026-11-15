import { createContext, useContext, useState, ReactNode } from 'react';

export type Role = 'student' | 'faculty' | 'admin' | null;

interface AuthState {
  role: Role;
  login: (role: Role) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>('student');
  
  return (
    <AuthContext.Provider value={{ role, login: setRole, logout: () => setRole(null) }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
