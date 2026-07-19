import { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Flame, LogIn, UserPlus } from 'lucide-react';

export default function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [calorieGoal, setCalorieGoal] = useState('2000');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        // Create user in Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Create user document in Firestore
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: email.toLowerCase().trim(),
          displayName: displayName || email.split('@')[0],
          dailyCalorieGoal: parseInt(calorieGoal, 10) || 2000,
          partnerUid: null,
          partnerEmail: null,
          pendingPartnerEmail: null
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('That email address is already in use.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Invalid email or password.');
      } else {
        setError(err.message || 'An error occurred during authentication.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-height-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 border border-neutral-100 shadow-xl transition-all duration-300">
        
        {/* Header/Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-brand-green-light rounded-2xl flex items-center justify-center mb-3 text-brand-green shadow-inner">
            <Flame size={32} className="fill-current" />
          </div>
          <h1 className="text-3xl font-extrabold text-brand-charcoal tracking-tight">BiteSync</h1>
          <p className="text-sm text-brand-slate mt-1 text-center font-medium">
            Track calories and build habits together.
          </p>
        </div>

        {/* Auth Mode Toggle */}
        <div className="flex bg-neutral-100 p-1.5 rounded-2xl mb-6 font-semibold text-sm">
          <button
            onClick={() => { setIsSignUp(false); setError(''); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all duration-200 ${
              !isSignUp ? 'bg-white text-brand-charcoal shadow-sm' : 'text-brand-slate hover:text-brand-charcoal'
            }`}
          >
            <LogIn size={16} />
            Log In
          </button>
          <button
            onClick={() => { setIsSignUp(true); setError(''); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all duration-200 ${
              isSignUp ? 'bg-white text-brand-charcoal shadow-sm' : 'text-brand-slate hover:text-brand-charcoal'
            }`}
          >
            <UserPlus size={16} />
            Sign Up
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-brand-rose-light text-brand-rose border border-rose-200 px-4 py-3 rounded-2xl mb-6 text-sm font-semibold text-center animate-shake">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-brand-slate mb-1">
                  Your Name
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Sarah"
                  className="w-full px-4 py-3 bg-neutral-50 rounded-2xl border border-neutral-200 text-brand-charcoal font-medium placeholder-neutral-400 focus:outline-none focus:border-brand-green focus:bg-white transition-all text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-brand-slate mb-1">
                  Daily Calorie Goal
                </label>
                <input
                  type="number"
                  required
                  min="500"
                  max="10000"
                  value={calorieGoal}
                  onChange={(e) => setCalorieGoal(e.target.value)}
                  placeholder="2000"
                  className="w-full px-4 py-3 bg-neutral-50 rounded-2xl border border-neutral-200 text-brand-charcoal font-medium placeholder-neutral-400 focus:outline-none focus:border-brand-green focus:bg-white transition-all text-sm"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-brand-slate mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-3 bg-neutral-50 rounded-2xl border border-neutral-200 text-brand-charcoal font-medium placeholder-neutral-400 focus:outline-none focus:border-brand-green focus:bg-white transition-all text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-brand-slate mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-neutral-50 rounded-2xl border border-neutral-200 text-brand-charcoal font-medium placeholder-neutral-400 focus:outline-none focus:border-brand-green focus:bg-white transition-all text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-brand-charcoal hover:bg-brand-charcoal/90 text-white rounded-2xl font-bold transition-all shadow-md active:scale-[0.98] text-sm flex items-center justify-center gap-2 mt-6"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : isSignUp ? (
              'Create Account'
            ) : (
              'Sign In'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
