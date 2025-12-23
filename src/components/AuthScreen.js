import { useState, useEffect } from 'react';
import { useGame } from '@/context/GameContext';
import { Crown, Mail, Lock, User, AlertCircle, CheckCircle, Loader, LogOut, Shield } from 'lucide-react';
import LegalDocs from '@/components/Legal/LegalDocs';

// NOTE: added props for legal view navigation from page.js
export default function AuthScreen({ onLegalClick, currentView, onBack }) {
  const { login, signup, resendVerification, logout, resetPassword, user } = useGame();
  const [isLogin, setIsLogin] = useState(true);
  const [isForgot, setIsForgot] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState(''); 
  const [honeypot, setHoneypot] = useState(''); // The Trap Field
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // Auto-fix: If an anonymous user is stuck, log them out automatically
  useEffect(() => {
    if (user && user.isAnonymous) {
        logout();
    }
  }, [user]);

  // Handle Legal View directly inside Auth wrapper if triggered
  if (currentView === 'legal') {
      return (
          <div className="min-h-screen bg-black">
               <LegalDocs goBack={onBack} />
          </div>
      );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // --- HONEYPOT CHECK ---
    if (honeypot) {
        console.warn("Bot detected. Action blocked.");
        setLoading(true);
        setTimeout(() => setLoading(false), 2000); 
        return; 
    }

    setLoading(true);

    try {
      if (isForgot) {
        await resetPassword(email);
        setResetSent(true);
      } else if (isLogin) {
        await login(email, password);
      } else {
        await signup(email, password, username);
      }
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/invalid-credential') setError("Incorrect email or password.");
      else if (err.code === 'auth/email-already-in-use') setError("Email already taken.");
      else if (err.code === 'auth/weak-password') setError("Password must be at least 6 characters.");
      else if (err.code === 'auth/user-not-found') setError("No user found with this email.");
      else setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      await resendVerification();
      setVerificationSent(true);
    } catch (err) {
      setError("Wait a moment before sending another email.");
    }
  };

  // --- View: Verification Required ---
  if (user && !user.emailVerified && !user.isAnonymous) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-slate-200">
        <div className="max-w-md w-full bg-slate-900 border border-amber-900/50 rounded-xl p-8 text-center shadow-2xl">
           <Mail className="w-16 h-16 text-amber-500 mx-auto mb-4" />
           <h2 className="text-2xl font-serif font-bold text-amber-100 mb-2">Verify Your Raven</h2>
           <p className="text-slate-400 mb-6">
             We sent a verification link to <span className="text-white font-bold">{user.email}</span>. 
             Please check your inbox (and spam) to enter the Realm.
           </p>
           
           {verificationSent ? (
             <div className="flex items-center justify-center gap-2 text-emerald-400 bg-emerald-950/30 p-3 rounded border border-emerald-900 mb-4">
               <CheckCircle className="w-5 h-5"/> Sent! Check your inbox.
             </div>
           ) : (
             <button onClick={handleResend} className="w-full bg-slate-800 hover:bg-slate-700 text-white py-3 rounded transition-colors mb-4">
               Resend Verification Email
             </button>
           )}
           
           <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-slate-800">
                <button onClick={() => window.location.reload()} className="text-amber-500 hover:text-amber-400 text-sm font-bold">
                    I have verified it, let me in!
                </button>
                
                <button onClick={logout} className="text-slate-500 hover:text-white text-sm flex items-center justify-center gap-2">
                    <LogOut className="w-4 h-4" /> Sign Out / Use Different Email
                </button>
           </div>
        </div>
      </div>
    );
  }

  // --- View: Login / Signup Form ---
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('/map.jpg')] bg-cover opacity-10 blur-sm"></div>
      
      <div className="max-w-md w-full bg-slate-900/90 border border-amber-900/50 rounded-xl p-8 shadow-2xl relative z-10 backdrop-blur-md">
        <div className="text-center mb-8">
           <div className="inline-flex p-3 rounded-full bg-slate-950 border border-amber-900/50 mb-4">
             <Crown className="w-8 h-8 text-amber-500" />
           </div>
           <h1 className="text-3xl font-serif font-bold text-amber-100">Realm of Allania</h1>
           <p className="text-slate-500 text-sm mt-2">Enter the gates, adventurer.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
           {!isLogin && !isForgot && (
             <div className="relative">
               <User className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
               <input 
                 type="text" 
                 placeholder="Adventurer Name" 
                 className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:border-amber-500 focus:outline-none"
                 value={username}
                 onChange={(e) => setUsername(e.target.value)}
                 required
               />
               <input 
                 type="text" 
                 name="website_url_confirm" 
                 className="absolute opacity-0 -z-10 h-0 w-0" 
                 tabIndex={-1}
                 autoComplete="off"
                 value={honeypot}
                 onChange={(e) => setHoneypot(e.target.value)}
               />
             </div>
           )}

           <div className="relative">
             <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
             <input 
               type="email" 
               placeholder="Email Address" 
               className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:border-amber-500 focus:outline-none"
               value={email}
               onChange={(e) => setEmail(e.target.value)}
               required
             />
           </div>

           {!isForgot && (
             <div className="relative">
               <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
               <input
                 type="password"
                 placeholder="Password"
                 className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:border-amber-500 focus:outline-none"
                 value={password}
                 onChange={(e) => setPassword(e.target.value)}
                 required
               />
             </div>
           )}

           {error && (
             <div className="bg-red-900/20 border border-red-900/50 text-red-400 text-sm p-3 rounded flex items-center gap-2">
               <AlertCircle className="w-4 h-4 shrink-0" />
               {error}
             </div>
           )}

           {resetSent && isForgot ? (
              <div className="bg-emerald-900/20 border border-emerald-900/50 text-emerald-400 text-sm p-3 rounded flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                Reset link sent! Check your inbox.
              </div>
           ) : (
             <button
               type="submit"
               disabled={loading}
               className="w-full bg-amber-700 hover:bg-amber-600 text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-900/20"
             >
               {loading ? <Loader className="w-5 h-5 animate-spin"/> : (isForgot ? "Send Reset Link" : (isLogin ? "Enter Realm" : "Create Account"))}
             </button>
           )}
        </form>

        <div className="mt-6 text-center space-y-4">
          {!isForgot && (
            <button
                onClick={() => { setIsForgot(true); setError(''); }}
                className="text-slate-500 hover:text-white text-xs underline decoration-slate-700 hover:decoration-white"
            >
                Forgot Password?
            </button>
          )}

          <button 
            onClick={() => {
                if (isForgot) setIsForgot(false);
                else setIsLogin(!isLogin);
                setError('');
                setResetSent(false);
            }}
            className="text-slate-400 hover:text-amber-500 text-sm transition-colors block w-full"
          >
            {isForgot ? "Back to Login" : (isLogin ? "Need an account? Join the adventure" : "Already have a hero? Login")}
          </button>
          
          {/* Legal Links Footer */}
          <div className="pt-4 border-t border-slate-800 text-[10px] text-slate-600 flex flex-col items-center gap-1">
              <button onClick={onLegalClick} className="flex items-center gap-1 hover:text-slate-400 transition-colors">
                  <Shield className="w-3 h-3" />
                  Legal & Privacy Policy
              </button>
              <p>&copy; 2025 Realm of Allania. All Rights Reserved.</p>
          </div>
        </div>
      </div>
    </div>
  );
}