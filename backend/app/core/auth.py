"""Autenticação via JWT do Supabase (middleware FastAPI)."""
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from app.integrations.supabase import get_supabase

_bearer = HTTPBearer(auto_error=True)


class CurrentUser(BaseModel):
    id: str
    email: str | None = None
    role: str = "authenticated"


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
) -> CurrentUser:
    token = credentials.credentials

    try:
        supabase = await get_supabase()
        response = await supabase.auth.get_user(token)
        user = response.user
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token sem identificador de usuário",
        )

    return CurrentUser(
        id=str(user.id),
        email=user.email,
        role=getattr(user, "role", "authenticated") or "authenticated",
    )


AuthUser = Annotated[CurrentUser, Depends(get_current_user)]
