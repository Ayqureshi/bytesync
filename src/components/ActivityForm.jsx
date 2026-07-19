import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { PlusCircle, Activity } from 'lucide-react';

export default function ActivityForm({ passcode, profileId, onActivityAdded }) {
  const [description, setDescription] = useState('');
  
  const getTodayString = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const [date, setDate] = useState(getTodayString());
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description.trim()) return;

    setLoading(true);
    setSuccess(false);

    try {
      const activitiesRef = collection(db, 'couples', passcode, 'activities');
      await addDoc(activitiesRef, {
        profileId,
        description: description.trim(),
        date,
        createdAt: serverTimestamp()
      });

      setDescription('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);

      if (onActivityAdded) {
        onActivityAdded(date);
      }
    } catch (error) {
      console.error("Error logging activity:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-8 sm:p-10 rounded-3xl border border-neutral-100 shadow-sm">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-8 h-8 bg-brand-blue-light rounded-xl flex items-center justify-center text-brand-blue">
          <Activity size={18} />
        </div>
        <h3 className="font-bold text-lg text-brand-charcoal">Log Activity</h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-brand-slate mb-2">
            What did you do today?
          </label>
          <input
            type="text"
            required
            placeholder="e.g. 30 min Yoga, Ran 5km, Pilates"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-5 py-3.5 bg-neutral-50 rounded-2xl border border-neutral-200 text-brand-charcoal font-medium placeholder-neutral-400 focus:outline-none focus:border-brand-blue focus:bg-white transition-all text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-brand-slate mb-2">
            Date
          </label>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-5 py-3.5 bg-neutral-50 rounded-2xl border border-neutral-200 text-brand-charcoal font-bold focus:outline-none focus:border-brand-blue focus:bg-white transition-all text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-4 rounded-2xl font-bold transition-all text-sm flex items-center justify-center gap-2 mt-4 ${
            success 
              ? 'bg-brand-blue text-white shadow-md' 
              : 'bg-brand-charcoal hover:bg-brand-charcoal/90 text-white shadow-md active:scale-[0.98]'
          }`}
        >
          {loading ? (
            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : success ? (
            'Logged Successfully!'
          ) : (
            <>
              <PlusCircle size={18} />
              Add Activity
            </>
          )}
        </button>
      </form>
    </div>
  );
}
