from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from app.models import UserRole
class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: UserRole
class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)
class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    email: EmailStr
    role: UserRole
class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class AssessmentQuestionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    question_text: str
    category: str
    question_order: int
class AssessmentAnswerInput(BaseModel):
    question_id: int
    answer_value: int = Field(ge=0, le=3)
class AssessmentSubmitRequest(BaseModel):
    answers: list[AssessmentAnswerInput] = Field(min_length=1)
class AssessmentResultResponse(BaseModel):
    id: int
    total_score: int
    result_category: str
    guidance: str
    created_at: datetime
class AssessmentHistoryItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    total_score: int
    result_category: str
    created_at: datetime

class MoodCreateRequest(BaseModel):
    mood_score: int = Field(ge=1, le=10)
    stress_level: int = Field(ge=1, le=10)
    energy_level: int = Field(ge=1, le=10)
    emotional_state: str = Field(min_length=1, max_length=50)
    notes: str | None = Field(default=None, max_length=2000)

class MoodResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    patient_id: int
    mood_score: int
    stress_level: int
    energy_level: int
    emotional_state: str
    notes: str | None = None
    created_at: datetime

class SymptomCreateRequest(BaseModel):
    symptom_name: str = Field(min_length=1, max_length=100)
    severity: int = Field(ge=1, le=10)
    notes: str | None = Field(default=None, max_length=2000)

class SymptomResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    patient_id: int
    symptom_name: str
    severity: int
    notes: str | None = None
    created_at: datetime


class AnalysisResponse(BaseModel):
    has_sufficient_data: bool
    summary: str
    trend: str
    average_mood: float | None = None
    average_stress: float | None = None
    average_energy: float | None = None
    mood_direction: str | None = None
    stress_direction: str | None = None
    energy_direction: str | None = None
    dominant_emotion: str
    sentiment: str
    emotional_indicators: list[str] = []
    key_patterns: list[str] = []
    recommendations: list[str] = []
    frequent_symptoms: list[dict] = []
    safety_message: str | None = None

