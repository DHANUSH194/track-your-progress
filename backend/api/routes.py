from fastapi import APIRouter
from .activity_types import router as activity_types_router
from .body_parts import router as body_parts_router
from .exercises import router as exercises_router
from .health import router as health_router
from .muscle_groups import router as muscle_groups_router
from .signup import router as signup_router
from .login import router as login_router
from .session import router as session_router
from .tracker_catalog import router as tracker_catalog_router
from .workouts import router as workouts_router

router = APIRouter()
router.include_router(health_router,tags=["Health"])
router.include_router(activity_types_router,tags=["Activity Types"])
router.include_router(body_parts_router,tags=["Body Parts"])
router.include_router(exercises_router,tags=["Exercises"])
router.include_router(muscle_groups_router,tags=["Muscle Groups"])
router.include_router(tracker_catalog_router,tags=["Tracker Catalog"])
router.include_router(workouts_router,tags=["Workouts"])
router.include_router(signup_router,tags=["Users"])
router.include_router(login_router,tags=["Users"])
router.include_router(session_router,tags=["Users"])