import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased, selectinload
from sqlalchemy.sql import Select

from app.config import settings
from app.db import get_db
from app.deps import get_current_user, require_role
from app.models import (
    ErrorLog,
    ErrorLogAttachment,
    ErrorLogStatusHistory,
    ErrorStatus,
    Notification,
    NotificationType,
    Screen,
    User,
    UserRole,
)
from app.schemas import (
    AttachmentOut,
    ErrorLogCreate,
    ErrorLogDetail,
    ErrorLogListItem,
    ErrorLogPage,
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


async def _notify_assignment(db: AsyncSession, error_log: ErrorLog, actor: User) -> None:
    if error_log.assigned_to_id is None or error_log.assigned_to_id == actor.id:
        return
    db.add(
        Notification(
            user_id=error_log.assigned_to_id,
            error_log_id=error_log.id,
            type=NotificationType.ASSIGNED,
            message=f'{actor.name} assigned "{error_log.title}" to you',
        )
    )


async def _notify_new_error_log(db: AsyncSession, error_log: ErrorLog, actor: User) -> None:
    await _notify_assignment(db, error_log, actor)

    exclude_ids = {actor.id}
    if error_log.assigned_to_id is not None:
        exclude_ids.add(error_log.assigned_to_id)

    recipients = (
        await db.execute(select(User.id).where(User.is_active.is_(True), User.id.notin_(exclude_ids)))
    ).scalars().all()
    for user_id in recipients:
        db.add(
            Notification(
                user_id=user_id,
                error_log_id=error_log.id,
                type=NotificationType.CREATED,
                message=f'{actor.name} logged a new error: "{error_log.title}"',
            )
        )


def _filtered_query(
    query: Select,
    status_filter: ErrorStatus | None,
    screen_id: int | None,
    assigned_to_id: uuid.UUID | None,
    priority: str | None,
    environment: str | None,
    search: str | None,
) -> Select:
    if status_filter is not None:
        query = query.where(ErrorLog.status == status_filter)
    if screen_id is not None:
        query = query.where(ErrorLog.screen_id == screen_id)
    if assigned_to_id is not None:
        query = query.where(ErrorLog.assigned_to_id == assigned_to_id)
    if priority is not None:
        query = query.where(ErrorLog.priority == priority)
    if environment is not None:
        query = query.where(ErrorLog.environment == environment)
    if search:
        term = f"%{search}%"
        reported_by = aliased(User)
        assigned_to = aliased(User)
        query = (
            query.join(reported_by, ErrorLog.reported_by)
            .outerjoin(assigned_to, ErrorLog.assigned_to)
            .outerjoin(Screen, ErrorLog.screen)
            .where(
                or_(
                    ErrorLog.title.ilike(term),
                    ErrorLog.description.ilike(term),
                    ErrorLog.screen_name_freetext.ilike(term),
                    Screen.name.ilike(term),
                    reported_by.name.ilike(term),
                    reported_by.email.ilike(term),
                    assigned_to.name.ilike(term),
                    assigned_to.email.ilike(term),
                    cast(ErrorLog.status, String).ilike(term),
                    cast(ErrorLog.priority, String).ilike(term),
                    cast(ErrorLog.environment, String).ilike(term),
                )
            )
        )
    return query


@router.get("", response_model=ErrorLogPage)
async def list_error_logs(
    status_filter: ErrorStatus | None = None,
    screen_id: int | None = None,
    assigned_to_id: uuid.UUID | None = None,
    priority: str | None = None,
    environment: str | None = None,
    search: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> ErrorLogPage:
    count_query = _filtered_query(
        select(func.count(ErrorLog.id)), status_filter, screen_id, assigned_to_id, priority, environment, search
    )
    total = (await db.execute(count_query)).scalar_one()

    query = _filtered_query(
        select(ErrorLog).options(
            selectinload(ErrorLog.screen),
            selectinload(ErrorLog.reported_by),
            selectinload(ErrorLog.assigned_to),
        ),
        status_filter,
        screen_id,
        assigned_to_id,
        priority,
        environment,
        search,
    )
    # Priority is declared LOW < MEDIUM < HIGH < CRITICAL, so descending puts the highest-severity items on top.
    query = query.order_by(ErrorLog.priority.desc(), ErrorLog.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    items = list(result.scalars().all())
    total_pages = (total + page_size - 1) // page_size if page_size else 0

    return ErrorLogPage(items=items, total=total, page=page, page_size=page_size, total_pages=total_pages)


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
        environment=payload.environment,
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
    await _notify_new_error_log(db, error_log, current_user)
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
    current_user: User = Depends(get_current_user),
) -> ErrorLog:
    error_log = await _get_or_404(db, error_log_id)
    old_assigned_to_id = error_log.assigned_to_id

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(error_log, field, value)

    if "assigned_to_id" in updates and error_log.assigned_to_id != old_assigned_to_id:
        await _notify_assignment(db, error_log, current_user)

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
