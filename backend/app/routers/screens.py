from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user
from app.models import Screen, User
from app.schemas import ScreenOut

router = APIRouter(prefix="/screens", tags=["screens"])


@router.get("", response_model=list[ScreenOut])
async def list_screens(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[Screen]:
    result = await db.execute(select(Screen).order_by(Screen.category, Screen.name))
    return list(result.scalars().all())
