import { useState, useEffect } from 'react';
import { collection, addDoc, deleteDoc, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Scale, TrendingUp, PlusCircle, CheckCircle2, ChevronRight, Activity, Trash2 } from 'lucide-react';

export default function Progress({ 
  passcode, 
  profileId, 
  userData, 
  partnerData, 
  userWeights = [], 
  partnerWeights = [],
  isNativeDevice = false,
  healthAuthorized = false,
  onRequestHealthAuth,
  userSummaries = {}
}) {
  const [newWeight, setNewWeight] = useState('');
  const [logDate, setLogDate] = useState(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [calculatorMessage, setCalculatorMessage] = useState('');

  // Setup Dynamic Slider States initialized from user profile or defaults
  const weightUnit = userData?.weightUnit || 'lbs';
  const initialWeight = userData?.weight || (profileId === 'him' ? 175 : 130);
  const targetWeightGoal = userData?.targetWeight || (profileId === 'him' ? 165 : 120);

  const [sliderTargetWeight, setSliderTargetWeight] = useState(targetWeightGoal);
  const [sliderPace, setSliderPace] = useState(-1.0); // lbs or kg per week (negative is loss)
  const [activityLevel, setActivityLevel] = useState(1.375); // default light activity BMR multiplier
  const [movementBasis, setMovementBasis] = useState('7day');
  const [hasInitialized, setHasInitialized] = useState(false);

  // Sync slider target weight when userData is loaded from Firestore (run once per mount)
  useEffect(() => {
    if (userData?.targetWeight !== undefined && !hasInitialized) {
      setSliderTargetWeight(userData.targetWeight);
      setHasInitialized(true);
    }
  }, [userData?.targetWeight, hasInitialized]);

  // Helper conversions
  const lbsToKg = (lbs) => lbs * 0.45359237;
  const inToCm = (inches) => inches * 2.54;

  // Calculate average active calories burned over the last 7 days from userSummaries
  const calculate7DayActiveBurn = () => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      dates.push(`${yyyy}-${mm}-${dd}`);
    }

    let totalActiveBurn = 0;
    let daysWithData = 0;

    dates.forEach(dStr => {
      const summary = userSummaries[dStr];
      if (summary && summary.activeCaloriesBurned > 0) {
        totalActiveBurn += summary.activeCaloriesBurned;
        daysWithData++;
      }
    });

    const todayStr = dates[0];
    const todayActive = userSummaries[todayStr]?.activeCaloriesBurned || 0;
    const avgActiveBurn = daysWithData > 0 ? Math.round(totalActiveBurn / daysWithData) : 0;
    return { avgActiveBurn, todayActive, daysWithData };
  };

  const healthData = calculate7DayActiveBurn();

  // Mifflin-St Jeor Calorie Math with Movement Trends
  const calculateSuggestedCalories = () => {
    const age = userData?.age || 25;
    const currentWeight = userData?.weight || initialWeight;
    const height = userData?.height || (profileId === 'him' ? 70 : 64);

    let weightKg = currentWeight;
    let heightCm = height;

    if (weightUnit === 'lbs') {
      weightKg = lbsToKg(currentWeight);
      heightCm = inToCm(height);
    }

    // BMR formula
    let bmr = 0;
    if (profileId === 'him') {
      bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
    } else {
      bmr = 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
    }

    // Dynamic TDEE estimation based on chosen movement basis
    let tdee = 0;
    if (movementBasis === '7day') {
      const activeBurn = healthData.avgActiveBurn > 0 ? healthData.avgActiveBurn : Math.round(bmr * 0.375);
      tdee = bmr + activeBurn;
    } else if (movementBasis === 'today') {
      const activeBurn = healthData.todayActive > 0 ? healthData.todayActive : Math.round(bmr * 0.375);
      tdee = bmr + activeBurn;
    } else {
      tdee = bmr * parseFloat(activityLevel);
    }

    // Pace deficit/surplus (1 lb = ~3500 kcal, so 1 kg = ~7700 kcal)
    const factor = weightUnit === 'lbs' ? 500 : 1100;
    const offset = sliderPace * factor; // pace is negative for loss, positive for gain
    
    let suggestedDaily = Math.round(tdee + offset);

    // Apply safety caps
    const safetyFloor = profileId === 'him' ? 1500 : 1200;
    if (suggestedDaily < safetyFloor) {
      suggestedDaily = safetyFloor;
    }

    return {
      bmr: Math.round(bmr),
      tdee: Math.round(tdee),
      suggestedDaily,
      suggestedWeekly: suggestedDaily * 7
    };
  };

  const calcs = calculateSuggestedCalories();

  const handleLogWeight = async (e) => {
    e.preventDefault();
    if (!newWeight || parseFloat(newWeight) <= 0) return;

    setLoading(true);
    setSuccess(false);

    try {
      const weightsRef = collection(db, 'couples', passcode, 'weights');
      await addDoc(weightsRef, {
        profileId,
        weight: parseFloat(newWeight),
        date: logDate,
        createdAt: serverTimestamp()
      });

      // Also update the current weight in the profile document
      const userRef = doc(db, 'couples', passcode, 'users', profileId);
      await updateDoc(userRef, {
        weight: parseFloat(newWeight)
      });

      setNewWeight('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      console.error("Error logging weight:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWeight = async (id) => {
    if (!window.confirm("Are you sure you want to delete this weight log?")) return;
    try {
      await deleteDoc(doc(db, 'couples', passcode, 'weights', id));
    } catch (err) {
      console.error("Error deleting weight log:", err);
    }
  };

  const handleApplyCalorieGoal = async () => {
    setCalculatorMessage('');
    try {
      const userRef = doc(db, 'couples', passcode, 'users', profileId);
      const writePromise = setDoc(userRef, {
        dailyCalorieGoal: calcs.suggestedDaily,
        targetWeight: parseFloat(sliderTargetWeight)
      }, { merge: true });
      const timeoutPromise = new Promise(resolve => setTimeout(resolve, 1000));
      await Promise.race([writePromise, timeoutPromise]);

      setCalculatorMessage('Calorie goal successfully applied to profile!');
      setTimeout(() => setCalculatorMessage(''), 3000);
    } catch (err) {
      console.error("Error updating goal:", err);
      setCalculatorMessage('Failed to apply calorie goal.');
    }
  };

  // Weight logs sorting & graphing coordinates math
  const partnerName = partnerData?.displayName || (profileId === 'him' ? 'Noor' : 'Ameen');

  const getFifteenDaysAgoDateString = () => {
    const d = new Date();
    d.setDate(d.getDate() - 15);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };
  const fifteenDaysAgoStr = getFifteenDaysAgoDateString();

  let sortedUserWeights = userWeights
    .filter(w => w.date >= fifteenDaysAgoStr)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (sortedUserWeights.length < 2) {
    sortedUserWeights = [...userWeights]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-15);
  }

  let sortedPartnerWeights = partnerWeights
    .filter(w => w.date >= fifteenDaysAgoStr)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (sortedPartnerWeights.length < 2) {
    sortedPartnerWeights = [...partnerWeights]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-15);
  }

  // Math to generate SVG coordinates
  const generateSvgPath = (logs) => {
    if (logs.length < 2) return '';
    
    // Find min and max weight logs to fit chart bounds
    const weights = logs.map(l => l.weight);
    const minW = Math.min(...weights) - 5;
    const maxW = Math.max(...weights) + 5;
    const diffW = maxW - minW || 1;

    const width = 320;
    const height = 140;
    const padding = 20;

    const points = logs.map((log, index) => {
      const x = padding + (index / (logs.length - 1)) * (width - 2 * padding);
      const y = height - padding - ((log.weight - minW) / diffW) * (height - 2 * padding);
      return `${x},${y}`;
    });

    return `M ${points.join(' L ')}`;
  };

  const userPath = generateSvgPath(sortedUserWeights);
  const partnerPath = generateSvgPath(sortedPartnerWeights);

  const currentUserWeight = sortedUserWeights[sortedUserWeights.length - 1]?.weight || initialWeight;
  const currentPartnerWeight = sortedPartnerWeights[sortedPartnerWeights.length - 1]?.weight || (profileId === 'him' ? 130 : 175);

  const userPoundsLost = (initialWeight - currentUserWeight).toFixed(1);
  const partnerPoundsLost = ((partnerData?.weight || (profileId === 'him' ? 130 : 175)) - currentPartnerWeight).toFixed(1);

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      
      {/* Title block */}
      <div>
        <h2 className="text-2xl font-black text-brand-charcoal px-1">Progress Tracker</h2>
        <p className="text-xs text-brand-slate px-1 mt-1 font-medium">Track your weight goals, view trends, and plan calorie intakes.</p>
      </div>

      {/* Apple Health integration for iOS native wrapper */}
      {isNativeDevice && (
        <div className="bg-white p-5 rounded-3xl border border-neutral-100 shadow-sm space-y-3 animate-fade-in">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 bg-brand-blue-light rounded-xl flex items-center justify-center text-brand-blue shadow-xs">
              <span className="text-lg">❤️</span>
            </div>
            <h3 className="font-bold text-base text-brand-charcoal">Apple Health Integration</h3>
          </div>
          
          <p className="text-xs text-brand-slate leading-relaxed font-medium">
            Sync BiteSync with Apple Health to pull your daily steps and active calories automatically.
          </p>

          {healthAuthorized ? (
            <div className="p-3 bg-brand-green-light/40 border border-brand-green/20 rounded-2xl flex items-center gap-3">
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
              className="w-full py-3.5 bg-brand-blue text-white rounded-2xl font-bold hover:bg-brand-blue/90 transition-all text-xs flex items-center justify-center gap-2"
            >
              <span>Connect Apple Health</span>
            </button>
          )}
        </div>
      )}

      {/* Apple Health integration for iOS native wrapper */}
      {isNativeDevice && (
        <div className="bg-white p-5 rounded-3xl border border-neutral-100 shadow-sm space-y-3 animate-fade-in">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 bg-brand-blue-light rounded-xl flex items-center justify-center text-brand-blue shadow-xs">
              <span className="text-lg">❤️</span>
            </div>
            <h3 className="font-bold text-base text-brand-charcoal">Apple Health Integration</h3>
          </div>
          
          <p className="text-xs text-brand-slate leading-relaxed font-medium">
            Sync BiteSync with Apple Health to pull your daily steps and active calories automatically.
          </p>

          {healthAuthorized ? (
            <div className="p-3 bg-brand-green-light/40 border border-brand-green/20 rounded-2xl flex items-center gap-3">
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
              className="w-full py-3.5 bg-brand-blue text-white rounded-2xl font-bold hover:bg-brand-blue/90 transition-all text-xs flex items-center justify-center gap-2"
            >
              <span>Connect Apple Health</span>
            </button>
          )}
        </div>
      )}

      {/* Side-by-side stats */}
      <div className="grid grid-cols-2 gap-4">
        {/* User Card */}
        <div className="bg-white p-5 rounded-3xl border border-neutral-100 shadow-2xs flex flex-col items-center text-center">
          <span className="text-[10px] font-black uppercase tracking-wider text-brand-slate mb-1">You</span>
          <span className="text-2xl font-black text-brand-charcoal leading-none">
            {currentUserWeight} <span className="text-xs font-bold text-brand-slate">{weightUnit}</span>
          </span>
          <p className="text-[10px] text-brand-slate font-bold mt-2">Target: {sliderTargetWeight} {weightUnit}</p>
          <div className="mt-3.5 px-3 py-1 bg-brand-green-light text-brand-green border border-brand-green/10 rounded-full text-xs font-bold">
            {userPoundsLost >= 0 ? `${userPoundsLost} ${weightUnit} lost` : `${Math.abs(userPoundsLost)} ${weightUnit} gained`}
          </div>
        </div>

        {/* Partner Card */}
        <div className="bg-white p-5 rounded-3xl border border-neutral-100 shadow-2xs flex flex-col items-center text-center">
          <span className="text-[10px] font-black uppercase tracking-wider text-brand-slate mb-1">{partnerName}</span>
          <span className="text-2xl font-black text-brand-charcoal leading-none">
            {currentPartnerWeight} <span className="text-xs font-bold text-brand-slate">{weightUnit}</span>
          </span>
          <p className="text-[10px] text-brand-slate font-bold mt-2">Target: {partnerData?.targetWeight || '--'} {weightUnit}</p>
          <div className="mt-3.5 px-3 py-1 bg-brand-blue-light text-brand-blue border border-brand-blue/10 rounded-full text-xs font-bold">
            {partnerPoundsLost >= 0 ? `${partnerPoundsLost} ${weightUnit} lost` : `${Math.abs(partnerPoundsLost)} ${weightUnit} gained`}
          </div>
        </div>
      </div>

      {/* SVG Weight Line Chart */}
      <div className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-green-light rounded-xl flex items-center justify-center text-brand-green">
            <TrendingUp size={18} />
          </div>
          <h3 className="font-bold text-lg text-brand-charcoal">Weight Trends (Last 15 Days)</h3>
        </div>

        {sortedUserWeights.length < 2 && sortedPartnerWeights.length < 2 ? (
          <div className="h-40 flex flex-col items-center justify-center border border-dashed border-neutral-200 rounded-2xl text-xs font-bold text-neutral-400 italic bg-neutral-50 px-4 text-center">
            Log at least two weights below to map out your progress chart!
          </div>
        ) : (
          <div className="relative">
            <svg viewBox="0 0 320 140" className="w-full h-auto overflow-visible">
              {/* Background grid lines */}
              <line x1="20" y1="20" x2="300" y2="20" stroke="#f3f4f6" strokeWidth="1" strokeDasharray="4" />
              <line x1="20" y1="70" x2="300" y2="70" stroke="#f3f4f6" strokeWidth="1" strokeDasharray="4" />
              <line x1="20" y1="120" x2="300" y2="120" stroke="#f3f4f6" strokeWidth="1" strokeDasharray="4" />
              
              {/* User Line Path */}
              {userPath && (
                <path
                  d={userPath}
                  fill="none"
                  stroke="var(--color-brand-green)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Partner Line Path */}
              {partnerPath && (
                <path
                  d={partnerPath}
                  fill="none"
                  stroke="var(--color-brand-blue)"
                  strokeWidth="3.5"
                  strokeDasharray="4 4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </svg>
            <div className="flex items-center justify-between text-[10px] font-bold text-brand-slate mt-2 px-1">
              <span>Oldest log</span>
              <div className="flex items-center gap-4 bg-neutral-50 py-1 px-3 border border-neutral-100 rounded-full">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-1 bg-brand-green rounded-sm" />You (Solid)</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-1 border-b-2 border-dashed border-brand-blue" />{partnerName} (Dashed)</span>
              </div>
              <span>Newest log</span>
            </div>
          </div>
        )}
      </div>

      {/* Suggested Calories Slider Board */}
      <div className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm space-y-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-rose-light rounded-xl flex items-center justify-center text-brand-rose">
            <Activity size={18} />
          </div>
          <h3 className="font-bold text-lg text-brand-charcoal">Suggested Calorie Goal</h3>
        </div>

        {calculatorMessage && (
          <div className="p-3 bg-brand-green-light border border-brand-green/20 text-brand-green rounded-2xl text-xs font-bold flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>{calculatorMessage}</span>
          </div>
        )}

        <div className="space-y-5">
          {/* Target Weight Slider */}
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-brand-slate uppercase tracking-wider mb-2">
              <span>Target Weight</span>
              <span className="text-brand-charcoal font-black">{sliderTargetWeight} {weightUnit}</span>
            </div>
            <input
              type="range"
              min={Math.round(initialWeight - 40)}
              max={Math.round(initialWeight + 30)}
              step="1"
              value={sliderTargetWeight}
              onChange={(e) => setSliderTargetWeight(parseInt(e.target.value, 10))}
              className="w-full h-1.5 bg-neutral-100 rounded-lg appearance-none cursor-pointer accent-brand-rose"
            />
          </div>

          {/* Pace Deficit/Surplus Slider */}
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-brand-slate uppercase tracking-wider mb-2">
              <span>Weekly Rate of Change</span>
              <span className="text-brand-charcoal font-black">
                {sliderPace === 0 
                  ? 'Maintain Weight' 
                  : sliderPace < 0 
                    ? `Lose ${Math.abs(sliderPace)} ${weightUnit}/wk` 
                    : `Gain ${sliderPace} ${weightUnit}/wk`}
              </span>
            </div>
            <input
              type="range"
              min="-2.0"
              max="2.0"
              step="0.25"
              value={sliderPace}
              onChange={(e) => setSliderPace(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-neutral-100 rounded-lg appearance-none cursor-pointer accent-brand-rose"
            />
          </div>

          {/* Movement Source Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-brand-slate mb-2">
              Movement Basis
            </label>
            <div className="grid grid-cols-3 gap-2 p-1 bg-neutral-100/70 rounded-2xl border border-neutral-200/50">
              <button
                type="button"
                onClick={() => setMovementBasis('7day')}
                className={`py-2 px-1 text-center rounded-xl font-bold text-[11px] transition-all ${
                  movementBasis === '7day'
                    ? 'bg-white text-brand-charcoal shadow-2xs'
                    : 'text-brand-slate hover:text-brand-charcoal'
                }`}
              >
                📊 7-Day Trend
              </button>
              <button
                type="button"
                onClick={() => setMovementBasis('today')}
                className={`py-2 px-1 text-center rounded-xl font-bold text-[11px] transition-all ${
                  movementBasis === 'today'
                    ? 'bg-white text-brand-charcoal shadow-2xs'
                    : 'text-brand-slate hover:text-brand-charcoal'
                }`}
              >
                🔥 Today's Burn
              </button>
              <button
                type="button"
                onClick={() => setMovementBasis('estimate')}
                className={`py-2 px-1 text-center rounded-xl font-bold text-[11px] transition-all ${
                  movementBasis === 'estimate'
                    ? 'bg-white text-brand-charcoal shadow-2xs'
                    : 'text-brand-slate hover:text-brand-charcoal'
                }`}
              >
                ⚙️ Estimate
              </button>
            </div>

            {movementBasis === '7day' && (
              <p className="text-[10px] font-semibold text-brand-green mt-1.5 px-1 flex items-center gap-1">
                <span>✓ Based on 7-day Apple Health average:</span>
                <span className="font-bold">+{healthData.avgActiveBurn} kcal/day active burn</span>
              </p>
            )}

            {movementBasis === 'today' && (
              <p className="text-[10px] font-semibold text-brand-blue mt-1.5 px-1 flex items-center gap-1">
                <span>✓ Based on today's Apple Health active burn:</span>
                <span className="font-bold">+{healthData.todayActive} kcal active burn</span>
              </p>
            )}

            {movementBasis === 'estimate' && (
              <div className="mt-2">
                <select
                  value={activityLevel}
                  onChange={(e) => setActivityLevel(parseFloat(e.target.value))}
                  className="w-full px-4 py-2.5 bg-neutral-50 rounded-2xl border border-neutral-200 text-brand-charcoal font-bold focus:outline-none focus:border-brand-rose focus:bg-white transition-all text-xs appearance-none cursor-pointer"
                >
                  <option value="1.2">Sedentary (Little to no exercise)</option>
                  <option value="1.375">Lightly Active (1-3 days/wk light workouts)</option>
                  <option value="1.55">Moderately Active (3-5 days/wk moderate exercises)</option>
                  <option value="1.725">Very Active (6-7 days/wk hard workouts)</option>
                </select>
              </div>
            )}
          </div>

          {/* Calorie recommendation display */}
          <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/60 grid grid-cols-2 gap-4">
            <div className="border-r border-neutral-200/80 pr-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-brand-slate">Suggested Calories</span>
              <p className="text-xl font-black text-brand-charcoal mt-1">
                {calcs.suggestedDaily} <span className="text-xs font-bold text-brand-slate">kcal / day</span>
              </p>
              {calcs.suggestedDaily === (profileId === 'him' ? 1500 : 1200) && (
                <p className="text-[9px] text-brand-rose font-bold mt-1 leading-normal italic">
                  *Safety limit floor applied
                </p>
              )}
            </div>
            <div className="pl-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-brand-slate">Weekly Budget</span>
              <p className="text-xl font-black text-brand-charcoal mt-1">
                {calcs.suggestedWeekly} <span className="text-xs font-bold text-brand-slate">kcal / wk</span>
              </p>
              <p className="text-[9px] text-brand-slate font-bold mt-1">TDEE: ~{calcs.tdee} kcal/day</p>
            </div>
          </div>

          <button
            onClick={handleApplyCalorieGoal}
            className="w-full py-3.5 bg-brand-charcoal text-white rounded-2xl font-bold hover:bg-brand-charcoal/90 transition-all text-sm flex items-center justify-center gap-2 mt-2 shadow-xs"
          >
            Apply Goal to Profile
          </button>
        </div>
      </div>

      {/* Log weight Form */}
      <div className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-neutral-100 rounded-xl flex items-center justify-center text-brand-charcoal">
            <Scale size={18} />
          </div>
          <h3 className="font-bold text-lg text-brand-charcoal font-sans">Log Weight Today</h3>
        </div>

        <form onSubmit={handleLogWeight} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-slate mb-1">Weight ({weightUnit})</label>
              <input
                type="number"
                required
                step="0.1"
                min="30"
                max="600"
                placeholder={`e.g. 150.5`}
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value)}
                className="w-full px-4 py-3 bg-neutral-50 rounded-2xl border border-neutral-200 text-brand-charcoal font-semibold text-sm placeholder-neutral-400 focus:outline-none focus:border-brand-green focus:bg-white transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-slate mb-1">Date</label>
              <input
                type="date"
                required
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
                className="w-full px-4 py-3 bg-neutral-50 rounded-2xl border border-neutral-200 text-brand-charcoal font-bold text-sm focus:outline-none focus:border-brand-green focus:bg-white transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3.5 rounded-2xl font-bold transition-all text-sm flex items-center justify-center gap-2 ${
              success 
                ? 'bg-brand-green text-white shadow-md' 
                : 'bg-brand-charcoal hover:bg-brand-charcoal/90 text-white shadow-md active:scale-[0.98] cursor-pointer'
            }`}
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : success ? (
              'Weight Logged Successfully!'
            ) : (
              <>
                <PlusCircle size={18} />
                Add Weight Log
              </>
            )}
          </button>
        </form>
      </div>

      {/* Weight History List */}
      <div className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm space-y-4">
        <h3 className="font-bold text-lg text-brand-charcoal">Weight History</h3>
        
        {sortedUserWeights.length === 0 ? (
          <p className="text-xs text-neutral-400 font-medium italic">No weight entries logged yet.</p>
        ) : (
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {[...sortedUserWeights].reverse().map(log => (
              <div key={log.id} className="flex items-center justify-between py-2 border-b border-neutral-100 text-sm">
                <div className="flex items-center gap-2 text-brand-slate">
                  <ChevronRight size={14} />
                  <span>{log.date}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-black text-brand-charcoal">{log.weight} {weightUnit}</span>
                  <button 
                    onClick={() => handleDeleteWeight(log.id)}
                    className="text-brand-rose hover:text-red-600 transition-colors p-1"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
