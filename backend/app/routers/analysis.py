from collections import Counter
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Assessment, MoodEntry, SymptomEntry, User, UserRole
from app.schemas import AnalysisResponse
from app.security import get_current_user

router = APIRouter(prefix="/api/analysis", tags=["analysis"])

CRISIS_KEYWORDS = [
    "suicide", "kill myself", "end my life", "want to die", "self-harm",
    "hurt myself", "cutting myself", "overdose", "don't want to live", "end it all"
]

POSITIVE_WORDS = {
    "happy", "joy", "joyful", "great", "good", "wonderful", "calm", "peaceful",
    "energetic", "relaxed", "refreshed", "hopeful", "optimistic", "better",
    "pleased", "loved", "grateful", "motivated", "strong", "rested", "content"
}

NEGATIVE_WORDS = {
    "sad", "down", "unhappy", "anxious", "worry", "worried", "nervous", "stressed",
    "overwhelm", "overwhelmed", "frustrated", "angry", "mad", "irritated", "tired",
    "exhausted", "fatigued", "draining", "pain", "hurt", "hopeless", "lonely"
}

EMOTIONAL_INDICATORS = {
    "Calm": ["calm", "peaceful", "relaxed", "quiet", "tranquil"],
    "Sad": ["sad", "down", "tearful", "grief", "blue", "sorrow"],
    "Anxious": ["anxious", "worry", "worried", "panic", "nervous", "uneasy"],
    "Angry": ["angry", "mad", "frustrated", "annoyed", "irritated"],
    "Stressed": ["stressed", "pressure", "overwhelmed", "overwhelm", "tense"],
    "Tired": ["tired", "exhausted", "fatigued", "sleepy", "draining", "drained"],
    "Positive/hopeful": ["hopeful", "optimistic", "grateful", "happy", "motivated"],
}

def ensure_patient(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.PATIENT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    return user

@router.get("", response_model=AnalysisResponse)
def get_patient_analysis(
    db: Session = Depends(get_db),
    user: User = Depends(ensure_patient),
):
    moods = db.scalars(
        select(MoodEntry).where(MoodEntry.patient_id == user.id).order_by(MoodEntry.created_at.asc())
    ).all()
    symptoms = db.scalars(
        select(SymptomEntry).where(SymptomEntry.patient_id == user.id).order_by(desc(SymptomEntry.created_at))
    ).all()
    assessments = db.scalars(
        select(Assessment).where(Assessment.patient_id == user.id).order_by(desc(Assessment.created_at))
    ).all()

    # Crisis check
    safety_message = None
    all_notes = []
    for m in moods:
        if m.notes:
            all_notes.append(m.notes)
            if any(k in m.notes.lower() for k in CRISIS_KEYWORDS) and not safety_message:
                safety_message = "Important Safety Notice: If you are experiencing immediate crisis, thoughts of self-harm, or severe distress, please reach out right away to the Suicide & Crisis Lifeline at 988, a trusted person, or emergency services. AI insights are not a substitute for clinical or emergency support."
    for s in symptoms:
        if s.notes:
            all_notes.append(s.notes)
            if any(k in s.notes.lower() for k in CRISIS_KEYWORDS) and not safety_message:
                safety_message = "Important Safety Notice: If you are experiencing immediate crisis, thoughts of self-harm, or severe distress, please reach out right away to the Suicide & Crisis Lifeline at 988, a trusted person, or emergency services. AI insights are not a substitute for clinical or emergency support."

    if len(moods) < 2:
        single = moods[0] if moods else None
        return AnalysisResponse(
            has_sufficient_data=False,
            summary="Not enough data yet. Continue completing your daily check-ins to receive meaningful insights.",
            trend="Insufficient data",
            average_mood=float(single.mood_score) if single else None,
            average_stress=float(single.stress_level) if single else None,
            average_energy=float(single.energy_level) if single else None,
            dominant_emotion=single.emotional_state if single else "—",
            sentiment="Neutral",
            emotional_indicators=[],
            key_patterns=["At least two daily check-in records are required to calculate trend trajectories and comparative patterns."],
            recommendations=[
                "Take a moment each day to log your mood, stress, and energy to build an informative wellness picture.",
                "Note any factors such as rest, activities, or conversations that seem to support your wellbeing."
            ],
            frequent_symptoms=[],
            safety_message=safety_message,
        )

    # Calculate metrics
    n = len(moods)
    avg_m = round(sum(m.mood_score for m in moods) / n, 1)
    avg_s = round(sum(m.stress_level for m in moods) / n, 1)
    avg_e = round(sum(m.energy_level for m in moods) / n, 1)

    split = n // 2
    early = moods[:split]
    recent = moods[split:]

    delta_m = (sum(m.mood_score for m in recent) / len(recent)) - (sum(m.mood_score for m in early) / len(early))
    delta_s = (sum(m.stress_level for m in recent) / len(recent)) - (sum(m.stress_level for m in early) / len(early))
    delta_e = (sum(m.energy_level for m in recent) / len(recent)) - (sum(m.energy_level for m in early) / len(early))

    m_dir = "Improving" if delta_m >= 0.5 else ("Worsening" if delta_m <= -0.5 else "Stable")
    s_dir = "Improving" if delta_s <= -0.5 else ("Worsening" if delta_s >= 0.5 else "Stable")
    e_dir = "Improving" if delta_e >= 0.5 else ("Worsening" if delta_e <= -0.5 else "Stable")

    trend = "Stable"
    if m_dir == "Improving" and s_dir != "Worsening":
        trend = "Improving"
    elif m_dir == "Worsening" and s_dir == "Worsening":
        trend = "Worsening"
    elif (m_dir == "Improving" and s_dir == "Worsening") or (m_dir == "Worsening" and s_dir == "Improving"):
        trend = "Mixed"

    # Emotion & sentiment
    emotions = [m.emotional_state for m in moods if m.emotional_state]
    dominant = Counter(emotions).most_common(1)[0][0] if emotions else "Calm"

    combined_text = " ".join(all_notes).lower()
    words = combined_text.split()
    pos_count = sum(1 for w in words if w in POSITIVE_WORDS)
    neg_count = sum(1 for w in words if w in NEGATIVE_WORDS)

    sentiment = "Neutral"
    if pos_count > neg_count + 1:
        sentiment = "Positive"
    elif neg_count > pos_count + 1:
        sentiment = "Negative"
    elif pos_count > 0 and neg_count > 0:
        sentiment = "Mixed"

    indicators = [
        ind for ind, terms in EMOTIONAL_INDICATORS.items()
        if any(term in combined_text for term in terms)
    ]

    # Symptoms
    symptom_counts = Counter(s.symptom_name for s in symptoms)
    frequent = [
        {"name": name, "count": count, "average_severity": round(sum(s.severity for s in symptoms if s.symptom_name == name) / count, 1)}
        for name, count in symptom_counts.most_common(3)
    ]

    key_patterns = [
        f"Your average mood score is {avg_m} / 10 across {n} check-ins ({m_dir.lower()} trajectory).",
        f"Stress levels average {avg_s} / 10 with a {s_dir.lower()} pattern.",
        f"Energy levels average {avg_e} / 10, with '{dominant}' being your most frequently logged state."
    ]
    if frequent:
        top = frequent[0]
        key_patterns.append(f"Most frequent symptom logged: {top['name']} ({top['count']} times, avg severity {top['average_severity']}/10).")

    recommendations = []
    if avg_s >= 6 or s_dir == "Worsening":
        recommendations.append("Practice gentle 3-to-5 minute diaphragmatic breathing or grounding techniques when stress rises.")
        recommendations.append("Consider taking regular structured breaks between demanding tasks.")
    else:
        recommendations.append("Continue current daily routines that help keep stress in a comfortable range.")

    if avg_e <= 5 or e_dir == "Worsening":
        recommendations.append("Maintain consistent sleep and meal routines, and try light physical movement outdoors.")
    else:
        recommendations.append("Keep up steady hydration and physical activity routines that support your energy.")

    if trend == "Improving":
        recommendations.append("Reflect on the helpful activities and routines that contributed to your positive trend.")
    else:
        recommendations.append("Keep logging daily check-ins to monitor subtle shifts in your mood and physical wellbeing.")

    summary = f"Your overall wellbeing trend appears {trend.lower()}, with an average mood of {avg_m} / 10 and steady self-check-ins."

    return AnalysisResponse(
        has_sufficient_data=True,
        summary=summary,
        trend=trend,
        average_mood=avg_m,
        average_stress=avg_s,
        average_energy=avg_e,
        mood_direction=m_dir,
        stress_direction=s_dir,
        energy_direction=e_dir,
        dominant_emotion=dominant,
        sentiment=sentiment,
        emotional_indicators=indicators,
        key_patterns=key_patterns,
        recommendations=recommendations,
        frequent_symptoms=frequent,
        safety_message=safety_message,
    )
