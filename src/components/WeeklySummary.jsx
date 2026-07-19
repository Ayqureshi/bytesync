import { Calendar } from 'lucide-react';

export default function WeeklySummary({
  userSummaries,
  partnerSummaries,
  userGoal,
  partnerGoal,
  userData,
  partnerData
}) {
  const defaultPartnerName = userData?.uid === 'him' ? 'Noor' : 'Ameen';
  const partnerName = partnerData?.displayName || defaultPartnerName;

  // Generate the last 7 calendar days
  const getPast7Days = () => {
    const list = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });
      const dateLabel = d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
      list.push({ dateStr, dayLabel, dateLabel });
    }
    return list;
  };

  const days = getPast7Days();

  // Find max calories to scale the graph heights appropriately (minimum scale 2000)
  let maxVal = 2000;
  days.forEach(({ dateStr }) => {
    const userVal = userSummaries[dateStr]?.caloriesConsumed || 0;
    const partnerVal = partnerSummaries ? (partnerSummaries[dateStr]?.caloriesConsumed || 0) : 0;
    if (userVal > maxVal) maxVal = userVal;
    if (partnerVal > maxVal) maxVal = partnerVal;
  });

  return (
    <div className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 bg-neutral-100 rounded-xl flex items-center justify-center text-brand-charcoal">
          <Calendar size={18} />
        </div>
        <h3 className="font-bold text-lg text-brand-charcoal">Weekly Summary</h3>
      </div>

      {/* Side-by-side chart */}
      <div className="space-y-6">
        <div className="h-48 flex items-end justify-between gap-1 pt-6 px-2 border-b border-neutral-100">
          {days.map(({ dateStr, dayLabel, dateLabel }) => {
            const userVal = userSummaries[dateStr]?.caloriesConsumed || 0;
            const uGoal = userSummaries[dateStr]?.goal || userGoal || 2000;
            const userMet = userVal <= uGoal;
            
            const partnerVal = partnerSummaries ? (partnerSummaries[dateStr]?.caloriesConsumed || 0) : 0;
            const pGoal = partnerSummaries ? (partnerSummaries[dateStr]?.goal || partnerGoal || 2000) : 2000;
            const partnerMet = partnerVal <= pGoal;

            // Calculate heights in percentages based on maxVal (max height 75% to leave room for labels at top)
            const userHeight = Math.max(5, (userVal / maxVal) * 75);
            const partnerHeight = Math.max(5, (partnerVal / maxVal) * 75);

            return (
              <div key={dateStr} className="flex-1 flex flex-col items-center group h-full justify-end">
                <div className="flex items-end gap-1.5 w-full justify-center px-1 h-full">
                  {/* User Bar */}
                  <div className="flex-1 flex flex-col items-center justify-end h-full relative">
                    {userVal > 0 && (
                      <span className="absolute bottom-full mb-1 text-[8px] font-extrabold text-brand-slate leading-none">
                        {userVal}
                      </span>
                    )}
                    <div
                      style={{ height: `${userHeight}%` }}
                      className={`w-3.5 rounded-t-md transition-all duration-500 ${
                        userVal === 0 
                          ? 'bg-neutral-100' 
                          : userMet 
                            ? 'bg-brand-green' 
                            : 'bg-brand-rose'
                      }`}
                    />
                  </div>

                  {/* Partner Bar (Only show if linked) */}
                  {partnerSummaries && (
                    <div className="flex-1 flex flex-col items-center justify-end h-full relative">
                      {partnerVal > 0 && (
                        <span className="absolute bottom-full mb-1 text-[8px] font-extrabold text-brand-slate/80 leading-none">
                          {partnerVal}
                        </span>
                      )}
                      <div
                        style={{ height: `${partnerHeight}%` }}
                        className={`w-3.5 rounded-t-md transition-all duration-500 ${
                          partnerVal === 0 
                            ? 'bg-neutral-100' 
                            : partnerMet 
                              ? 'bg-striped-green' 
                              : 'bg-striped-rose'
                        }`}
                      />
                    </div>
                  )}
                </div>

                {/* Day label */}
                <span className="text-[10px] font-bold text-brand-charcoal mt-2">{dayLabel}</span>
                <span className="text-[9px] text-brand-slate font-medium">{dateLabel}</span>
              </div>
            );
          })}
        </div>

        {/* Legend & Details */}
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs font-semibold text-brand-slate px-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-brand-green rounded-sm" />
              <span>Met Goal</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-brand-rose rounded-sm" />
              <span>Over Goal</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-neutral-100 rounded-sm" />
              <span>No Logs</span>
            </div>
          </div>

          {partnerSummaries && (
            <div className="flex items-center gap-3 bg-neutral-50 px-3 py-1.5 rounded-xl border border-neutral-100 text-[10px] font-bold">
              <span className="text-brand-charcoal">{userData?.displayName || 'You'} (Solid)</span>
              <span className="text-neutral-400">|</span>
              <span className="text-brand-blue">{partnerName} (Striped)</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
