import { Flame, Activity, Sparkles } from 'lucide-react';
import { calculateStreak } from '../utils';

// Reusable Circular Progress Meter
function CalorieMeter({ consumed, goal, label, color, bgImage, steps = 0, activeBurn = 0 }) {
  const pct = Math.min(100, goal > 0 ? (consumed / goal) * 100 : 0);
  const radius = 46;
  const strokeWidth = 8;
  const circ = 2 * Math.PI * radius;
  const strokeDashoffset = circ - (pct / 100) * circ;
  const netCalories = consumed - activeBurn;
  const remaining = goal - netCalories;
  const isOver = netCalories > goal;

  return (
    <div
      style={bgImage ? {
        backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.94), rgba(255, 255, 255, 0.94)), url(${bgImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      } : {}}
      className="bg-white p-4 rounded-3xl border border-neutral-100 shadow-2xs flex flex-col items-center w-full max-w-[195px] mx-auto transition-all hover:shadow-xs relative overflow-hidden"
    >
      <span className="text-xs font-black uppercase tracking-wider text-brand-slate mb-3">{label}</span>
      
      <div className="relative w-28 h-28 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 112 112">
          {/* Background circle */}
          <circle
            cx="56"
            cy="56"
            r={radius}
            stroke="#f3f4f6"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Active progress circle */}
          <circle
            cx="56"
            cy="56"
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circ}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-500 ease-out"
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-xl font-black text-brand-charcoal leading-none">{consumed}</span>
          <span className="text-[9px] text-brand-slate font-bold uppercase tracking-wider mt-0.5">/ {goal} kcal</span>
        </div>
      </div>

      {/* Energy Balance Stats */}
      {(steps > 0 || activeBurn > 0) && (
        <div className="mt-3.5 w-full border-t border-neutral-100/60 pt-2.5 space-y-1">
          {steps > 0 && (
            <div className="flex items-center justify-between text-[10px] font-bold text-brand-slate">
              <span>👣 Steps</span>
              <span className="text-brand-charcoal">{steps.toLocaleString()}</span>
            </div>
          )}
          {activeBurn > 0 && (
            <div className="flex items-center justify-between text-[10px] font-bold text-brand-slate">
              <span>🔥 Burn</span>
              <span className="text-brand-charcoal">-{activeBurn} kcal</span>
            </div>
          )}
          <div className="flex items-center justify-between text-[10px] font-black text-brand-slate border-t border-dashed border-neutral-100 pt-1 mt-1">
            <span>Net</span>
            <span className="text-brand-charcoal">{netCalories} kcal</span>
          </div>
        </div>
      )}

      <div className="mt-4 w-full">
        {isOver ? (
          <div className="py-1 px-2.5 bg-brand-rose-light text-brand-rose rounded-xl text-center text-[10px] font-bold border border-brand-rose/10">
            {Math.abs(remaining)} kcal over
          </div>
        ) : (
          <div className="py-1 px-2.5 bg-brand-green-light text-brand-green rounded-xl text-center text-[10px] font-bold border border-brand-green/10">
            {remaining} kcal left
          </div>
        )}
      </div>
    </div>
  );
}

export default function Dashboard({
  userData,
  partnerData,
  userMeals = [],
  partnerMeals = [],
  userActivities = [],
  partnerActivities = [],
  userTodayMeals = [],
  partnerTodayMeals = [],
  userTodayActivities = [],
  partnerTodayActivities = [],
  userSummaries = {},
  partnerSummaries = {}
}) {
  // Sum today's calories
  const userTodayCalories = userTodayMeals.reduce((sum, m) => sum + m.calories, 0);
  const partnerTodayCalories = partnerTodayMeals.reduce((sum, m) => sum + m.calories, 0);

  const defaultPartnerName = userData?.uid === 'him' ? 'Noor' : 'Ameen';
  const partnerName = partnerData?.displayName || defaultPartnerName;

  const userPhoto = userData?.uid === 'him' 
    ? '/photos/IMG_3847.jpeg' 
    : '/photos/IMG_8249.jpeg';

  const partnerPhoto = userData?.uid === 'him'
    ? '/photos/IMG_8249.jpeg' 
    : '/photos/IMG_3847.jpeg';

  // Calculate dynamic streak based on 30-day updates
  const streakDetails = calculateStreak(
    userMeals,
    partnerMeals,
    userActivities,
    partnerActivities
  );

  const userHasLoggedToday = userTodayMeals.length > 0 || userTodayActivities.length > 0;
  const partnerHasLoggedToday = partnerTodayMeals.length > 0 || partnerTodayActivities.length > 0;

  let streakMessage;
  if (streakDetails.streakCount > 0) {
    if (userHasLoggedToday && partnerHasLoggedToday) {
      streakMessage = "Both of you updated today! The shared streak is burning hot! 🔥";
    } else {
      streakMessage = "Streak is active! Keep it burning by logging an update today. ⚡";
    }
  } else {
    // Streak is 0
    if (streakDetails.hasUserUpdatedIn24h && !streakDetails.hasPartnerUpdatedIn24h) {
      streakMessage = `${partnerName} hasn't logged anything in the last 24 hours. Encourage them to log an update to start the streak! 🙌`;
    } else if (streakDetails.hasPartnerUpdatedIn24h && !streakDetails.hasUserUpdatedIn24h) {
      streakMessage = "You haven't logged anything in the last 24 hours. Log a meal or activity to start the streak! 💪";
    } else {
      streakMessage = "Neither of you has logged anything in the last 24 hours. Start logging to begin your streak! 🔥";
    }
  }

  const getTodayDateString = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };
  const todayStr = getTodayDateString();

  const userTodaySummary = userSummaries?.[todayStr] || {};
  const partnerTodaySummary = partnerSummaries?.[todayStr] || {};

  const userSteps = userTodaySummary.steps || 0;
  const userActiveEnergy = userTodaySummary.activeCaloriesBurned || 0;

  const partnerSteps = partnerTodaySummary.steps || 0;
  const partnerActiveEnergy = partnerTodaySummary.activeCaloriesBurned || 0;

  return (
    <div className="space-y-6">
      
      {/* Dynamic Streak Board */}
      <div className={`p-6 rounded-3xl border transition-all duration-300 flex items-center justify-between shadow-xs ${
        streakDetails.streakCount > 0 
          ? 'bg-gradient-to-r from-[#fffbeb] to-[#fff7ed] border-brand-gold/20' 
          : 'bg-white border-neutral-100'
      }`}>
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-md transition-transform duration-300 active:scale-95 ${
            streakDetails.streakCount > 0 
              ? 'bg-brand-gold text-brand-charcoal animate-bounce' 
              : 'bg-neutral-100 text-neutral-400'
          }`}>
            <Flame size={28} className="fill-current" />
          </div>
          <div>
            <h2 className="text-xl font-black text-brand-charcoal leading-none">
              {streakDetails.streakCount} Day Streak
            </h2>
            <p className="text-xs text-brand-slate font-medium mt-1.5 leading-relaxed">
              {streakMessage}
            </p>
          </div>
        </div>
        
        {streakDetails.streakCount > 0 && (
          <div className="flex items-center text-brand-gold text-amber-500 animate-pulse">
            <Sparkles size={20} />
          </div>
        )}
      </div>

      {/* Calories Dashboard Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-28 gap-x-12 pt-24 pb-20 px-10">
        {/* Active User Meter wrapper */}
        <div className="relative w-[195px] mx-auto">
          {/* Polaroid 1 (bottom layer) - Bottom Left */}
          <div 
            style={{ transform: 'rotate(14deg)' }}
            className="absolute -bottom-8 -left-10 w-20 h-24 bg-white p-1 rounded-sm shadow-sm border border-neutral-200/40 z-0 pointer-events-none flex flex-col"
          >
            <div className="w-full h-16 bg-neutral-100 rounded-xs overflow-hidden">
              <img src="/photos/IMG_0313.JPG" alt="" className="w-full h-full object-cover" />
            </div>
          </div>
          {/* Polaroid 2 (second layer) - Mid Left */}
          <div 
            style={{ transform: 'rotate(-8deg)' }}
            className="absolute top-14 -left-16 w-20 h-24 bg-white p-1 rounded-sm shadow-sm border border-neutral-200/40 z-0 pointer-events-none flex flex-col"
          >
            <div className="w-full h-16 bg-neutral-100 rounded-xs overflow-hidden">
              <img src="/photos/IMG_3684.jpeg" alt="" className="w-full h-full object-cover" />
            </div>
          </div>
          {/* Polaroid 3 (third layer) - Top Left */}
          <div 
            style={{ transform: 'rotate(12deg)' }}
            className="absolute -top-12 -left-10 w-20 h-24 bg-white p-1 rounded-sm shadow-sm border border-neutral-200/40 z-0 pointer-events-none flex flex-col"
          >
            <div className="w-full h-16 bg-neutral-100 rounded-xs overflow-hidden">
              <img src="/photos/IMG_3733.jpeg" alt="" className="w-full h-full object-cover" />
            </div>
          </div>
          {/* Polaroid 4 (fourth layer) - Top Right */}
          <div 
            style={{ transform: 'rotate(-10deg)' }}
            className="absolute -top-10 -right-10 w-20 h-24 bg-white p-1 rounded-sm shadow-sm border border-neutral-200/40 z-0 pointer-events-none flex flex-col"
          >
            <div className="w-full h-16 bg-neutral-100 rounded-xs overflow-hidden">
              <img src="/photos/IMG_3774.jpeg" alt="" className="w-full h-full object-cover" />
            </div>
          </div>
          {/* Polaroid 5 (top layer) - Bottom Right */}
          <div 
            style={{ transform: 'rotate(8deg)' }}
            className="absolute -bottom-6 -right-10 w-20 h-24 bg-white p-1 rounded-sm shadow-sm border border-neutral-200/40 z-0 pointer-events-none flex flex-col"
          >
            <div className="w-full h-16 bg-neutral-100 rounded-xs overflow-hidden">
              <img src={userPhoto} alt="" className="w-full h-full object-cover" />
            </div>
          </div>
          <div className="relative z-10">
            <CalorieMeter
              consumed={userTodayCalories}
              goal={userData?.dailyCalorieGoal || 2000}
              label="You"
              color="var(--color-brand-green)"
              lightBg="var(--color-brand-green-light)"
              textColor="var(--color-brand-green)"
              bgImage={userPhoto}
              steps={userSteps}
              activeBurn={userActiveEnergy}
            />
          </div>
        </div>

        {/* Partner Meter wrapper */}
        <div className="relative w-[195px] mx-auto">
          {/* Polaroid 1 (bottom layer) - Bottom Right */}
          <div 
            style={{ transform: 'rotate(-14deg)' }}
            className="absolute -bottom-8 -right-10 w-20 h-24 bg-white p-1 rounded-sm shadow-sm border border-neutral-200/40 z-0 pointer-events-none flex flex-col"
          >
            <div className="w-full h-16 bg-neutral-100 rounded-xs overflow-hidden">
              <img src="/photos/IMG_3855.jpeg" alt="" className="w-full h-full object-cover" />
            </div>
          </div>
          {/* Polaroid 2 (second layer) - Mid Right */}
          <div 
            style={{ transform: 'rotate(8deg)' }}
            className="absolute top-14 -right-16 w-20 h-24 bg-white p-1 rounded-sm shadow-sm border border-neutral-200/40 z-0 pointer-events-none flex flex-col"
          >
            <div className="w-full h-16 bg-neutral-100 rounded-xs overflow-hidden">
              <img src="/photos/IMG_3885.jpeg" alt="" className="w-full h-full object-cover" />
            </div>
          </div>
          {/* Polaroid 3 (third layer) - Top Right */}
          <div 
            style={{ transform: 'rotate(-12deg)' }}
            className="absolute -top-12 -right-10 w-20 h-24 bg-white p-1 rounded-sm shadow-sm border border-neutral-200/40 z-0 pointer-events-none flex flex-col"
          >
            <div className="w-full h-16 bg-neutral-100 rounded-xs overflow-hidden">
              <img src="/photos/IMG_3888.jpeg" alt="" className="w-full h-full object-cover" />
            </div>
          </div>
          {/* Polaroid 4 (fourth layer) - Top Left */}
          <div 
            style={{ transform: 'rotate(10deg)' }}
            className="absolute -top-10 -left-10 w-20 h-24 bg-white p-1 rounded-sm shadow-sm border border-neutral-200/40 z-0 pointer-events-none flex flex-col"
          >
            <div className="w-full h-16 bg-neutral-100 rounded-xs overflow-hidden">
              <img src="/photos/IMG_5014.jpeg" alt="" className="w-full h-full object-cover" />
            </div>
          </div>
          {/* Polaroid 5 (top layer) - Bottom Left */}
          <div 
            style={{ transform: 'rotate(-8deg)' }}
            className="absolute -bottom-6 -left-10 w-20 h-24 bg-white p-1 rounded-sm shadow-sm border border-neutral-200/40 z-0 pointer-events-none flex flex-col"
          >
            <div className="w-full h-16 bg-neutral-100 rounded-xs overflow-hidden">
              <img src={partnerPhoto} alt="" className="w-full h-full object-cover" />
            </div>
          </div>
          <div className="relative z-10">
            <CalorieMeter
              consumed={partnerTodayCalories}
              goal={partnerData?.dailyCalorieGoal || 2000}
              label={partnerName}
              color="var(--color-brand-green)"
              lightBg="var(--color-brand-green-light)"
              textColor="var(--color-brand-green)"
              bgImage={partnerPhoto}
              steps={partnerSteps}
              activeBurn={partnerActiveEnergy}
            />
          </div>
        </div>
      </div>

      {/* Today's Workout Summary */}
      <div className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-brand-blue-light rounded-xl flex items-center justify-center text-brand-blue">
            <Activity size={18} />
          </div>
          <h3 className="font-bold text-lg text-brand-charcoal">Today's Workouts</h3>
        </div>

        <div className="space-y-4">
          {/* User Workouts */}
          <div className="pb-3 border-b border-neutral-100">
            <span className="text-xs font-bold text-brand-slate uppercase tracking-wider">
              {userData?.displayName || 'You'}
            </span>
            <div className="mt-1.5 space-y-1">
              {userTodayActivities.length === 0 ? (
                <p className="text-xs text-neutral-400 font-medium italic">No workouts logged today.</p>
              ) : (
                userTodayActivities.map(act => (
                  <p key={act.id} className="text-sm font-semibold text-brand-charcoal flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-blue" />
                    {act.description}
                  </p>
                ))
              )}
            </div>
          </div>

          {/* Partner Workouts */}
          <div>
            <span className="text-xs font-bold text-brand-slate uppercase tracking-wider">
              {partnerName}
            </span>
            <div className="mt-1.5 space-y-1">
              {partnerTodayActivities.length === 0 ? (
                <p className="text-xs text-neutral-400 font-medium italic">No workouts logged today.</p>
              ) : (
                partnerTodayActivities.map(act => (
                  <p key={act.id} className="text-sm font-semibold text-brand-charcoal flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-blue/60" />
                    {act.description}
                  </p>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
