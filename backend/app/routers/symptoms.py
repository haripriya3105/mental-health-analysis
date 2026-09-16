from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import SymptomEntry, User, UserRole
from app.schemas import SymptomCreateRequest, SymptomResponse
from app.security import get_current_user

router = APIRouter(prefix="/api/symptoms", tags=["symptoms"])

def ensure_patient(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.PATIENT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    return user

@router.post("", response_model=SymptomResponse, status_code=status.HTTP_201_CREATED)
def create_symptom_entry(
    payload: SymptomCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(ensure_patient)
):
    entry = SymptomEntry(
        patient_id=user.id,
        symptom_name=payload.symptom_name.strip(),
        severity=payload.severity,
        notes=payload.notes,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry

@router.get("/history", response_model=list[SymptomResponse])
def get_symptom_history(
    db: Session = Depends(get_db),
    user: User = Depends(ensure_patient)
):
    stmt = select(SymptomEntry).where(SymptomEntry.patient_id == user.id).order_by(desc(SymptomEntry.created_at))
    return db.scalars(stmt).all()

@router.delete("/{symptom_id}", status_code=status.HTTP_200_OK)
def delete_symptom_entry(
    symptom_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(ensure_patient)
):
    entry = db.get(SymptomEntry, symptom_id)
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Symptom entry not found")
    if entry.patient_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot delete other patients' data")
    db.delete(entry)
    db.commit()
    return {"message": "Symptom entry deleted successfully", "id": symptom_id}
