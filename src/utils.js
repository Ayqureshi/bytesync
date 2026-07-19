import { collection, doc, getDocs, query, where, setDoc } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Re-calculates and syncs the daily summary for a profile on a given date.
 * Fetches all meals, sums their calories, and writes to couples/{passcode}/dailySummaries/{profileId}_{date}.
 */
export async function syncDailySummary(passcode, profileId, dateStr, dailyCalorieGoal) {
  try {
    const mealsRef = collection(db, 'couples', passcode, 'meals');
    const q = query(mealsRef, where('profileId', '==', profileId), where('date', '==', dateStr));
    const querySnapshot = await getDocs(q);

    let totalCalories = 0;
    querySnapshot.forEach((doc) => {
      const meal = doc.data();
      totalCalories += parseInt(meal.calories, 10) || 0;
    });

    const summaryRef = doc(db, 'couples', passcode, 'dailySummaries', `${profileId}_${dateStr}`);
    await setDoc(summaryRef, {
      profileId: profileId,
      date: dateStr,
      caloriesConsumed: totalCalories,
      goal: parseInt(dailyCalorieGoal, 10) || 2000,
      metGoal: totalCalories <= (parseInt(dailyCalorieGoal, 10) || 2000)
    }, { merge: true });

    return totalCalories;
  } catch (error) {
    console.error("Error syncing daily summary:", error);
    throw error;
  }
}

/**
 * Helper to get milliseconds timestamp of a log document.
 */
export function getItemTimestamp(item) {
  if (item.createdAt) {
    if (typeof item.createdAt.toMillis === 'function') {
      return item.createdAt.toMillis();
    }
    if (item.createdAt.seconds) {
      return item.createdAt.seconds * 1000;
    }
    if (typeof item.createdAt === 'number') {
      return item.createdAt;
    }
  }
  // Fallback to date string parsing
  if (item.date) {
    const parsed = Date.parse(item.date);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }
  return 0;
}

/**
 * Dynamically calculates the shared streak count from meals and activities of both users.
 * Requires both users to make an update (meal or activity) in the last 24 hours, otherwise resets to 0.
 * Counts consecutive calendar days going back where both users had updates.
 */
export function calculateStreak(userMeals = [], partnerMeals = [], userActivities = [], partnerActivities = []) {
  if (!partnerMeals && !partnerActivities) {
    return {
      streakCount: 0,
      isActiveToday: false,
      hasUserUpdatedIn24h: false,
      hasPartnerUpdatedIn24h: false,
      userLastUpdate: 0,
      partnerLastUpdate: 0
    };
  }

  const getLocalDateString = (offset = 0) => {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const getLatestTimestamp = (meals = [], activities = []) => {
    let maxTs = 0;
    meals.forEach(m => {
      const ts = getItemTimestamp(m);
      if (ts > maxTs) maxTs = ts;
    });
    activities.forEach(a => {
      const ts = getItemTimestamp(a);
      if (ts > maxTs) maxTs = ts;
    });
    return maxTs;
  };

  const userLastUpdate = getLatestTimestamp(userMeals, userActivities);
  const partnerLastUpdate = getLatestTimestamp(partnerMeals, partnerActivities);

  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;

  const hasUserUpdatedIn24h = userLastUpdate > 0 && (now - userLastUpdate) <= oneDayMs;
  const hasPartnerUpdatedIn24h = partnerLastUpdate > 0 && (now - partnerLastUpdate) <= oneDayMs;

  // Streak is 0 if either user has not made an update in the last 24 hours
  if (!hasUserUpdatedIn24h || !hasPartnerUpdatedIn24h) {
    return {
      streakCount: 0,
      isActiveToday: false,
      hasUserUpdatedIn24h,
      hasPartnerUpdatedIn24h,
      userLastUpdate,
      partnerLastUpdate
    };
  }

  // Construct sets of all update calendar dates for each user
  const userUpdateDates = new Set([
    ...userMeals.map(m => m.date),
    ...userActivities.map(a => a.date)
  ]);
  const partnerUpdateDates = new Set([
    ...partnerMeals.map(m => m.date),
    ...partnerActivities.map(a => a.date)
  ]);

  let streakCount = 0;
  let hasBothToday = userUpdateDates.has(getLocalDateString(0)) && partnerUpdateDates.has(getLocalDateString(0));
  let hasBothYesterday = userUpdateDates.has(getLocalDateString(1)) && partnerUpdateDates.has(getLocalDateString(1));

  if (hasBothToday) {
    let day = 0;
    while (userUpdateDates.has(getLocalDateString(day)) && partnerUpdateDates.has(getLocalDateString(day))) {
      streakCount++;
      day++;
    }
  } else if (hasBothYesterday) {
    let day = 1;
    while (userUpdateDates.has(getLocalDateString(day)) && partnerUpdateDates.has(getLocalDateString(day))) {
      streakCount++;
      day++;
    }
  } else {
    // If they didn't both log on the same calendar day, but they both logged in the last 24 hours,
    // the streak has started!
    streakCount = 1;
  }

  return {
    streakCount,
    isActiveToday: streakCount > 0,
    hasUserUpdatedIn24h,
    hasPartnerUpdatedIn24h,
    userLastUpdate,
    partnerLastUpdate
  };
}
