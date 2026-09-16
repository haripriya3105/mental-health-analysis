import { GoogleGenAI } from '@google/genai';

// Crisis / Safety keywords for risk detection
const CRISIS_KEYWORDS = [
  'suicide',
  'kill myself',
  'end my life',
  'want to die',
  'self-harm',
  'hurt myself',
  'cutting myself',
  'overdose',
  "don't want to live",
  'end it all',
  'better off dead',
  'cant go on',
  "can't go on",
];

const POSITIVE_WORDS = [
  'happy', 'joy', 'joyful', 'great', 'good', 'wonderful', 'calm', 'peaceful',
  'energetic', 'relaxed', 'refreshed', 'hopeful', 'optimistic', 'better',
  'pleased', 'loved', 'grateful', 'motivated', 'strong', 'rested', 'content',
  'proud', 'accomplished', 'sunny', 'uplifted', 'productive', 'clear'
];

const NEGATIVE_WORDS = [
  'sad', 'down', 'unhappy', 'anxious', 'worry', 'worried', 'nervous', 'stressed',
  'overwhelm', 'overwhelmed', 'frustrated', 'angry', 'mad', 'irritated', 'tired',
  'exhausted', 'fatigued', 'draining', 'pain', 'hurt', 'hopeless', 'lonely',
  'panic', 'panicking', 'scared', 'tense', 'foggy', 'heavy', 'gloomy'
];

const EMOTIONAL_INDICATOR_MAP = {
  Calm: ['calm', 'peaceful', 'relaxed', 'quiet', 'tranquil', 'serene', 'grounded'],
  Sad: ['sad', 'down', 'tearful', 'grief', 'blue', 'sorrow', 'crying', 'gloomy'],
  Anxious: ['anxious', 'worry', 'worried', 'panic', 'nervous', 'uneasy', 'racing', 'apprehensive'],
  Angry: ['angry', 'mad', 'frustrated', 'annoyed', 'irritated', 'resentful'],
  Stressed: ['stressed', 'pressure', 'overwhelmed', 'overwhelm', 'tense', 'hectic', 'strained'],
  Tired: ['tired', 'exhausted', 'fatigued', 'sleepy', 'draining', 'drained', 'low energy', 'drowsy'],
  'Positive/hopeful': ['hopeful', 'optimistic', 'grateful', 'happy', 'motivated', 'improving', 'looking forward', 'positive'],
};

/**
 * Check text for crisis / safety risk signals.
 */
export function checkCrisisSafety(text) {
  if (!text || typeof text !== 'string') return null;
  const lower = text.toLowerCase();
  for (const kw of CRISIS_KEYWORDS) {
    if (lower.includes(kw)) {
      return (
        'Important Safety Notice: If you are experiencing immediate crisis, thoughts of self-harm, or severe distress, please reach out for immediate support. You can call or text the Suicide & Crisis Lifeline at 988 (available 24/7, free and confidential), contact a trusted healthcare professional, or go to the nearest emergency facility. AI insights are for general wellness reflection only and are not a substitute for clinical or emergency support.'
      );
    }
  }
  return null;
}

/**
 * Analyze text sentiment and identify emotional indicators without medical classification.
 */
export function analyzeTextSentiment(texts = []) {
  const combined = texts.filter(Boolean).join(' ').toLowerCase();
  if (!combined.trim()) {
    return {
      sentiment: 'Neutral',
      emotional_indicators: [],
      word_count: 0,
    };
  }

  const words = combined.split(/\W+/).filter(w => w.length > 2);
  let posCount = 0;
  let negCount = 0;

  for (const word of words) {
    if (POSITIVE_WORDS.includes(word)) posCount++;
    if (NEGATIVE_WORDS.includes(word)) negCount++;
  }

  // Emotional indicator matches
  const detectedIndicators = [];
  for (const [indicator, terms] of Object.entries(EMOTIONAL_INDICATOR_MAP)) {
    const hasTerm = terms.some(term => combined.includes(term));
    if (hasTerm) {
      detectedIndicators.push(indicator);
    }
  }

  let sentiment = 'Neutral';
  if (posCount > negCount + 1) {
    sentiment = 'Positive';
  } else if (negCount > posCount + 1) {
    sentiment = 'Negative';
  } else if (posCount > 0 && negCount > 0) {
    sentiment = 'Mixed';
  }

  return {
    sentiment,
    emotional_indicators: detectedIndicators,
    word_count: words.length,
  };
}

/**
 * Calculate statistical patterns, directions, and metrics across patient data.
 */
export function analyzePatterns(moodList = [], symptomList = [], assessmentList = []) {
  // Check crisis signals across all user notes
  let safetyMessage = null;
  const allNotes = [];

  for (const m of moodList) {
    if (m.notes) {
      allNotes.push(m.notes);
      const crisis = checkCrisisSafety(m.notes);
      if (crisis && !safetyMessage) safetyMessage = crisis;
    }
  }

  for (const s of symptomList) {
    if (s.notes) {
      allNotes.push(s.notes);
      const crisis = checkCrisisSafety(s.notes);
      if (crisis && !safetyMessage) safetyMessage = crisis;
    }
  }

  // Insufficient data condition: need at least 2 check-in records for trends
  if (!moodList || moodList.length < 2) {
    const singleMood = moodList && moodList.length === 1 ? moodList[0] : null;
    return {
      has_sufficient_data: false,
      summary: 'Not enough data yet. Continue completing your daily check-ins to receive meaningful insights.',
      trend: 'Insufficient data',
      average_mood: singleMood ? Number(singleMood.mood_score.toFixed(1)) : null,
      average_stress: singleMood ? Number(singleMood.stress_level.toFixed(1)) : null,
      average_energy: singleMood ? Number(singleMood.energy_level.toFixed(1)) : null,
      dominant_emotion: singleMood ? singleMood.emotional_state : '—',
      sentiment: 'Neutral',
      emotional_indicators: [],
      key_patterns: [
        'At least two daily check-in records are required to calculate trend trajectories and comparative patterns.',
      ],
      recommendations: [
        'Take a moment each day to log your mood, stress, and energy to build an informative wellness picture.',
        'Note any factors such as rest, activities, or conversations that seem to support your wellbeing.',
      ],
      safety_message: safetyMessage,
      data_points: {
        checkins: moodList.length,
        symptoms: symptomList.length,
        assessments: assessmentList.length,
      },
    };
  }

  // Calculate averages
  const totalEntries = moodList.length;
  const sumMood = moodList.reduce((acc, cur) => acc + cur.mood_score, 0);
  const sumStress = moodList.reduce((acc, cur) => acc + cur.stress_level, 0);
  const sumEnergy = moodList.reduce((acc, cur) => acc + cur.energy_level, 0);

  const avgMood = Number((sumMood / totalEntries).toFixed(1));
  const avgStress = Number((sumStress / totalEntries).toFixed(1));
  const avgEnergy = Number((sumEnergy / totalEntries).toFixed(1));

  // Sort chronological for directional delta (oldest to newest)
  const chronological = [...moodList].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const splitIdx = Math.floor(chronological.length / 2);
  const earlierBatch = chronological.slice(0, splitIdx);
  const recentBatch = chronological.slice(splitIdx);

  const avgOf = (arr, key) => arr.reduce((sum, item) => sum + item[key], 0) / arr.length;

  const earlierMood = avgOf(earlierBatch, 'mood_score');
  const recentMood = avgOf(recentBatch, 'mood_score');
  const deltaMood = recentMood - earlierMood;

  const earlierStress = avgOf(earlierBatch, 'stress_level');
  const recentStress = avgOf(recentBatch, 'stress_level');
  const deltaStress = recentStress - earlierStress;

  const earlierEnergy = avgOf(earlierBatch, 'energy_level');
  const recentEnergy = avgOf(recentBatch, 'energy_level');
  const deltaEnergy = recentEnergy - earlierEnergy;

  // Directions
  let moodDirection = 'Stable';
  if (deltaMood >= 0.5) moodDirection = 'Improving';
  else if (deltaMood <= -0.5) moodDirection = 'Worsening';

  // For stress, decreasing is Improving!
  let stressDirection = 'Stable';
  if (deltaStress <= -0.5) stressDirection = 'Improving';
  else if (deltaStress >= 0.5) stressDirection = 'Worsening';

  let energyDirection = 'Stable';
  if (deltaEnergy >= 0.5) energyDirection = 'Improving';
  else if (deltaEnergy <= -0.5) energyDirection = 'Worsening';

  // Overall trend calculation
  let overallTrend = 'Stable';
  let improveScore = 0;
  let worsenScore = 0;

  if (moodDirection === 'Improving') improveScore++;
  if (moodDirection === 'Worsening') worsenScore++;
  if (stressDirection === 'Improving') improveScore++;
  if (stressDirection === 'Worsening') worsenScore++;
  if (energyDirection === 'Improving') improveScore++;
  if (energyDirection === 'Worsening') worsenScore++;

  if (improveScore >= 2 && worsenScore === 0) {
    overallTrend = 'Improving';
  } else if (worsenScore >= 2 && improveScore === 0) {
    overallTrend = 'Worsening';
  } else if (improveScore > 0 && worsenScore > 0) {
    overallTrend = 'Mixed';
  } else if (improveScore === 1 && worsenScore === 0) {
    overallTrend = 'Improving';
  } else if (worsenScore === 1 && improveScore === 0) {
    overallTrend = 'Worsening';
  } else {
    overallTrend = 'Stable';
  }

  // Dominant emotional state
  const emotionCounts = {};
  for (const m of moodList) {
    const st = m.emotional_state || 'Calm';
    emotionCounts[st] = (emotionCounts[st] || 0) + 1;
  }
  let dominantEmotion = 'Calm';
  let maxEmotionCount = 0;
  for (const [state, count] of Object.entries(emotionCounts)) {
    if (count > maxEmotionCount) {
      maxEmotionCount = count;
      dominantEmotion = state;
    }
  }

  // Symptom frequency analysis
  const symptomFreq = {};
  for (const s of symptomList) {
    const name = s.symptom_name || 'General';
    if (!symptomFreq[name]) {
      symptomFreq[name] = { count: 0, totalSeverity: 0 };
    }
    symptomFreq[name].count += 1;
    symptomFreq[name].totalSeverity += s.severity;
  }
  const frequentSymptoms = Object.entries(symptomFreq)
    .map(([name, data]) => ({
      name,
      count: data.count,
      average_severity: Number((data.totalSeverity / data.count).toFixed(1)),
    }))
    .sort((a, b) => b.count - a.count);

  // Text / sentiment analysis
  const textAnalysis = analyzeTextSentiment(allNotes);

  // Evidence-based key patterns
  const keyPatterns = [];
  keyPatterns.push(
    `Your average mood score is ${avgMood} / 10 across ${totalEntries} recorded check-ins (${moodDirection.toLowerCase()} trajectory).`
  );

  if (stressDirection === 'Improving') {
    keyPatterns.push(`Stress levels showed a notable decrease in your recent check-ins, averaging ${avgStress} / 10.`);
  } else if (stressDirection === 'Worsening') {
    keyPatterns.push(`Stress levels have elevated in recent entries, averaging ${avgStress} / 10 compared with earlier records.`);
  } else {
    keyPatterns.push(`Stress levels have remained relatively stable, averaging ${avgStress} / 10.`);
  }

  keyPatterns.push(
    `Energy levels average ${avgEnergy} / 10, with "${dominantEmotion}" being your most frequently logged emotional state (${maxEmotionCount} time${maxEmotionCount === 1 ? '' : 's'}).`
  );

  if (frequentSymptoms.length > 0) {
    const topSymptom = frequentSymptoms[0];
    keyPatterns.push(
      `Most frequently logged symptom: ${topSymptom.name} (${topSymptom.count} time${topSymptom.count === 1 ? '' : 's'}, average severity ${topSymptom.average_severity} / 10).`
    );
  }

  if (assessmentList.length > 0) {
    const latestAss = assessmentList[0];
    keyPatterns.push(
      `Latest clinical assessment indicated "${latestAss.result_category}" (total score ${latestAss.total_score}).`
    );
  }

  // Evidence-based wellness recommendations
  const recommendations = [];

  if (avgStress >= 6 || stressDirection === 'Worsening') {
    recommendations.push(
      'Try short 3- to 5-minute diaphragmatic breathing or progressive muscle relaxation during stressful moments.'
    );
    recommendations.push(
      'Consider scheduling structured breaks between tasks to reduce continuous mental pressure.'
    );
  } else {
    recommendations.push(
      'Continue engaging in relaxation practices or pacing strategies that help keep your stress balanced.'
    );
  }

  if (avgEnergy <= 5 || energyDirection === 'Worsening') {
    recommendations.push(
      'Maintain consistent sleep and wake times, and consider a short outdoor walk in natural light to support steady energy.'
    );
  } else {
    recommendations.push(
      'Keep up regular physical hydration and movement routines that appear to sustain your current energy.'
    );
  }

  if (overallTrend === 'Improving') {
    recommendations.push(
      'Notice what positive routines or self-care habits contributed to this upward trend and continue incorporating them into your week.'
    );
  } else if (overallTrend === 'Worsening') {
    recommendations.push(
      'Be gentle with yourself during challenging periods; prioritize restorative rest and reach out to supportive friends or your care team.'
    );
  } else {
    recommendations.push(
      'Consistent daily check-ins remain valuable for recognizing subtle shifts in your mood and physical wellbeing.'
    );
  }

  if (frequentSymptoms.length > 0) {
    recommendations.push(
      `Keep track of any contextual triggers for ${frequentSymptoms[0].name} to review together during your next healthcare consultation.`
    );
  }

  // Build summary string
  let summary = '';
  if (overallTrend === 'Improving') {
    summary = `Your overall wellbeing trend appears to be improving, with a steady average mood of ${avgMood} / 10 and favorable stress levels.`;
  } else if (overallTrend === 'Worsening') {
    summary = `Your recent entries reflect higher stress or lower energy compared with earlier check-ins. Take time for extra self-care and pacing.`;
  } else if (overallTrend === 'Mixed') {
    summary = `Your wellbeing indicators present a mixed pattern, with fluctuating mood and stress levels across your recorded entries.`;
  } else {
    summary = `Your overall wellbeing patterns appear stable, with consistent mood (${avgMood} / 10) and steady energy levels.`;
  }

  return {
    has_sufficient_data: true,
    summary,
    trend: overallTrend,
    average_mood: avgMood,
    average_stress: avgStress,
    average_energy: avgEnergy,
    mood_direction: moodDirection,
    stress_direction: stressDirection,
    energy_direction: energyDirection,
    dominant_emotion: dominantEmotion,
    sentiment: textAnalysis.sentiment,
    emotional_indicators: textAnalysis.emotional_indicators,
    key_patterns: keyPatterns,
    recommendations,
    frequent_symptoms: frequentSymptoms,
    safety_message: safetyMessage,
    data_points: {
      checkins: totalEntries,
      symptoms: symptomList.length,
      assessments: assessmentList.length,
    },
  };
}

/**
 * AI Service Provider - Generates insights via Gemini if GEMINI_API_KEY is present,
 * or gracefully returns the deterministic statistical pattern analysis.
 */
let genAIClient = null;
let geminiProjectDenied = false;
let lastTestedApiKey = null;

function getGenAI() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  // If the API key changes (e.g. user updates key in Settings), reset denial status
  if (key !== lastTestedApiKey) {
    lastTestedApiKey = key;
    geminiProjectDenied = false;
    genAIClient = null;
  }

  // If the current project/key has been denied access or disabled, skip external calls
  if (geminiProjectDenied) {
    return null;
  }

  if (!genAIClient) {
    genAIClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return genAIClient;
}

export async function generateAIAnalysis(moodList = [], symptomList = [], assessmentList = []) {
  // 1. Run local baseline statistical & pattern analysis first
  const baseResult = analyzePatterns(moodList, symptomList, assessmentList);

  // If there is insufficient data or an immediate safety alert, do not alter with LLM
  if (!baseResult.has_sufficient_data || baseResult.safety_message) {
    return baseResult;
  }

  const ai = getGenAI();
  if (!ai) {
    // Graceful fallback to explainable rule-based analysis
    return baseResult;
  }

  // 2. Enhance summary and nuance using Gemini 3.8 Flash if API key is permitted
  try {
    const prompt = `You are an AI wellness assistant providing supportive, non-diagnostic mental health reflections for a patient.
Here is the patient's verified historical data:
- Check-in count: ${baseResult.data_points.checkins}
- Average Mood: ${baseResult.average_mood} / 10 (Trend: ${baseResult.mood_direction})
- Average Stress: ${baseResult.average_stress} / 10 (Trend: ${baseResult.stress_direction})
- Average Energy: ${baseResult.average_energy} / 10 (Trend: ${baseResult.energy_direction})
- Overall Trend: ${baseResult.trend}
- Dominant Emotional State: ${baseResult.dominant_emotion}
- Notes Sentiment: ${baseResult.sentiment}
- Emotional Indicators: ${baseResult.emotional_indicators.join(', ') || 'None detected'}
- Top Symptoms: ${baseResult.frequent_symptoms.map(s => `${s.name} (sev ${s.average_severity})`).join(', ') || 'None reported'}

CRITICAL RULES:
1. STRICTLY NON-DIAGNOSTIC: NEVER diagnose depression, anxiety disorder, bipolar disorder, PTSD, or any medical condition.
2. NO PRESCRIPTIONS: NEVER prescribe medications, medical therapies, or clinical treatment plans.
3. GROUNDED IN DATA: Do NOT invent fake data. Base every observation only on the provided stats.
4. Keep insights short, supportive, warm, and empowering.
5. Return ONLY a valid JSON object matching this schema:
{
  "summary": "1 to 2 sentences summarizing the patient's wellbeing pattern compassionately.",
  "key_patterns": ["3 to 4 concise bullet observations based strictly on their scores and symptoms."],
  "recommendations": ["3 to 4 safe, practical daily wellness suggestions (sleep, breaks, light activity, mindfulness)."]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text?.trim() || '{}');
    if (parsed.summary && Array.isArray(parsed.key_patterns) && Array.isArray(parsed.recommendations)) {
      return {
        ...baseResult,
        summary: parsed.summary,
        key_patterns: parsed.key_patterns,
        recommendations: parsed.recommendations,
      };
    }
  } catch (err) {
    // If Gemini call fails (e.g. 403 PERMISSION_DENIED / project denied access / quota / network),
    // mark access as restricted to avoid repeated failing calls and cleanly return verified statistical analysis
    const errMsg = String(err?.message || '');
    if (err?.status === 403 || errMsg.includes('403') || errMsg.includes('PERMISSION_DENIED') || errMsg.includes('denied access')) {
      geminiProjectDenied = true;
    }
  }

  return baseResult;
}
