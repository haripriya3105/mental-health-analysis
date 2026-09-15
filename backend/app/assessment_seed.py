from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models import AssessmentQuestion

INITIAL_QUESTIONS = [
    ("In the past two weeks, how often have you felt emotionally overwhelmed?", "emotional wellbeing"),
    ("In the past two weeks, how often have you had difficulty relaxing after a busy day?", "stress"),
    ("In the past two weeks, how often have you had low energy for your usual activities?", "energy"),
    ("In the past two weeks, how often have you found it difficult to focus on everyday tasks?", "focus"),
    ("In the past two weeks, how often have you felt disconnected from people around you?", "connection"),
    ("In the past two weeks, how often have sleep difficulties affected your wellbeing?", "sleep"),
    ("In the past two weeks, how often have you felt unable to manage everyday pressures?", "coping"),
    ("In the past two weeks, how often have you been worried about your general wellbeing?", "wellness"),
]

def seed_assessment_questions(db: Session) -> None:
    if db.scalar(select(AssessmentQuestion.id).limit(1)):
        return
    db.add_all([AssessmentQuestion(question_text=text, category=category, question_order=index) for index, (text, category) in enumerate(INITIAL_QUESTIONS, start=1)])
    db.commit()
