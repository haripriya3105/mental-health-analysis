from sqlalchemy import select
from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends, HTTPException, status
from app.database import get_db
from app.models import Assessment, AssessmentAnswer, AssessmentQuestion, User, UserRole
from app.schemas import AssessmentHistoryItem, AssessmentQuestionResponse, AssessmentResultResponse, AssessmentSubmitRequest
from app.security import require_role

router = APIRouter(prefix="/api/assessment", tags=["Assessment"])
PATIENT_ONLY = Depends(require_role(UserRole.PATIENT))

def category_for_score(score: int) -> tuple[str, str]:
    if score <= 5:
        return "LOWER CONCERN", "Your responses currently show relatively few signs of emotional difficulty. Continue noticing the routines and support that help you feel well."
    if score <= 11:
        return "MILD CONCERN", "Your responses show some areas that may benefit from additional self-care and monitoring."
    if score <= 17:
        return "MODERATE CONCERN", "Your responses suggest that you may benefit from additional support and speaking with a qualified professional."
    return "HIGHER CONCERN", "Your responses indicate that seeking support from a qualified mental health professional may be especially helpful."

@router.get("/questions", response_model=list[AssessmentQuestionResponse])
def get_questions(_: User = PATIENT_ONLY, db: Session = Depends(get_db)):
    return list(db.scalars(select(AssessmentQuestion).order_by(AssessmentQuestion.question_order)))

@router.post("/submit", response_model=AssessmentResultResponse, status_code=status.HTTP_201_CREATED)
def submit_assessment(payload: AssessmentSubmitRequest, current_user: User = PATIENT_ONLY, db: Session = Depends(get_db)):
    questions = list(db.scalars(select(AssessmentQuestion).order_by(AssessmentQuestion.question_order)))
    supplied_ids = [answer.question_id for answer in payload.answers]
    expected_ids = [question.id for question in questions]
    if len(supplied_ids) != len(set(supplied_ids)) or set(supplied_ids) != set(expected_ids):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Please answer every assessment question exactly once.")
    total_score = sum(answer.answer_value for answer in payload.answers)
    category, guidance = category_for_score(total_score)
    assessment = Assessment(patient_id=current_user.id, total_score=total_score, result_category=category)
    db.add(assessment); db.flush()
    db.add_all([AssessmentAnswer(assessment_id=assessment.id, question_id=answer.question_id, answer_value=answer.answer_value) for answer in payload.answers])
    db.commit(); db.refresh(assessment)
    return AssessmentResultResponse(id=assessment.id, total_score=total_score, result_category=category, guidance=guidance, created_at=assessment.created_at)

@router.get("/history", response_model=list[AssessmentHistoryItem])
def get_history(current_user: User = PATIENT_ONLY, db: Session = Depends(get_db)):
    return list(db.scalars(select(Assessment).where(Assessment.patient_id == current_user.id).order_by(Assessment.created_at.desc())))
