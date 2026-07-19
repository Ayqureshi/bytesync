import { Capacitor } from '@capacitor/core';
import { Health } from '@capgo/capacitor-health';

const isNative = Capacitor.isNativePlatform();

/**
 * Checks if the Health SDK is available on the current device.
 */
export async function isHealthAvailable() {
  if (!isNative) return false;
  try {
    const result = await Health.isAvailable();
    return !!result?.value;
  } catch (e) {
    console.warn('Health check availability failed:', e);
    return false;
  }
}

/**
 * Requests read permissions for steps and active energy (calories).
 */
export async function requestHealthPermissions() {
  if (!isNative) return false;
  try {
    await Health.requestAuthorization({
      read: ['steps', 'calories'],
      write: []
    });
    return true;
  } catch (e) {
    console.error('Request Health permissions failed:', e);
    return false;
  }
}

/**
 * Fetches steps and active calories totals for today.
 */
export async function getTodayStepsAndCalories() {
  if (!isNative) return { steps: 0, calories: 0 };

  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

  try {
    const stepsResult = await Health.queryAggregated({
      dataType: 'steps',
      startDate: startOfDay.toISOString(),
      endDate: endOfDay.toISOString()
    });

    const caloriesResult = await Health.queryAggregated({
      dataType: 'calories',
      startDate: startOfDay.toISOString(),
      endDate: endOfDay.toISOString()
    });

    return {
      steps: Math.round(stepsResult?.value || 0),
      calories: Math.round(caloriesResult?.value || 0)
    };
  } catch (e) {
    console.error('Error fetching today steps and calories:', e);
    return { steps: 0, calories: 0 };
  }
}
