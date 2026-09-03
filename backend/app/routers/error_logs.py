import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.db import get_db
from app.deps import get_current_user, require_role
from app.models import ErrorLog, ErrorLogAttachment, ErrorLogStatusHistory, ErrorStatus, User, UserRole
from app.schemas import (
    AttachmentOut,
    ErrorLogCreate,
    ErrorLogDetail,
    ErrorLogListItem,
    ErrorLogUpdate,
    StatusUpdate,
)

router = APIRouter(prefix="/error-logs", tags=["error-logs"])

_DETAIL_OPTIONS = (
    selectinload(ErrorLog.screen),
    selectinload(ErrorLog.reported_by),
    selectinload(ErrorLog.assigned_to),
    selectinload(ErrorLog.attachments),
    selectinload(ErrorLog.status_history).selectinload(ErrorLogStatusHistory.changed_by),
)


async def _get_or_404(db: AsyncSession, error_log_id: uuid.UUID) -> ErrorLog:
    result = await db.execute(select(ErrorLog).where(ErrorLog.id == error_log_id).options(*_DETAIL_OPTIONS))
    error_log = result.scalar_one_or_none()
    if error_log is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Error log not found")
    return error_log


@router.get("", response_model=list[ErrorLogListItem])
async def list_error_logs(
    status_filter: ErrorStatus | None = None,
    screen_id: int | None = None,
    assigned_to_id: uuid.UUID | None = None,
    priority: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[ErrorLog]:
    query = select(ErrorLog).options(
        selectinload(ErrorLog.screen),
        selectinload(ErrorLog.reported_by),
        selectinload(ErrorLog.assigned_to),
    )
    if status_filter is not None:
        query = query.where(ErrorLog.status == status_filter)
    if screen_id is not None:
        query = query.where(ErrorLog.screen_id == screen_id)
    if assigned_to_id is not None:
        query = query.where(ErrorLog.assigned_to_id == assigned_to_id)
    if priority is not None:
        query = query.where(ErrorLog.priority == priority)

    query = query.order_by(ErrorLog.created_at.desc())
    result = await db.execute(query)
    return list(result.scalars().all())


@router.post("", response_model=ErrorLogDetail, status_code=status.HTTP_201_CREATED)
async def create_error_log(
    payload: ErrorLogCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ErrorLog:
    error_log = ErrorLog(
        title=payload.title,
        description=payload.description,
        screen_id=payload.screen_id,
        screen_name_freetext=payload.screen_name_freetext,
        priority=payload.priority,
        assigned_to_id=payload.assigned_to_id,
        reported_by_id=current_user.id,
    )
    db.add(error_log)
    await db.flush()

    db.add(
        ErrorLogStatusHistory(
            error_log_id=error_log.id,
            old_status=None,
            new_status=error_log.status,
            changed_by_id=current_user.id,
        )
    )
    await db.commit()
    return await _get_or_404(db, error_log.id)


@router.get("/{error_log_id}", response_model=ErrorLogDetail)
async def get_error_log(
    error_log_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> ErrorLog:
    return await _get_or_404(db, error_log_id)


@router.put("/{error_log_id}", response_model=ErrorLogDetail)
async def update_error_log(
    error_log_id: uuid.UUID,
    payload: ErrorLogUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> ErrorLog:
    error_log = await _get_or_404(db, error_log_id)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(error_log, field, value)

    await db.commit()
    return await _get_or_404(db, error_log_id)


@router.patch("/{error_log_id}/status", response_model=ErrorLogDetail)
async def update_status(
    error_log_id: uuid.UUID,
    payload: StatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ErrorLog:
    error_log = await _get_or_404(db, error_log_id)
    old_status = error_log.status
    error_log.status = payload.status

    db.add(
        ErrorLogStatusHistory(
            error_log_id=error_log.id,
            old_status=old_status,
            new_status=payload.status,
            changed_by_id=current_user.id,
        )
    )
    await db.commit()
    return await _get_or_404(db, error_log_id)


@router.delete("/{error_log_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_error_log(
    error_log_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.SUPER_ADMIN)),
) -> None:
    error_log = await _get_or_404(db, error_log_id)
    for attachment in error_log.attachments:
        Path(attachment.file_path).unlink(missing_ok=True)
    await db.delete(error_log)
    await db.commit()


@router.post("/{error_log_id}/attachments", response_model=list[AttachmentOut], status_code=status.HTTP_201_CREATED)
async def upload_attachments(
    error_log_id: uuid.UUID,
    files: list[UploadFile],
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[ErrorLogAttachment]:
    error_log = await _get_or_404(db, error_log_id)

    target_dir = Path(settings.attachments_dir) / str(error_log.id)
    target_dir.mkdir(parents=True, exist_ok=True)

    created: list[ErrorLogAttachment] = []
    for upload in files:
        stored_name = f"{uuid.uuid4()}_{upload.filename}"
        dest_path = target_dir / stored_name
        content = await upload.read()
        dest_path.write_bytes(content)

        attachment = ErrorLogAttachment(
            error_log_id=error_log.id,
            file_path=str(dest_path),
            original_filename=upload.filename or stored_name,
            content_type=upload.content_type or "application/octet-stream",
            size_bytes=len(content),
        )
        db.add(attachment)
        created.append(attachment)

    await db.commit()
    for attachment in created:
        await db.refresh(attachment)
    return created


@router.get("/attachments/{attachment_id}/download")
async def download_attachment(
    attachment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> FileResponse:
    attachment = (
        await db.execute(select(ErrorLogAttachment).where(ErrorLogAttachment.id == attachment_id))
    ).scalar_one_or_none()
    if attachment is None or not Path(attachment.file_path).exists():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Attachment not found")

    return FileResponse(
        path=attachment.file_path,
        filename=attachment.original_filename,
        media_type=attachment.content_type,
    )
