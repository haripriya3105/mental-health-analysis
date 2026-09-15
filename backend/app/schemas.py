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
