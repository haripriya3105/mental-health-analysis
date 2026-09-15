from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.routers.auth import router as auth_router
from app.routers.assessment import router as assessment_router
from app.database import SessionLocal
from app.assessment_seed import seed_assessment_questions

app = FastAPI(title="AI-Powered Mental Health Analysis API")

app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
Base.metadata.create_all(bind=engine)
with SessionLocal() as db:
    seed_assessment_questions(db)
app.include_router(auth_router)
app.include_router(assessment_router)


@app.get("/health")
def health_check() -> dict[str, str]:
    """Return a simple status response for service verification."""
    return {"status": "ok"}
