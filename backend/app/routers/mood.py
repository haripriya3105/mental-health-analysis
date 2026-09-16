from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import MoodEntry, User, UserRole
from app.schemas import MoodCreateRequest, MoodResponse
from app.security import get_current_user

router = APIRouter(prefix="/api/mood", tags=["mood"])

def ensure_patient(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.PATIENT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    return user

@router.post("", response_model=MoodResponse, status_code=status.HTTP_201_CREATED)
def create_mood_entry(
    payload: MoodCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(ensure_patient)
):
    entry = MoodEntry(
        patient_id=user.id,
        mood_score=payload.mood_score,
        stress_level=payload.stress_level,
        energy_level=payload.energy_level,
        emotional_state=payload.emotional_state,
        notes=payload.notes,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry

@router.get("/history", response_model=list[MoodResponse])
def get_mood_history(
    db: Session = Depends(get_db),
    user: User = Depends(ensure_patient)
):
    stmt = select(MoodEntry).where(MoodEntry.patient_id == user.id).order_by(desc(MoodEntry.created_at))
    return db.scalars(stmt).all()

@router.get("/latest", response_model=MoodResponse | None)
def get_latest_mood(
    db: Session = Depends(get_db),
    user: User = Depends(ensure_patient)
):
    stmt = select(MoodEntry).where(MoodEntry.patient_id == user.id).order_by(desc(MoodEntry.created_at)).limit(1)
    return db.scalar(stmt)

@router.get("/trends")
def get_mood_trends(
    days: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db),
    user: User = Depends(ensure_patient)
):
    cutoff = datetime.utcnow() - timedelta(days=days)
    stmt = (
        select(MoodEntry)
        .where(MoodEntry.patient_id == user.id, MoodEntry.created_at >= cutoff)
        .order_by(MoodEntry.created_at.asc())
    )
    entries = db.scalars(stmt).all()
    return [
        {
            "id": e.id,
            "date": e.created_at.strftime("%Y-%m-%d"),
            "created_at": e.created_at.isoformat(),
            "mood_score": e.mood_score,
            "stress_level": e.stress_level,
            "energy_level": e.energy_level,
            "emotional_state": e.emotional_state,
        }
        for e in entries
    ]
