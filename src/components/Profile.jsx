import { useState } from 'react';
import { doc, setDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { User, Heart, CheckCircle2, AlertCircle, LogOut, Key, Trash2 } from 'lucide-react';

export default function Profile({ passcode, profileId, userData, onLogout, isNativeDevice = false, healthAuthorized = false, onRequestHealthAuth }) {
  const [displayName, setDisplayName] = useState(userData?.displayName || (profileId === 'him' ? 'Ameen' : 'Noor'));
  const [calorieGoal, setCalorieGoal] = useState(userData?.dailyCalorieGoal || 2000);
  const [age, setAge] = useState(userData?.age || 25);
  const [weight, setWeight] = useState(userData?.weight || (profileId === 'him' ? 175 : 130));
  const [height, setHeight] = useState(userData?.height || (profileId === 'him' ? 70 : 64));
  const [targetWeight, setTargetWeight] = useState(userData?.targetWeight || (profileId === 'him' ? 165 : 120));
  const [weightUnit, setWeightUnit] = useState(userData?.weightUnit || 'lbs');
  const [message, setMessage] = useState({ text: '', type: '' });
  const [loading, setLoading] = useState(false);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setMessage({ text: '', type: '' });
    setLoading(true);

    try {
      const userRef = doc(db, 'couples', passcode, 'users', profileId);
      await setDoc(userRef, {
        uid: profileId,
        displayName,
        dailyCalorieGoal: parseInt(calorieGoal, 10) || 2000,
        age: parseInt(age, 10) || 25,
        weight: parseFloat(weight) || 0,
        height: parseFloat(height) || 0,
        targetWeight: parseFloat(targetWeight) || 0,
        weightUnit
      }, { merge: true });
      
      setMessage({ text: 'Profile updated successfully!', type: 'success' });
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Failed to update profile.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleResetData = async () => {
    if (!window.confirm("Are you sure you want to delete all logged meals, activities, and daily summaries for this couple passcode? This will reset your streak to 0 and cannot be undone.")) return;
    
    setLoading(true);
    setMessage({ text: '', type: '' });

    try {
      // 1. Delete meals
      const mealsRef = collection(db, 'couples', passcode, 'meals');
      const mealsSnap = await getDocs(mealsRef);
      const deletePromises = [];
      mealsSnap.forEach(d => {
        deletePromises.push(deleteDoc(doc(db, 'couples', passcode, 'meals', d.id)));
      });

      // 2. Delete activities
      const actsRef = collection(db, 'couples', passcode, 'activities');
      const actsSnap = await getDocs(actsRef);
      actsSnap.forEach(d => {
        deletePromises.push(deleteDoc(doc(db, 'couples', passcode, 'activities', d.id)));
      });

      // 3. Delete summaries
      const sumsRef = collection(db, 'couples', passcode, 'dailySummaries');
      const sumsSnap = await getDocs(sumsRef);
      sumsSnap.forEach(d => {
        deletePromises.push(deleteDoc(doc(db, 'couples', passcode, 'dailySummaries', d.id)));
      });

      await Promise.all(deletePromises);

      // 4. Reset profile goals to defaults
      await setDoc(doc(db, 'couples', passcode, 'users', 'him'), {
        displayName: 'Ameen',
        dailyCalorieGoal: 2000,
        age: 25,
        weight: 175,
        height: 70,
        targetWeight: 165,
        weightUnit: 'lbs'
      }, { merge: true });

      await setDoc(doc(db, 'couples', passcode, 'users', 'her'), {
        displayName: 'Noor',
        dailyCalorieGoal: 2000,
        age: 25,
        weight: 130,
        height: 64,
        targetWeight: 120,
        weightUnit: 'lbs'
      }, { merge: true });

      // Reset local state variables
      setDisplayName(profileId === 'him' ? 'Ameen' : 'Noor');
      setCalorieGoal(2000);
      setAge(25);
      setWeight(profileId === 'him' ? 175 : 130);
      setHeight(profileId === 'him' ? 70 : 64);
      setTargetWeight(profileId === 'him' ? 165 : 120);
      setWeightUnit('lbs');

      setMessage({ text: 'All testing logs and streaks reset successfully! Ready for a fresh start.', type: 'success' });
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Failed to reset couple data.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      <h2 className="text-2xl font-black text-brand-charcoal">Settings & Profile</h2>

      {message.text && (
        <div className={`p-4 rounded-2xl flex items-start gap-3 border text-sm font-semibold ${
          message.type === 'success' 
            ? 'bg-brand-green-light text-brand-green border-brand-green/20' 
            : 'bg-brand-rose-light text-brand-rose border-brand-rose/20'
        }`}>
          {message.type === 'success' ? <CheckCircle2 size={20} className="shrink-0" /> : <AlertCircle size={20} className="shrink-0" />}
          <div>{message.text}</div>
        </div>
      )}

      {/* User Information Form */}
      <div className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 bg-neutral-100 rounded-xl flex items-center justify-center text-brand-charcoal">
            <User size={18} />
          </div>
          <h3 className="font-bold text-lg text-brand-charcoal">Personal Info</h3>
        </div>

        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-brand-slate mb-1">Your Name</label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-3 bg-neutral-50 rounded-2xl border border-neutral-200 text-brand-charcoal font-medium placeholder-neutral-400 focus:outline-none focus:border-brand-green focus:bg-white transition-all text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-slate mb-1">Age</label>
              <input
                type="number"
                required
                min="10"
                max="120"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="w-full px-4 py-3 bg-neutral-50 rounded-2xl border border-neutral-200 text-brand-charcoal font-medium focus:outline-none focus:border-brand-green focus:bg-white transition-all text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-slate mb-1">Unit System</label>
              <select
                value={weightUnit}
                onChange={(e) => setWeightUnit(e.target.value)}
                className="w-full px-4 py-3 bg-neutral-50 rounded-2xl border border-neutral-200 text-brand-charcoal font-bold focus:outline-none focus:border-brand-green focus:bg-white transition-all text-sm appearance-none cursor-pointer"
              >
                <option value="lbs">lbs / inches</option>
                <option value="kg">kg / cm</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-slate mb-1">Weight</label>
              <input
                type="number"
                required
                step="0.1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-full px-3 py-3 bg-neutral-50 rounded-2xl border border-neutral-200 text-brand-charcoal font-medium focus:outline-none focus:border-brand-green focus:bg-white transition-all text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-slate mb-1">Target Wt</label>
              <input
                type="number"
                required
                step="0.1"
                value={targetWeight}
                onChange={(e) => setTargetWeight(e.target.value)}
                className="w-full px-3 py-3 bg-neutral-50 rounded-2xl border border-neutral-200 text-brand-charcoal font-medium focus:outline-none focus:border-brand-green focus:bg-white transition-all text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-slate mb-1">
                Height ({weightUnit === 'lbs' ? 'in' : 'cm'})
              </label>
              <input
                type="number"
                required
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                className="w-full px-3 py-3 bg-neutral-50 rounded-2xl border border-neutral-200 text-brand-charcoal font-medium focus:outline-none focus:border-brand-green focus:bg-white transition-all text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-brand-slate mb-1">Daily Calorie Goal</label>
            <input
              type="number"
              required
              min="500"
              value={calorieGoal}
              onChange={(e) => setCalorieGoal(e.target.value)}
              className="w-full px-4 py-3 bg-neutral-50 rounded-2xl border border-neutral-200 text-brand-charcoal font-medium placeholder-neutral-400 focus:outline-none focus:border-brand-green focus:bg-white transition-all text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-brand-charcoal text-white rounded-2xl font-bold hover:bg-brand-charcoal/90 transition-all text-sm mt-2"
          >
            Save Profile
          </button>
        </form>
      </div>

      {/* Apple Health integration for iOS native wrapper */}
      {isNativeDevice && (
        <div className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm space-y-4 animate-fade-in">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-brand-blue-light rounded-xl flex items-center justify-center text-brand-blue shadow-xs">
              <span className="text-lg">❤️</span>
            </div>
            <h3 className="font-bold text-lg text-brand-charcoal">Apple Health</h3>
          </div>
          
          <p className="text-xs text-brand-slate leading-relaxed font-medium">
            Connect BiteSync with Apple Health to automatically fetch your daily step count and active calorie burn.
          </p>

          {healthAuthorized ? (
            <div className="p-4 bg-brand-green-light/40 border border-brand-green/20 rounded-2xl flex items-center gap-3">
              <span className="text-xl">✅</span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-brand-green">Connected</p>
                <p className="text-xs text-brand-slate mt-0.5">Steps & energy are syncing automatically.</p>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={onRequestHealthAuth}
              className="w-full py-3.5 bg-brand-blue text-white rounded-2xl font-bold hover:bg-brand-blue/90 transition-all text-sm flex items-center justify-center gap-2"
            >
              <span>Connect Apple Health</span>
            </button>
          )}
        </div>
      )}

      {/* Shared Space Info */}
      <div className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 bg-brand-rose-light rounded-xl flex items-center justify-center text-brand-rose">
            <Heart size={18} className="fill-current" />
          </div>
          <h3 className="font-bold text-lg text-brand-charcoal">Partner Sync Status</h3>
        </div>

        <div className="space-y-3">
          <div className="p-4 bg-brand-green-light text-brand-green border border-brand-green/20 rounded-2xl flex items-center gap-3">
            <CheckCircle2 size={20} className="shrink-0" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-brand-green/80">Sync Connection</p>
              <p className="text-sm font-black text-brand-charcoal mt-0.5">Linked Automatically</p>
            </div>
          </div>

          <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-2xl space-y-2">
            <div className="flex items-center gap-2 text-brand-slate">
              <Key size={16} />
              <span className="text-xs font-bold uppercase tracking-wider">Shared Passcode</span>
            </div>
            <p className="text-sm font-black text-brand-charcoal bg-white px-3 py-1.5 rounded-lg border border-neutral-200 inline-block font-mono">
              {passcode}
            </p>
            <p className="text-xs text-brand-slate leading-relaxed font-medium mt-1">
              You and your partner are connected through this shared code. Share this passcode with her so she can sync with your entries on her device!
            </p>
          </div>
        </div>
      </div>

      {/* Reset Couple Data button */}
      <button
        onClick={handleResetData}
        disabled={loading}
        className="w-full py-4 bg-brand-rose-light text-brand-rose border border-brand-rose/20 hover:bg-brand-rose-light/50 rounded-3xl font-bold flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.98] cursor-pointer"
      >
        <Trash2 size={18} />
        Reset logs & streaks
      </button>

      {/* Log Out button */}
      <button
        onClick={onLogout}
        className="w-full py-4 bg-white border border-neutral-200 hover:bg-neutral-50 text-brand-rose rounded-3xl font-bold flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
      >
        <LogOut size={18} />
        Log Out
      </button>
    </div>
  );
}
