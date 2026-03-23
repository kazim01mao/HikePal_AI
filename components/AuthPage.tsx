import React, { useState } from 'react';
import { supabase, mockLogin } from '../utils/supabaseClient';
import { AuthMode, User } from '../types';
// inline Button and Input components (originally in ui folder)

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  isLoading?: boolean;
  fullWidth?: boolean;
}

const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  isLoading, 
  fullWidth, 
  className = '', 
  disabled,
  ...props 
}) => {
  const baseStyles = "inline-flex items-center justify-center rounded-lg px-4 py-3 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";
  const variants = {
    primary: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-200",
    secondary: "bg-stone-100 text-stone-900 hover:bg-stone-200",
    outline: "border border-stone-300 bg-transparent hover:bg-stone-50 text-stone-700",
    ghost: "bg-transparent hover:bg-stone-100 text-stone-600 hover:text-stone-900",
  };
  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${widthClass} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Loading...
        </span>
      ) : children}
    </button>
  );
};

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

const Input: React.FC<InputProps> = ({ label, error, icon, className = '', ...props }) => {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-sm font-medium text-stone-700">{label}</label>}
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
            {icon}
          </div>
        )}
        <input
          className={`
            block w-full rounded-lg border border-stone-300 bg-white 
            ${icon ? 'pl-10' : 'pl-4'} pr-4 py-2.5 
            text-stone-900 placeholder:text-stone-400 
            focus:border-emerald-500 focus:ring-emerald-500 focus:ring-1 focus:outline-none 
            transition-all duration-200
            disabled:bg-stone-50 disabled:text-stone-500
            ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}
            ${className}
          `}
          {...props}
        />
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
};
import { Mail, Lock, Mountain, AlertCircle } from 'lucide-react';

interface AuthPageProps {
  onLoginSuccess: (user: User) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<AuthMode>(AuthMode.LOGIN);

  const handleGuestLogin = () => {
    const guestUser: User = {
      id: 'guest_user',
      name: 'Guest Explorer',
      email: 'guest@hikepal.ai',
      role: 'hiker',
      isGuest: true
    };
    onLoginSuccess(guestUser);
  };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === AuthMode.SIGNUP) {
        // 【注册流程】
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (authError) throw authError;

        if (data.user) {
          // 【关键：同步注册信息到 profiles 表】
          await supabase.from('profiles').upsert({
            id: data.user.id,
            full_name: fullName,
            username: email.split('@')[0],
            role: 'hiker'
          });

          const loggedInUser: User = {
            id: data.user.id,
            name: fullName || email.split('@')[0],
            email: data.user.email,
            role: 'hiker'
          };
          onLoginSuccess(loggedInUser);
        }
      } else {
        // 【登录流程】
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (authError) throw authError;

        if (data.user) {
          const loggedInUser: User = {
            id: data.user.id,
            name: data.user.user_metadata?.full_name || email.split('@')[0],
            email: data.user.email,
            role: 'hiker'
          };
          onLoginSuccess(loggedInUser);
        }
      }
    } catch (err: any) {
      // 如果 Supabase 未配置或失败，尝试 Mock 登录用于演示
      console.warn("Supabase Auth failed, trying mock login:", err.message);
      try {
        const { user, error: mockErr } = await mockLogin(email);
        if (user && !mockErr) {
           onLoginSuccess(user);
        } else {
           setError("Mock login failed");
        }
      } catch (mockErr) {
        setError(mode === AuthMode.SIGNUP ? "注册失败，请检查信息" : "登录失败，请检查账号密码");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-hike-green flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-hike-light p-4 rounded-2xl mb-4">
            <Mountain className="h-12 w-12 text-hike-green" />
          </div>
          <h1 className="text-3xl font-black text-stone-800">HikePal</h1>
          <p className="text-stone-500">HK Hiking AI Assistant</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 flex items-center gap-3 text-red-700 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === AuthMode.SIGNUP && (
            <Input 
              label="Full Name" 
              icon={<Mail className="h-4 w-4" />} 
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              required
            />
          )}
          <Input 
            label="Email Address" 
            icon={<Mail className="h-4 w-4" />} 
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <Input 
            label="Password" 
            icon={<Lock className="h-4 w-4" />} 
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          <Button type="submit" fullWidth isLoading={loading}>
            {mode === AuthMode.LOGIN ? 'Login' : 'Create Account'}
          </Button>

          {mode === AuthMode.LOGIN && (
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-stone-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-stone-400">OR</span>
              </div>
            </div>
          )}

          {mode === AuthMode.LOGIN && (
            <Button 
              type="button" 
              variant="outline" 
              fullWidth 
              onClick={handleGuestLogin}
              className="border-2 border-emerald-100 text-emerald-700 hover:bg-emerald-50"
            >
              Try as Guest
            </Button>
          )}
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => setMode(mode === AuthMode.LOGIN ? AuthMode.SIGNUP : AuthMode.LOGIN)}
            className="text-sm text-hike-green font-bold hover:underline"
          >
            {mode === AuthMode.LOGIN ? "Don't have an account? Sign up" : 'Already have an account? Login'}
          </button>
        </div>
      </div>
    </div>
  );
};
