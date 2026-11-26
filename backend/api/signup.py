from fastapi import APIRouter
from ..models.model import SignupRequest
from fastapi import HTTPException
from ..services.activity_type_defaults import create_default_activity_types
from ..services.body_part_defaults import create_default_body_parts
from ..services.config import admin_supabase
from ..services.muscle_group_defaults import create_default_muscle_groups

router=APIRouter()

@router.post("/signup")
def signup_user(payload: SignupRequest):
    try:
        response=admin_supabase.auth.admin.create_user({
            "email":payload.email,
            "password":payload.password,
            "email_confirm":True,
            "user_metadata":{"full_name":payload.name}
        })
        if not response.user:
            raise HTTPException(status_code=400,detail="Failed to create user")
        user_id=response.user.id
        
        admin_supabase.table("users").insert({
            "user_id":user_id,
            "user_name":payload.name,
            "email":payload.email
        }).execute()

        create_default_activity_types(user_id)
        body_part_ids = create_default_body_parts(user_id)
        create_default_muscle_groups(user_id, body_part_ids)
        
        return {"message":"User Created Successsfully","user_id":user_id}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400,detail=str(e))
    
    
    
    
