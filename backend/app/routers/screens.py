from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user
from app.models import ErrorLog, Screen, User
from app.schemas import ScreenOut

router = APIRouter(prefix="/screens", tags=["screens"])


@router.get("", response_model=list[ScreenOut])
async def list_screens(
    used_only: bool = False,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[Screen]:
    query = select(Screen).order_by(Screen.category, Screen.name)
    if used_only:
        query = query.where(
            Screen.id.in_(select(ErrorLog.screen_id).distinct().where(ErrorLog.screen_id.is_not(None)))
        )
    result = await db.execute(query)
    return list(result.scalars().all())
