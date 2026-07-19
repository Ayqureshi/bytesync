import { useState, useEffect } from 'react';
import { Lock, Heart, ShieldAlert, Sparkles } from 'lucide-react';

export default function LockScreen({ onLogin }) {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState(1); // 1: passcode, 2: profile selection
  const [validatedPasscode, setValidatedPasscode] = useState('');

  const handleValidate = (code) => {
    if (!code) return;
    const cleanCode = code.trim();
    
    if (cleanCode !== '10925') {
      setError('Invalid passcode. Please enter the correct shared passcode.');
      return;
    }

    setValidatedPasscode(cleanCode);
    setStep(2);
    setError('');
  };

  // Check URL parameters for auto-authentication (e.g. ?code=Ameen&Noor)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('code') || params.get('passcode');
    if (codeParam) {
      setTimeout(() => {
        handleValidate(codeParam.trim());
      }, 0);
    }
  }, []);

  const handlePasscodeSubmit = (e) => {
    e.preventDefault();
    if (!passcode) return;
    handleValidate(passcode);
  };

  const handleSelectProfile = (profileId) => {
    // Save to localStorage
    localStorage.setItem('bitesync_passcode', validatedPasscode);
    localStorage.setItem('bitesync_profile', profileId);
    
    // Clear URL query parameters for clean look
    window.history.replaceState({}, document.title, window.location.pathname);
    
    onLogin(validatedPasscode, profileId);
  };

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-brand-cream px-4">
      <div className="w-full max-w-md bg-white/85 backdrop-blur-lg border border-neutral-100 rounded-[32px] p-8 shadow-xl text-center space-y-6 transition-all duration-300">
        
        {step === 1 ? (
          /* Step 1: Passcode Lock Screen */
          <form onSubmit={handlePasscodeSubmit} className="space-y-6">
            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 bg-brand-green-light rounded-3xl flex items-center justify-center text-brand-green shadow-sm animate-pulse">
                <Lock size={32} />
              </div>
              <h2 className="text-2xl font-black text-brand-charcoal tracking-tight mt-2">BiteSync Private Space</h2>
              <p className="text-xs text-brand-slate font-medium max-w-[280px]">
                Enter your couple's shared passcode to access your custom calorie tracker.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-brand-rose-light text-brand-rose rounded-xl border border-brand-rose/10 text-xs font-bold flex items-center gap-2">
                <ShieldAlert size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <input
                type="text"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter shared passcode (e.g. Ameen&Noor)"
                className="w-full px-4 py-3 bg-neutral-50 rounded-2xl border border-neutral-200 text-center text-brand-charcoal font-black placeholder-neutral-400 focus:outline-none focus:border-brand-green focus:bg-white transition-all"
                autoFocus
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-brand-charcoal hover:bg-brand-charcoal/90 text-white rounded-2xl font-bold transition-all text-sm shadow-md flex items-center justify-center gap-2"
            >
              Unlock App
              <Sparkles size={16} />
            </button>
          </form>
        ) : (
          /* Step 2: Profile Selection */
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 bg-brand-rose-light rounded-3xl flex items-center justify-center text-brand-rose shadow-sm">
                <Heart size={32} className="fill-current" />
              </div>
              <h2 className="text-2xl font-black text-brand-charcoal tracking-tight mt-2">Who is this?</h2>
              <p className="text-xs text-brand-slate font-medium">
                Select your profile. This will remember your choice on this device.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Profile: Him */}
              <button
                onClick={() => handleSelectProfile('him')}
                className="flex flex-col items-center gap-3 p-5 bg-neutral-50 hover:bg-brand-green-light border border-neutral-200 hover:border-brand-green/30 rounded-3xl transition-all group"
              >
                <div className="w-12 h-12 bg-brand-green-light text-brand-green rounded-full flex items-center justify-center font-black text-lg group-hover:scale-110 transition-all">
                  👦
                </div>
                <span className="font-black text-brand-charcoal text-sm">Him (Ameen)</span>
              </button>

              {/* Profile: Her */}
              <button
                onClick={() => handleSelectProfile('her')}
                className="flex flex-col items-center gap-3 p-5 bg-neutral-50 hover:bg-brand-rose-light border border-neutral-200 hover:border-brand-rose/30 rounded-3xl transition-all group"
              >
                <div className="w-12 h-12 bg-brand-rose-light text-brand-rose rounded-full flex items-center justify-center font-black text-lg group-hover:scale-110 transition-all">
                  👧
                </div>
                <span className="font-black text-brand-charcoal text-sm">Her (Noor)</span>
              </button>
            </div>

            <button
              onClick={() => setStep(1)}
              className="text-xs text-brand-slate hover:text-brand-charcoal font-bold underline transition-all"
            >
              Go Back
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
