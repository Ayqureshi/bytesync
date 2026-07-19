import { useState, useEffect } from 'react';
import { doc, onSnapshot, collection, query, where, deleteDoc, setDoc, arrayUnion, arrayRemove, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { syncDailySummary } from './utils';
import { Capacitor } from '@capacitor/core';
import { isHealthAvailable, requestHealthPermissions, getTodayStepsAndCalories } from './utils/health';

// Import Components
import LockScreen from './components/LockScreen';
import Dashboard from './components/Dashboard';
import MealForm from './components/MealForm';
import ActivityForm from './components/ActivityForm';
import History from './components/History';
import WeeklySummary from './components/WeeklySummary';
import Profile from './components/Profile';
import Progress from './components/Progress';

// Import Icons
import { LayoutDashboard, PlusCircle, History as HistoryIcon, Settings, Flame, TrendingUp } from 'lucide-react';

export default function App() {
  const [passcode, setPasscode] = useState(localStorage.getItem('bitesync_passcode') || '');
  const [profileId, setProfileId] = useState(localStorage.getItem('bitesync_profile') || '');
  const [loadingAuth] = useState(false);

  // Profile data state
  const [userData, setUserData] = useState(null);
  const [partnerData, setPartnerData] = useState(null);
  
  // Real-time State Lists (last 30 days)
  const [userMeals, setUserMeals] = useState([]);
  const [partnerMeals, setPartnerMeals] = useState([]);
  const [userActivities, setUserActivities] = useState([]);
  const [partnerActivities, setPartnerActivities] = useState([]);
  const [userWeights, setUserWeights] = useState([]);
  const [partnerWeights, setPartnerWeights] = useState([]);
  
  // Historical Summaries State Maps (key: dateStr 'YYYY-MM-DD')
  const [userSummaries, setUserSummaries] = useState({});
  const [partnerSummaries, setPartnerSummaries] = useState({});
  
  // Navigation
  const [activeTab, setActiveTab] = useState('dashboard');

  const partnerProfileId = profileId === 'him' ? 'her' : 'him';

  const getTodayDateString = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const handleLogin = (code, selectedProfile) => {
    setPasscode(code);
    setProfileId(selectedProfile);
  };

  const handleLogout = () => {
    localStorage.removeItem('bitesync_passcode');
    localStorage.removeItem('bitesync_profile');
    setPasscode('');
    setProfileId('');
    setUserData(null);
    setPartnerData(null);
    setUserMeals([]);
    setPartnerMeals([]);
    setUserActivities([]);
    setPartnerActivities([]);
    setUserSummaries({});
    setPartnerSummaries({});
    setActiveTab('dashboard');
  };

  const [isNativeDevice, setIsNativeDevice] = useState(false);
  const [healthAuthorized, setHealthAuthorized] = useState(localStorage.getItem('bitesync_health_auth') === 'true');

  const syncAppleHealthData = async (steps, calories) => {
    if (!passcode || !profileId) return;
    const todayStr = getTodayDateString();
    const summaryRef = doc(db, 'couples', passcode, 'dailySummaries', `${profileId}_${todayStr}`);
    try {
      await setDoc(summaryRef, {
        steps: steps,
        activeCaloriesBurned: calories
      }, { merge: true });
    } catch (e) {
      console.error("Error syncing Apple Health data to Firestore:", e);
    }
  };

  const syncHealth = async () => {
    const data = await getTodayStepsAndCalories();
    if (data.steps > 0 || data.calories > 0) {
      await syncAppleHealthData(data.steps, data.calories);
    }
  };

  const handleRequestHealthAuth = async () => {
    const success = await requestHealthPermissions();
    if (success) {
      setHealthAuthorized(true);
      localStorage.setItem('bitesync_health_auth', 'true');
      await syncHealth();
    } else {
      alert("Failed to authorize Apple Health. Please enable permissions in your iPhone Settings > Health > Data Access.");
    }
  };

  // Native/Health check
  useEffect(() => {
    const checkNative = async () => {
      const native = Capacitor.isNativePlatform();
      setIsNativeDevice(native);
      if (native) {
        const available = await isHealthAvailable();
        if (available && healthAuthorized) {
          await syncHealth();
        }
      }
    };
    checkNative().catch(err => console.error(err));
  }, [healthAuthorized, passcode, profileId]);

  // App focus sync
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isNativeDevice && healthAuthorized) {
        syncHealth().catch(err => console.error(err));
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isNativeDevice, healthAuthorized, passcode, profileId]);

  // Database Observers
  useEffect(() => {
    if (!passcode || !profileId) return;

    // 1. Ensure profile documents exist under /couples/{passcode}/users/{profileId}
    const userProfileRef = doc(db, 'couples', passcode, 'users', profileId);
    const partnerProfileRef = doc(db, 'couples', passcode, 'users', partnerProfileId);

    // 2. User Profile Listener (write default profile data only if not present)
    const unsubProfile = onSnapshot(userProfileRef, (docSnap) => {
      if (docSnap.exists()) {
        setUserData(docSnap.data());
      } else {
        setDoc(userProfileRef, {
          uid: profileId,
          displayName: profileId === 'him' ? 'Ameen' : 'Noor',
          dailyCalorieGoal: 2000
        }).catch(err => console.error(err));
      }
    });

    // 3. Partner Profile Listener (write default profile data only if not present)
    const unsubPartnerProfile = onSnapshot(partnerProfileRef, (docSnap) => {
      if (docSnap.exists()) {
        setPartnerData(docSnap.data());
      } else {
        setDoc(partnerProfileRef, {
          uid: partnerProfileId,
          displayName: partnerProfileId === 'him' ? 'Ameen' : 'Noor',
          dailyCalorieGoal: 2000
        }).catch(err => console.error(err));
      }
    });

    const getThirtyDaysAgoDateString = () => {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };
    const thirtyDaysAgoStr = getThirtyDaysAgoDateString();

    // 4. User Meals Listener (last 30 days)
    const mealsRef = collection(db, 'couples', passcode, 'meals');
    const userMealsQuery = query(mealsRef, where('profileId', '==', profileId), where('date', '>=', thirtyDaysAgoStr));
    const unsubMeals = onSnapshot(userMealsQuery, (snapshot) => {
      const list = [];
      snapshot.forEach(d => list.push({ id: d.id, ...d.data() }));
      setUserMeals(list);
    });

    // 5. Partner Meals Listener (last 30 days)
    const partnerMealsQuery = query(mealsRef, where('profileId', '==', partnerProfileId), where('date', '>=', thirtyDaysAgoStr));
    const unsubPartnerMeals = onSnapshot(partnerMealsQuery, (snapshot) => {
      const list = [];
      snapshot.forEach(d => list.push({ id: d.id, ...d.data() }));
      setPartnerMeals(list);
    });

    // 6. User Activities Listener (last 30 days)
    const actsRef = collection(db, 'couples', passcode, 'activities');
    const userActsQuery = query(actsRef, where('profileId', '==', profileId), where('date', '>=', thirtyDaysAgoStr));
    const unsubActs = onSnapshot(userActsQuery, (snapshot) => {
      const list = [];
      snapshot.forEach(d => list.push({ id: d.id, ...d.data() }));
      setUserActivities(list);
    });

    // 7. Partner Activities Listener (last 30 days)
    const partnerActsQuery = query(actsRef, where('profileId', '==', partnerProfileId), where('date', '>=', thirtyDaysAgoStr));
    const unsubPartnerActs = onSnapshot(partnerActsQuery, (snapshot) => {
      const list = [];
      snapshot.forEach(d => list.push({ id: d.id, ...d.data() }));
      setPartnerActivities(list);
    });

    // 8. User Summaries Listener
    const sumsRef = collection(db, 'couples', passcode, 'dailySummaries');
    const userSumsQuery = query(sumsRef, where('profileId', '==', profileId));
    const unsubSums = onSnapshot(userSumsQuery, (snapshot) => {
      const map = {};
      snapshot.forEach(d => {
        map[d.data().date] = d.data();
      });
      setUserSummaries(map);
    });

    // 9. Partner Summaries Listener
    const partnerSumsQuery = query(sumsRef, where('profileId', '==', partnerProfileId));
    const unsubPartnerSums = onSnapshot(partnerSumsQuery, (snapshot) => {
      const map = {};
      snapshot.forEach(d => {
        map[d.data().date] = d.data();
      });
      setPartnerSummaries(map);
    });

    // 10. User Weights Listener
    const weightsRef = collection(db, 'couples', passcode, 'weights');
    const userWeightsQuery = query(weightsRef, where('profileId', '==', profileId));
    const unsubWeights = onSnapshot(userWeightsQuery, (snapshot) => {
      const list = [];
      snapshot.forEach(d => list.push({ id: d.id, ...d.data() }));
      setUserWeights(list);
    });

    // 11. Partner Weights Listener
    const partnerWeightsQuery = query(weightsRef, where('profileId', '==', partnerProfileId));
    const unsubPartnerWeights = onSnapshot(partnerWeightsQuery, (snapshot) => {
      const list = [];
      snapshot.forEach(d => list.push({ id: d.id, ...d.data() }));
      setPartnerWeights(list);
    });

    return () => {
      unsubProfile();
      unsubPartnerProfile();
      unsubMeals();
      unsubPartnerMeals();
      unsubActs();
      unsubPartnerActs();
      unsubSums();
      unsubPartnerSums();
      unsubWeights();
      unsubPartnerWeights();
    };
  }, [passcode, profileId, partnerProfileId]);

  // Delete Handlers
  const handleDeleteMeal = async (mealId, dateStr) => {
    if (!passcode) return;
    try {
      await deleteDoc(doc(db, 'couples', passcode, 'meals', mealId));
      await syncDailySummary(passcode, profileId, dateStr, userData?.dailyCalorieGoal || 2000);
    } catch (error) {
      console.error("Error deleting meal:", error);
    }
  };

  const handleEditMeal = async (mealId, updatedData) => {
    if (!passcode) return;
    try {
      const mealRef = doc(db, 'couples', passcode, 'meals', mealId);
      await updateDoc(mealRef, {
        name: updatedData.name.trim(),
        calories: parseInt(updatedData.calories, 10),
        type: updatedData.type,
        date: updatedData.date
      });
      // Recalculate daily summary for the updated date
      await syncDailySummary(passcode, profileId, updatedData.date, userData?.dailyCalorieGoal || 2000);
      
      // If the date was changed, also recalculate for the original date so its summary is updated
      if (updatedData.originalDate && updatedData.originalDate !== updatedData.date) {
        await syncDailySummary(passcode, profileId, updatedData.originalDate, userData?.dailyCalorieGoal || 2000);
      }
    } catch (error) {
      console.error("Error editing meal:", error);
    }
  };

  const handleDeleteActivity = async (activityId) => {
    if (!passcode) return;
    try {
      await deleteDoc(doc(db, 'couples', passcode, 'activities', activityId));
    } catch (error) {
      console.error("Error deleting activity:", error);
    }
  };

  const handleCommentMeal = async (mealId, commentText) => {
    if (!passcode || !profileId || !commentText.trim()) return;
    try {
      const mealRef = doc(db, 'couples', passcode, 'meals', mealId);
      await updateDoc(mealRef, {
        comments: arrayUnion({
          id: Math.random().toString(36).substring(2, 9),
          text: commentText.trim(),
          senderProfileId: profileId,
          senderName: userData?.displayName || 'Partner',
          createdAt: Date.now()
        })
      });
    } catch (error) {
      console.error("Error commenting on meal:", error);
    }
  };

  const handleCommentActivity = async (activityId, commentText) => {
    if (!passcode || !profileId || !commentText.trim()) return;
    try {
      const actRef = doc(db, 'couples', passcode, 'activities', activityId);
      await updateDoc(actRef, {
        comments: arrayUnion({
          id: Math.random().toString(36).substring(2, 9),
          text: commentText.trim(),
          senderProfileId: profileId,
          senderName: userData?.displayName || 'Partner',
          createdAt: Date.now()
        })
      });
    } catch (error) {
      console.error("Error commenting on activity:", error);
    }
  };

  const handleToggleKudos = async (itemType, itemId, hasKudos) => {
    if (!passcode || !profileId) return;
    try {
      const docRef = doc(db, 'couples', passcode, itemType, itemId);
      await updateDoc(docRef, {
        kudos: hasKudos ? arrayRemove(profileId) : arrayUnion(profileId)
      });
    } catch (error) {
      console.error(`Error toggling kudos on ${itemType}:`, error);
    }
  };

  // Sync Daily Summary if goal changes
  useEffect(() => {
    if (!passcode || !profileId || !userData?.dailyCalorieGoal) return;
    const todayStr = getTodayDateString();
    syncDailySummary(passcode, profileId, todayStr, userData.dailyCalorieGoal).catch(err => console.error(err));
  }, [passcode, profileId, userData?.dailyCalorieGoal]);

  const todayStr = getTodayDateString();
  const userTodayMeals = userMeals.filter(m => m.date === todayStr);
  const partnerTodayMeals = partnerMeals.filter(m => m.date === todayStr);
  const userTodayActivities = userActivities.filter(a => a.date === todayStr);
  const partnerTodayActivities = partnerActivities.filter(a => a.date === todayStr);

  if (loadingAuth) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-brand-cream">
        <div className="w-12 h-12 border-4 border-brand-green/30 border-t-brand-green rounded-full animate-spin mb-4" />
        <span className="text-sm font-bold text-brand-slate">Loading BiteSync...</span>
      </div>
    );
  }

  const polaroids = [
    { id: 1, path: '/photos/IMG_0313.JPG', rotation: '-6deg', top: '5%', left: '2%', caption: 'Morning fuel! ☕' },
    { id: 2, path: '/photos/IMG_3684.jpeg', rotation: '8deg', top: '23%', left: '4%', caption: 'Morning walk 🌳' },
    { id: 3, path: '/photos/IMG_3733.jpeg', rotation: '-4deg', top: '45%', left: '1%', caption: 'Healthy bites 🥗' },
    { id: 4, path: '/photos/IMG_3774.jpeg', rotation: '12deg', top: '65%', left: '5%', caption: 'Workout partner 💪' },
    { id: 5, path: '/photos/IMG_3847.jpeg', rotation: '-8deg', top: '84%', left: '2%', caption: 'Us together 💕' },
    { id: 6, path: '/photos/IMG_3855.jpeg', rotation: '5deg', top: '8%', right: '2%', caption: 'Yummy pancake 🥞' },
    { id: 7, path: '/photos/IMG_3885.jpeg', rotation: '-10deg', top: '26%', right: '5%', caption: 'Afternoon run 🏃‍♀️' },
    { id: 8, path: '/photos/IMG_3888.jpeg', rotation: '6deg', top: '48%', right: '1%', caption: 'Synced up! 💑' },
    { id: 9, path: '/photos/IMG_5014.jpeg', rotation: '-8deg', top: '68%', right: '4%', caption: 'Cheat day 🍕' },
    { id: 10, path: '/photos/IMG_8249.jpeg', rotation: '4deg', top: '87%', right: '2%', caption: 'Happy days 💖' }
  ];

  // Not Logged In View
  if (!passcode || !profileId) {
    return <LockScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen whiteboard-bg pb-24 md:pb-6 flex flex-col items-center relative overflow-x-hidden">
      
      {/* Background Whiteboard Collage - Only visible on desktop/wide screens */}
      <div className="hidden lg:block absolute inset-0 select-none z-0 overflow-hidden pointer-events-none">
        {polaroids.map((photo) => (
          <div
            key={photo.id}
            style={{
              top: photo.top,
              left: photo.left,
              right: photo.right,
              '--r': photo.rotation
            }}
            className="absolute bg-white p-2.5 pb-4 rounded-lg shadow-md border border-neutral-100/50 pointer-events-auto cursor-pointer w-36 polaroid-card group"
          >
            <div className="w-full aspect-square bg-neutral-100 rounded-xs overflow-hidden border border-neutral-200/50">
              <img
                src={photo.path}
                alt={photo.caption}
                className="w-full h-full object-cover grayscale-15 group-hover:grayscale-0 transition-all duration-300"
              />
            </div>
            <p className="font-handwritten text-center text-neutral-700 mt-2 select-none leading-none tracking-wide text-lg">
              {photo.caption}
            </p>
          </div>
        ))}
      </div>

      {/* Main App Container - z-10 stays above background whiteboard collage */}
      <div className="relative z-10 w-full flex flex-col items-center pointer-events-none">
        
        {/* Top Header Bar */}
        <header className="w-full max-w-lg bg-white/70 backdrop-blur-md sticky top-0 border-b border-neutral-100/50 py-4 px-6 flex items-center justify-between z-40 pointer-events-auto">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-green-light rounded-xl flex items-center justify-center text-brand-green shadow-xs">
              <Flame size={18} className="fill-current" />
            </div>
            <span className="text-lg font-black text-brand-charcoal tracking-tight">BiteSync</span>
          </div>
          
          {userData && (
            <div className="flex items-center gap-1.5 bg-neutral-100/60 py-1 px-3 rounded-full border border-neutral-100">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-green" />
              <span className="text-xs font-bold text-brand-charcoal">{userData.displayName}</span>
            </div>
          )}
        </header>

        {/* Main Scrollable Area */}
        <main className="w-full max-w-lg px-4 pt-6 pb-28 space-y-6 flex-1 pointer-events-auto">
          {activeTab === 'dashboard' && (
            <>
              <Dashboard
                userData={userData}
                partnerData={partnerData}
                userMeals={userMeals}
                partnerMeals={partnerMeals}
                userActivities={userActivities}
                partnerActivities={partnerActivities}
                userTodayMeals={userTodayMeals}
                partnerTodayMeals={partnerTodayMeals}
                userTodayActivities={userTodayActivities}
                partnerTodayActivities={partnerTodayActivities}
                userSummaries={userSummaries}
                partnerSummaries={partnerSummaries}
              />
              <WeeklySummary
                userSummaries={userSummaries}
                partnerSummaries={partnerSummaries}
                userGoal={userData?.dailyCalorieGoal || 2000}
                partnerGoal={partnerData?.dailyCalorieGoal || 2000}
                userData={userData}
                partnerData={partnerData}
              />
            </>
          )}

          {activeTab === 'log' && (
            <div className="space-y-10 pb-12">
              <h2 className="text-2xl font-black text-brand-charcoal px-1 mb-2">Log Today</h2>
              <MealForm 
                passcode={passcode}
                profileId={profileId}
                dailyCalorieGoal={userData?.dailyCalorieGoal || 2000} 
              />
              <ActivityForm 
                passcode={passcode}
                profileId={profileId}
              />
            </div>
          )}

          {activeTab === 'history' && (
            <History
              userMeals={userMeals}
              partnerMeals={partnerMeals}
              userActivities={userActivities}
              partnerActivities={partnerActivities}
              userData={userData}
              partnerData={partnerData}
              onDeleteMeal={handleDeleteMeal}
              onEditMeal={handleEditMeal}
              onDeleteActivity={handleDeleteActivity}
              onCommentMeal={handleCommentMeal}
              onCommentActivity={handleCommentActivity}
              onToggleKudos={handleToggleKudos}
              currentProfileId={profileId}
            />
          )}

          {activeTab === 'profile' && (
            <Profile 
              passcode={passcode}
              profileId={profileId}
              userData={userData}
              onLogout={handleLogout}
              isNativeDevice={isNativeDevice}
              healthAuthorized={healthAuthorized}
              onRequestHealthAuth={handleRequestHealthAuth}
            />
          )}

          {activeTab === 'progress' && (
            <Progress
              passcode={passcode}
              profileId={profileId}
              userData={userData}
              partnerData={partnerData}
              userWeights={userWeights}
              partnerWeights={partnerWeights}
            />
          )}
        </main>

        {/* Mobile Sticky Bottom Tab Bar */}
        <nav className="fixed bottom-6 left-4 right-4 bg-white/90 backdrop-blur-md border border-neutral-150/70 py-3 px-6 flex items-center justify-around z-50 max-w-lg mx-auto rounded-3xl shadow-xl pointer-events-auto">
          {/* Dashboard Tab */}
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center gap-1 transition-all ${
              activeTab === 'dashboard' ? 'text-brand-green scale-105' : 'text-neutral-400 hover:text-brand-charcoal'
            }`}
          >
            <LayoutDashboard size={20} />
            <span className="text-[10px] font-bold">Dash</span>
          </button>

          {/* Log Tab */}
          <button
            onClick={() => setActiveTab('log')}
            className={`flex flex-col items-center gap-1 transition-all ${
              activeTab === 'log' ? 'text-brand-green scale-105' : 'text-neutral-400 hover:text-brand-charcoal'
            }`}
          >
            <PlusCircle size={20} />
            <span className="text-[10px] font-bold">Log</span>
          </button>

          {/* History Tab */}
          <button
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center gap-1 transition-all ${
              activeTab === 'history' ? 'text-brand-green scale-105' : 'text-neutral-400 hover:text-brand-charcoal'
            }`}
          >
            <HistoryIcon size={20} />
            <span className="text-[10px] font-bold">Feed</span>
          </button>

          {/* Progress Tab */}
          <button
            onClick={() => setActiveTab('progress')}
            className={`flex flex-col items-center gap-1 transition-all ${
              activeTab === 'progress' ? 'text-brand-green scale-105' : 'text-neutral-400 hover:text-brand-charcoal'
            }`}
          >
            <TrendingUp size={20} />
            <span className="text-[10px] font-bold">Progress</span>
          </button>

          {/* Settings Tab */}
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center gap-1 transition-all ${
              activeTab === 'profile' ? 'text-brand-green scale-105' : 'text-neutral-400 hover:text-brand-charcoal'
            }`}
          >
            <Settings size={20} />
            <span className="text-[10px] font-bold">Setup</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
