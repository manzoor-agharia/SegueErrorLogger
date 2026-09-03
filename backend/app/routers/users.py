import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user, require_role
from app.models import User, UserRole
from app.schemas import UserOut, UserRoleUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserOut])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[User]:
    result = await db.execute(select(User).order_by(User.name))
    return list(result.scalars().all())


@router.put("/{user_id}/role", response_model=UserOut)
async def update_user_role(
    user_id: uuid.UUID,
    payload: UserRoleUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.SUPER_ADMIN)),
) -> User:
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    user.role = payload.role
    await db.commit()
    await db.refresh(user)
    return user
