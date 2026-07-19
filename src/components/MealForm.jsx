import { useState, useRef } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { syncDailySummary } from '../utils';
import { PlusCircle, Utensils, Camera, Sparkles, AlertTriangle } from 'lucide-react';

// Helper to call Gemini with a model fallback loop (for rate limits / capacity issues)
const callGeminiWithFallback = async (payload, apiKey) => {
  const models = ['gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-3.1-flash-lite'];
  let lastError = null;

  for (const model of models) {
    try {
      console.log(`Attempting food analysis with model: ${model}`);
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...payload,
            generationConfig: {
              responseMimeType: "application/json",
              ...payload.generationConfig
            }
          })
        }
      );

      if (!response.ok) {
        let errMsg = `HTTP ${response.status} ${response.statusText}`;
        try {
          const errJson = await response.json();
          if (errJson.error?.message) {
            errMsg = errJson.error.message;
          }
        } catch (_) {}
        
        // If it's a rate-limit / overloaded error, continue to next model
        const isQuotaError = response.status === 429 || 
                             response.status === 503 || 
                             errMsg.toLowerCase().includes('quota') || 
                             errMsg.toLowerCase().includes('limit') || 
                             errMsg.toLowerCase().includes('exhausted') || 
                             errMsg.toLowerCase().includes('capacity') ||
                             errMsg.toLowerCase().includes('overloaded');
                             
        if (isQuotaError) {
          console.warn(`Model ${model} failed with rate limit/quota: ${errMsg}. Trying fallback model...`);
          lastError = new Error(errMsg);
          continue;
        }
        throw new Error(errMsg);
      }

      const result = await response.json();
      const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        throw new Error('No analysis text returned from Gemini.');
      }

      return rawText.trim();

    } catch (err) {
      lastError = err;
      console.warn(`Attempt with ${model} failed:`, err);
    }
  }

  throw lastError || new Error('All Gemini models failed to respond.');
};

export default function MealForm({ passcode, profileId, dailyCalorieGoal, onMealAdded }) {
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [type, setType] = useState('Breakfast');
  const [date, setDate] = useState(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // AI Scanner state
  const [scanning, setScanning] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [scannerError, setScannerError] = useState('');
  
  // Refinement states
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [refining, setRefining] = useState(false);
  const [imageBase64, setImageBase64] = useState('');
  const [imageType, setImageType] = useState('');
  
  const fileInputRef = useRef(null);

  const handleCameraClick = () => {
    setScannerError('');
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Create a local preview
    setImagePreview(URL.createObjectURL(file));
    setScanning(true);
    setScannerError('');
    setAiAnalysis(null);
    setFeedback('');

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      setScannerError('Please add VITE_GEMINI_API_KEY in your .env file to enable the AI scanner.');
      setScanning(false);
      return;
    }

    try {
      const base64Data = await fileToBase64(file);
      const mimeType = file.type || 'image/jpeg';
      setImageBase64(base64Data);
      setImageType(mimeType);

      const payload = {
        contents: [
          {
            parts: [
              {
                text: 'Analyze this food image. Provide: 1. The name of the food item. 2. Estimated portion size description with estimated weight in grams. 3. Estimated calories (in kcal). Respond in this exact format: {"foodName": "string", "weightGrams": number, "calories": number}'
              },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Data
                }
              }
            ]
          }
        ]
      };

      const rawText = await callGeminiWithFallback(payload, apiKey);
      const parsedData = JSON.parse(rawText);

      setAiAnalysis(parsedData);

      if (parsedData.foodName) {
        const displayName = parsedData.weightGrams 
          ? `${parsedData.foodName} (~${parsedData.weightGrams}g)` 
          : parsedData.foodName;
        
        setName(displayName);
      }
      
      if (parsedData.calories) {
        setCalories(parsedData.calories);
      }

    } catch (err) {
      console.error('AI food scanning failed:', err);
      setScannerError(`Scanning failed: ${err.message || err}`);
    } finally {
      setScanning(false);
    }
  };

  const handleRefine = async (e) => {
    e.preventDefault();
    if (!feedback.trim() || !imageBase64) return;

    setRefining(true);
    setScannerError('');

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      setScannerError('Please add VITE_GEMINI_API_KEY in your .env file to enable the AI scanner.');
      setRefining(false);
      return;
    }

    try {
      const payload = {
        contents: [
          {
            parts: [
              {
                text: `Analyze this food image. The user has provided the following correction: "${feedback}". Based on this correction and the image, re-estimate the food. Provide: 1. The corrected name of the food item. 2. Estimated portion size description with estimated weight in grams. 3. Estimated calories (in kcal). Respond in this exact format: {"foodName": "string", "weightGrams": number, "calories": number}`
              },
              {
                inlineData: {
                  mimeType: imageType,
                  data: imageBase64
                }
              }
            ]
          }
        ]
      };

      const rawText = await callGeminiWithFallback(payload, apiKey);
      const parsedData = JSON.parse(rawText);

      setAiAnalysis(parsedData);

      if (parsedData.foodName) {
        const displayName = parsedData.weightGrams 
          ? `${parsedData.foodName} (~${parsedData.weightGrams}g)` 
          : parsedData.foodName;
        
        setName(displayName);
      }
      
      if (parsedData.calories) {
        setCalories(parsedData.calories);
      }
      
      setFeedback('');

    } catch (err) {
      console.error('AI food scanning refinement failed:', err);
      setScannerError(`Refinement failed: ${err.message || err}`);
    } finally {
      setRefining(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !calories || parseInt(calories, 10) <= 0) return;

    setLoading(true);
    setSuccess(false);

    try {
      const mealsRef = collection(db, 'couples', passcode, 'meals');
      await addDoc(mealsRef, {
        profileId,
        name: name.trim(),
        calories: parseInt(calories, 10),
        type,
        date,
        createdAt: serverTimestamp()
      });

      // Recalculate daily summary for this date
      await syncDailySummary(passcode, profileId, date, dailyCalorieGoal);

      setName('');
      setCalories('');
      setImagePreview(null);
      setImageBase64('');
      setImageType('');
      setAiAnalysis(null);
      setFeedback('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);

      if (onMealAdded) {
        onMealAdded(date);
      }
    } catch (error) {
      console.error("Error logging meal:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-8 sm:p-10 rounded-3xl border border-neutral-100 shadow-sm space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-green-light rounded-xl flex items-center justify-center text-brand-green">
            <Utensils size={18} />
          </div>
          <h3 className="font-bold text-lg text-brand-charcoal">Log a Meal</h3>
        </div>

        {/* hidden file input for camera/photo */}
        <input 
          type="file"
          ref={fileInputRef}
          accept="image/*"
          onChange={handleImageChange}
          className="hidden"
        />
 
        {/* AI Camera button */}
        <button
          type="button"
          onClick={handleCameraClick}
          disabled={scanning || refining}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-green-light text-brand-green rounded-xl text-xs font-bold hover:bg-brand-green/20 transition-all active:scale-95"
        >
          <Camera size={14} />
          <span>Scan Photo</span>
        </button>
      </div>
 
      {/* Preview box / Scanning loader */}
      {imagePreview && (
        <div className="relative w-full h-40 rounded-2xl overflow-hidden border border-neutral-100 bg-neutral-50 flex items-center justify-center">
          <img src={imagePreview} alt="Preview" className="w-full h-full object-cover brightness-90" />
          
          {(scanning || refining) && (
            <div className="absolute inset-0 bg-brand-charcoal/60 backdrop-blur-xs flex flex-col items-center justify-center text-white gap-2">
              <div className="w-8 h-8 border-3 border-brand-green/30 border-t-brand-green rounded-full animate-spin" />
              <div className="flex items-center gap-1 text-xs font-black tracking-wide">
                <Sparkles size={12} className="animate-pulse" />
                <span>{refining ? 'Refining with Feedback...' : 'Gemini Analyzing...'}</span>
              </div>
            </div>
          )}
        </div>
      )}
 
      {/* AI Analysis Results Card */}
      {aiAnalysis && !scanning && !refining && (
        <div className="p-5 bg-brand-green-light/40 border border-brand-green/20 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-brand-green font-extrabold text-xs tracking-wider uppercase">
              <Sparkles size={14} className="fill-current animate-pulse" />
              <span>Gemini Result</span>
            </div>
            {aiAnalysis.weightGrams && (
              <span className="text-[10px] font-bold bg-white text-brand-slate px-2 py-0.5 rounded-full border border-neutral-100">
                Portion: ~{aiAnalysis.weightGrams}g
              </span>
            )}
          </div>
          
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-brand-slate uppercase tracking-wide">Detected Food</span>
              <span className="font-bold text-brand-charcoal text-sm">{aiAnalysis.foodName}</span>
            </div>
            <div className="flex flex-col items-end shrink-0">
              <span className="text-xs font-bold text-brand-slate uppercase tracking-wide">Estimated Calories</span>
              <span className="font-black text-brand-green text-base">{aiAnalysis.calories} kcal</span>
            </div>
          </div>

          <div className="border-t border-brand-green/10 pt-3">
            <label className="block text-[10px] font-bold text-brand-slate uppercase tracking-wide mb-1.5">
              Not quite right? Adjust below or tell Gemini what it is:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="e.g. Actually it was 2 slices of sourdough"
                className="flex-1 px-3 py-2 bg-white rounded-xl border border-neutral-200 text-xs font-medium placeholder-neutral-400 focus:outline-none focus:border-brand-green transition-all"
              />
              <button
                type="button"
                onClick={handleRefine}
                disabled={!feedback.trim() || refining}
                className="px-3 py-2 bg-brand-green text-white font-bold rounded-xl text-xs hover:bg-brand-green/90 active:scale-95 transition-all shrink-0 disabled:opacity-50 disabled:pointer-events-none"
              >
                Refine
              </button>
            </div>
          </div>
        </div>
      )}

      {scannerError && (
        <div className="p-3 bg-brand-rose-light text-brand-rose rounded-2xl border border-brand-rose/10 text-xs font-semibold flex items-start gap-2">
          <AlertTriangle size={16} className="shrink-0 text-brand-rose" />
          <span>{scannerError}</span>
        </div>
      )}
 
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-brand-slate mb-2">
              Food Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Avocado Toast"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-5 py-3.5 bg-neutral-50 rounded-2xl border border-neutral-200 text-brand-charcoal font-medium placeholder-neutral-400 focus:outline-none focus:border-brand-green focus:bg-white transition-all text-sm"
            />
          </div>
 
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-brand-slate mb-2">
              Calories (kcal)
            </label>
            <input
              type="number"
              required
              min="1"
              placeholder="e.g. 350"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              className="w-full px-5 py-3.5 bg-neutral-50 rounded-2xl border border-neutral-200 text-brand-charcoal font-medium placeholder-neutral-400 focus:outline-none focus:border-brand-green focus:bg-white transition-all text-sm"
            />
          </div>
        </div>
 
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-brand-slate mb-2">
              Meal Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-5 py-3.5 bg-neutral-50 rounded-2xl border border-neutral-200 text-brand-charcoal font-bold focus:outline-none focus:border-brand-green focus:bg-white transition-all text-sm appearance-none cursor-pointer"
            >
              <option value="Breakfast">Breakfast</option>
              <option value="Lunch">Lunch</option>
              <option value="Dinner">Dinner</option>
              <option value="Snack">Snack</option>
            </select>
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
              className="w-full px-5 py-3.5 bg-neutral-50 rounded-2xl border border-neutral-200 text-brand-charcoal font-bold focus:outline-none focus:border-brand-green focus:bg-white transition-all text-sm"
            />
          </div>
        </div>
 
        <button
          type="submit"
          disabled={loading || scanning || refining}
          className={`w-full py-4 rounded-2xl font-bold transition-all text-sm flex items-center justify-center gap-2 mt-4 ${
            success 
              ? 'bg-brand-green text-white shadow-md' 
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
              Add Meal
            </>
          )}
        </button>
      </form>
    </div>
  );
}
