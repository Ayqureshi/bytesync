import { useState } from 'react';
import { Trash2, Heart, Send, Utensils, Activity, Award } from 'lucide-react';

export default function History({
  userMeals = [],
  partnerMeals = [],
  userActivities = [],
  partnerActivities = [],
  userData,
  partnerData,
  onDeleteMeal,
  onDeleteActivity,
  onCommentMeal,
  onCommentActivity,
  onToggleKudos,
  currentProfileId
}) {
  // Track comment input values independently for each feed item
  const [commentInputs, setCommentInputs] = useState({});

  // Combine and de-duplicate feed items
  const combinedFeed = [
    ...userMeals.map(m => ({
      ...m,
      feedType: 'meal',
      owner: m.profileId === currentProfileId ? 'user' : 'partner',
      ownerName: m.profileId === currentProfileId ? (userData?.displayName || 'You') : (partnerData?.displayName || 'Partner')
    })),
    ...partnerMeals.map(m => ({
      ...m,
      feedType: 'meal',
      owner: m.profileId === currentProfileId ? 'user' : 'partner',
      ownerName: m.profileId === currentProfileId ? (userData?.displayName || 'You') : (partnerData?.displayName || 'Partner')
    })),
    ...userActivities.map(a => ({
      ...a,
      feedType: 'activity',
      owner: a.profileId === currentProfileId ? 'user' : 'partner',
      ownerName: a.profileId === currentProfileId ? (userData?.displayName || 'You') : (partnerData?.displayName || 'Partner')
    })),
    ...partnerActivities.map(a => ({
      ...a,
      feedType: 'activity',
      owner: a.profileId === currentProfileId ? 'user' : 'partner',
      ownerName: a.profileId === currentProfileId ? (userData?.displayName || 'You') : (partnerData?.displayName || 'Partner')
    }))
  ];

  // De-duplicate items by id
  const uniqueFeed = [];
  const seenIds = new Set();
  combinedFeed.forEach(item => {
    if (!seenIds.has(item.id)) {
      seenIds.add(item.id);
      uniqueFeed.push(item);
    }
  });

  const getTimestamp = (item) => {
    if (item.createdAt) {
      if (item.createdAt.toMillis) return item.createdAt.toMillis();
      if (item.createdAt.seconds) return item.createdAt.seconds * 1000;
      if (typeof item.createdAt === 'number') return item.createdAt;
    }
    if (item.date) {
      const parsed = Date.parse(item.date);
      if (!isNaN(parsed)) return parsed;
    }
    return 0;
  };

  // Sort chronologically descending (latest first)
  uniqueFeed.sort((a, b) => getTimestamp(b) - getTimestamp(a));

  const formatItemDate = (dateStr, createdAt) => {
    if (!dateStr) return '';
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const getFormatted = (d) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    const todayStr = getFormatted(today);
    const yesterdayStr = getFormatted(yesterday);

    let displayDay;
    if (dateStr === todayStr) {
      displayDay = "Today";
    } else if (dateStr === yesterdayStr) {
      displayDay = "Yesterday";
    } else {
      const parsed = new Date(dateStr + 'T12:00:00');
      displayDay = parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    if (createdAt) {
      const ms = createdAt.toMillis ? createdAt.toMillis() : (createdAt.seconds ? createdAt.seconds * 1000 : null);
      if (ms) {
        const timeStr = new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        return `${displayDay} at ${timeStr}`;
      }
    }
    return displayDay;
  };

  const handleSendComment = (e, item) => {
    e.preventDefault();
    const commentText = commentInputs[item.id] || '';
    if (!commentText.trim()) return;

    if (item.feedType === 'meal' && onCommentMeal) {
      onCommentMeal(item.id, commentText);
    } else if (item.feedType === 'activity' && onCommentActivity) {
      onCommentActivity(item.id, commentText);
    }
    setCommentInputs(prev => ({ ...prev, [item.id]: '' }));
  };

  const partnerDisplayName = partnerData?.displayName || 'Partner';

  return (
    <div className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h3 className="font-black text-xl text-brand-charcoal">BiteSync Feed</h3>
        <span className="text-xs bg-neutral-100 text-brand-slate font-bold px-3 py-1.5 rounded-full border border-neutral-100/60">
          Last 30 Days
        </span>
      </div>

      <div className="space-y-6">
        {uniqueFeed.length === 0 ? (
          <div className="text-center py-12 px-4 bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
            <span className="mx-auto text-4xl mb-3 block animate-bounce">✨</span>
            <p className="text-sm font-bold text-brand-slate">Your shared feed is empty.</p>
            <p className="text-xs text-neutral-400 mt-1">Start logging meals and workouts to populate the feed!</p>
          </div>
        ) : (
          uniqueFeed.map((item) => {
            const isMeal = item.feedType === 'meal';
            const isMe = item.profileId === currentProfileId;
            const itemDateFormatted = formatItemDate(item.date, item.createdAt);
            const kudosList = item.kudos || [];
            const hasMyKudos = kudosList.includes(currentProfileId);
            const hasPartnerKudos = kudosList.includes(currentProfileId === 'him' ? 'her' : 'him');

            return (
              <div 
                key={item.id} 
                className={`p-5 rounded-[28px] border flex flex-col transition-all duration-200 ${
                  isMe 
                    ? 'bg-white border-neutral-150 shadow-xs hover:border-neutral-200' 
                    : isMeal
                      ? 'bg-brand-green-light/20 border-brand-green/10'
                      : 'bg-brand-blue-light/25 border-brand-blue/15'
                }`}
              >
                {/* Header row: Owner metadata & timestamp */}
                <div className="flex items-center justify-between mb-3.5 pb-2 border-b border-neutral-105">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-black uppercase tracking-wider ${
                      isMe 
                        ? 'bg-neutral-100 text-brand-charcoal'
                        : isMeal
                          ? 'bg-brand-green text-white'
                          : 'bg-brand-blue text-white'
                    }`}>
                      {item.ownerName}
                    </span>
                    <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">
                      {isMeal ? 'logged food' : 'logged workout'}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-brand-slate">
                    {itemDateFormatted}
                  </span>
                </div>

                {/* Content row */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold ${
                      isMeal 
                        ? 'bg-brand-green-light text-brand-green' 
                        : 'bg-brand-blue-light text-brand-blue'
                    }`}>
                      {isMeal ? <Utensils size={18} /> : <Activity size={18} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-sm text-brand-charcoal">
                          {isMeal ? item.name : item.description}
                        </span>
                      </div>
                      <span className="text-xs text-brand-slate font-medium">
                        {isMeal 
                          ? `${item.type} • ${item.calories} kcal` 
                          : 'Physical Activity / Exercise'}
                      </span>
                    </div>
                  </div>

                  {isMe ? (
                    <button
                      onClick={() => isMeal ? onDeleteMeal(item.id, item.date) : onDeleteActivity(item.id)}
                      className="p-2 text-neutral-400 hover:text-brand-rose hover:bg-brand-rose-light/50 rounded-xl transition-all active:scale-95"
                    >
                      <Trash2 size={16} />
                    </button>
                  ) : null}
                </div>

                {/* Kudos Cheer Bar */}
                <div className="mt-4 pt-3.5 border-t border-neutral-100 flex flex-wrap items-center justify-between gap-2">
                  <button
                    onClick={() => onToggleKudos(isMeal ? 'meals' : 'activities', item.id, hasMyKudos)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                      hasMyKudos
                        ? 'bg-amber-100 text-amber-600 shadow-3xs'
                        : 'bg-neutral-50 hover:bg-neutral-100 text-brand-slate'
                    }`}
                  >
                    <Heart size={14} className={hasMyKudos ? "fill-current animate-pulse text-amber-500" : ""} />
                    <span>{hasMyKudos ? "Kudos sent! ✨" : "Give Kudos"}</span>
                  </button>

                  <div className="text-[10px] text-brand-slate font-bold flex items-center gap-1">
                    {kudosList.length > 0 && (
                      <span className="flex items-center gap-1 bg-amber-50 text-amber-600 py-0.5 px-2 rounded-md border border-amber-100/40">
                        <Award size={10} className="fill-current text-amber-500" />
                        {hasMyKudos && hasPartnerKudos 
                          ? "You both cheered! ❤️" 
                          : hasMyKudos 
                            ? "You cheered! 💖" 
                            : `${partnerDisplayName} cheered! 🎉`}
                      </span>
                    )}
                  </div>
                </div>

                {/* Comments Section */}
                <div className="mt-3.5 pt-3.5 border-t border-neutral-100 space-y-3">
                  {/* List existing comments */}
                  {item.comments && item.comments.length > 0 && (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {item.comments.map((comment) => {
                        const commentIsMe = comment.senderProfileId === currentProfileId;
                        return (
                          <div key={comment.id} className="flex flex-col text-xs">
                            <span className={`text-[9px] font-bold text-brand-slate mb-0.5 ${commentIsMe ? 'text-right' : 'text-left'}`}>
                              {comment.senderName}
                            </span>
                            <div className={`p-2.5 rounded-2xl font-medium leading-relaxed max-w-[85%] break-words ${
                              commentIsMe 
                                ? 'bg-neutral-100 text-brand-charcoal rounded-tr-none ml-auto' 
                                : 'bg-white text-brand-charcoal rounded-tl-none border border-neutral-100 shadow-3xs'
                            }`}>
                              {comment.text}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add comment form */}
                  <form onSubmit={(e) => handleSendComment(e, item)} className="flex items-center gap-2 mt-2">
                    <input
                      type="text"
                      value={commentInputs[item.id] || ''}
                      onChange={(e) => setCommentInputs(prev => ({ ...prev, [item.id]: e.target.value }))}
                      placeholder={!isMe ? `Send a sweet note to ${item.ownerName}...` : "Write a note..."}
                      className="flex-1 px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-2xl text-xs font-semibold placeholder-neutral-400 focus:outline-none focus:border-brand-green focus:bg-white transition-all"
                    />
                    <button
                      type="submit"
                      disabled={!(commentInputs[item.id] || '').trim()}
                      className="p-2.5 bg-brand-charcoal text-white rounded-xl hover:bg-brand-charcoal/90 disabled:opacity-40 disabled:hover:bg-brand-charcoal transition-all active:scale-95 shrink-0"
                    >
                      <Send size={12} />
                    </button>
                  </form>
                </div>

              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
