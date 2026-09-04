import uuid
from datetime import datetime, timezone
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
    ErrorLogAssignmentHistory,
    ErrorLogAttachment,
    ErrorLogComment,
    ErrorLogEditHistory,
    ErrorLogStatusHistory,
    ErrorPriority,
    ErrorStatus,
    Notification,
    NotificationType,
    Screen,
    User,
    UserRole,
)
from app.schemas import (
    AttachmentOut,
    CommentCreate,
    CommentOut,
    CommentUpdate,
    ErrorLogCreate,
    ErrorLogDetail,
    ErrorLogListItem,
    ErrorLogPage,
    ErrorLogUpdate,
    StatusUpdate,
)

router = APIRouter(prefix="/error-logs", tags=["error-logs"])

# Sentinel accepted by the `assigned_to_id` filter to mean "no assignee set", since the
# query param otherwise only ever carries a real user UUID.
UNASSIGNED_SENTINEL = "unassigned"

_DETAIL_OPTIONS = (
    selectinload(ErrorLog.screen),
    selectinload(ErrorLog.reported_by),
    selectinload(ErrorLog.assigned_to),
    selectinload(ErrorLog.attachments),
    selectinload(ErrorLog.status_history).selectinload(ErrorLogStatusHistory.changed_by),
    selectinload(ErrorLog.edit_history).selectinload(ErrorLogEditHistory.changed_by),
    selectinload(ErrorLog.comments).selectinload(ErrorLogComment.author),
    selectinload(ErrorLog.assignment_history),
)


def _can_comment(error_log: ErrorLog, user: User) -> bool:
    """Comments may be added by the log's creator, its current or any past assignee, or a SuperAdmin --
    once you've owned a ticket you keep a voice on it even after being unassigned."""
    if user.role == UserRole.SUPER_ADMIN:
        return True
    if error_log.reported_by_id == user.id:
        return True
    if error_log.assigned_to_id is not None and error_log.assigned_to_id == user.id:
        return True
    for entry in error_log.assignment_history:
        if entry.old_assigned_to_id == user.id or entry.new_assigned_to_id == user.id:
            return True
    return False


async def _get_or_404(db: AsyncSession, error_log_id: uuid.UUID) -> ErrorLog:
    result = await db.execute(select(ErrorLog).where(ErrorLog.id == error_log_id).options(*_DETAIL_OPTIONS))
    error_log = result.scalar_one_or_none()
    if error_log is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Error log not found")
    return error_log


def _to_detail(error_log: ErrorLog, current_user: User) -> ErrorLogDetail:
    detail = ErrorLogDetail.model_validate(error_log)
    detail.can_comment = _can_comment(error_log, current_user)
    return detail


async def _get_detail(db: AsyncSession, error_log_id: uuid.UUID, current_user: User) -> ErrorLogDetail:
    error_log = await _get_or_404(db, error_log_id)
    return _to_detail(error_log, current_user)


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


async def _describe_edit(db: AsyncSession, error_log: ErrorLog, updates: dict) -> list[str]:
    """Build human-readable change descriptions by comparing `updates` against `error_log`'s
    current (pre-mutation) values. Call this before applying the updates."""
    changes: list[str] = []

    if "title" in updates and updates["title"] != error_log.title:
        changes.append(f'Title: "{error_log.title}" → "{updates["title"]}"')

    if "description" in updates and updates["description"] != error_log.description:
        changes.append("Description updated")

    if "priority" in updates and updates["priority"] != error_log.priority:
        changes.append(f"Priority: {error_log.priority.value} → {updates['priority'].value}")

    if "environment" in updates and updates["environment"] != error_log.environment:
        changes.append(f"Environment: {error_log.environment.value} → {updates['environment'].value}")

    screen_touched = "screen_id" in updates or "screen_name_freetext" in updates
    if screen_touched:
        old_label = error_log.screen.name if error_log.screen else (error_log.screen_name_freetext or "None")
        new_screen_id = updates.get("screen_id", error_log.screen_id)
        new_freetext = updates.get("screen_name_freetext", error_log.screen_name_freetext)
        if new_screen_id is not None:
            new_screen = (await db.execute(select(Screen).where(Screen.id == new_screen_id))).scalar_one_or_none()
            new_label = new_screen.name if new_screen else "None"
        else:
            new_label = new_freetext or "None"
        if old_label != new_label:
            changes.append(f"Screen: {old_label} → {new_label}")

    if "assigned_to_id" in updates and updates["assigned_to_id"] != error_log.assigned_to_id:
        old_label = error_log.assigned_to.name if error_log.assigned_to else "Unassigned"
        new_id = updates["assigned_to_id"]
        if new_id is not None:
            new_user = (await db.execute(select(User).where(User.id == new_id))).scalar_one_or_none()
            new_label = new_user.name if new_user else "Unassigned"
        else:
            new_label = "Unassigned"
        changes.append(f"Assigned to: {old_label} → {new_label}")

    return changes


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


async def _notify_comment(db: AsyncSession, error_log: ErrorLog, author: User) -> None:
    """Notify the "opposite party" on a comment thread: the reporter and the current assignee,
    excluding whichever of them just posted. A past assignee who still has comment access via
    assignment_history is not notified here -- only the two people currently tied to the ticket."""
    recipient_ids = {error_log.reported_by_id}
    if error_log.assigned_to_id is not None:
        recipient_ids.add(error_log.assigned_to_id)
    recipient_ids.discard(author.id)

    for user_id in recipient_ids:
        db.add(
            Notification(
                user_id=user_id,
                error_log_id=error_log.id,
                type=NotificationType.COMMENT,
                message=f'{author.name} commented on "{error_log.title}"',
            )
        )


def _split_values(raw: str | None, valid: set[str]) -> list[str]:
    """Parse a comma-separated filter value, silently dropping anything that isn't a
    recognized enum value (defends against garbage query params reaching `.in_()`)."""
    if not raw:
        return []
    return [v for v in raw.split(",") if v in valid]


def _filtered_query(
    query: Select,
    status_filter: str | None,
    screen_id: int | None,
    assigned_to_id: str | None,
    priority: str | None,
    environment: str | None,
    search: str | None,
) -> Select:
    statuses = _split_values(status_filter, {s.value for s in ErrorStatus})
    if statuses:
        query = query.where(ErrorLog.status.in_(statuses))
    if screen_id is not None:
        query = query.where(ErrorLog.screen_id == screen_id)
    if assigned_to_id == UNASSIGNED_SENTINEL:
        query = query.where(ErrorLog.assigned_to_id.is_(None))
    elif assigned_to_id is not None:
        query = query.where(ErrorLog.assigned_to_id == uuid.UUID(assigned_to_id))
    priorities = _split_values(priority, {p.value for p in ErrorPriority})
    if priorities:
        query = query.where(ErrorLog.priority.in_(priorities))
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
    status_filter: str | None = None,
    screen_id: int | None = None,
    assigned_to_id: str | None = None,
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
) -> ErrorLogDetail:
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
    if payload.assigned_to_id is not None:
        db.add(
            ErrorLogAssignmentHistory(
                error_log_id=error_log.id,
                old_assigned_to_id=None,
                new_assigned_to_id=payload.assigned_to_id,
                changed_by_id=current_user.id,
            )
        )
    await _notify_new_error_log(db, error_log, current_user)
    await db.commit()
    return await _get_detail(db, error_log.id, current_user)


@router.get("/{error_log_id}", response_model=ErrorLogDetail)
async def get_error_log(
    error_log_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ErrorLogDetail:
    return await _get_detail(db, error_log_id, current_user)


@router.put("/{error_log_id}", response_model=ErrorLogDetail)
async def update_error_log(
    error_log_id: uuid.UUID,
    payload: ErrorLogUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ErrorLogDetail:
    error_log = await _get_or_404(db, error_log_id)
    old_assigned_to_id = error_log.assigned_to_id

    updates = payload.model_dump(exclude_unset=True)
    changes = await _describe_edit(db, error_log, updates)

    for field, value in updates.items():
        setattr(error_log, field, value)

    if changes:
        db.add(
            ErrorLogEditHistory(
                error_log_id=error_log.id,
                summary="; ".join(changes),
                changed_by_id=current_user.id,
            )
        )

    if "assigned_to_id" in updates and error_log.assigned_to_id != old_assigned_to_id:
        db.add(
            ErrorLogAssignmentHistory(
                error_log_id=error_log.id,
                old_assigned_to_id=old_assigned_to_id,
                new_assigned_to_id=error_log.assigned_to_id,
                changed_by_id=current_user.id,
            )
        )
        await _notify_assignment(db, error_log, current_user)

    await db.commit()
    return await _get_detail(db, error_log_id, current_user)


@router.patch("/{error_log_id}/status", response_model=ErrorLogDetail)
async def update_status(
    error_log_id: uuid.UUID,
    payload: StatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ErrorLogDetail:
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
    return await _get_detail(db, error_log_id, current_user)


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


# ---- Comments ----

@router.post("/{error_log_id}/comments", response_model=CommentOut, status_code=status.HTTP_201_CREATED)
async def create_comment(
    error_log_id: uuid.UUID,
    payload: CommentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ErrorLogComment:
    error_log = await _get_or_404(db, error_log_id)
    if not _can_comment(error_log, current_user):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Only the reporter, the assignee, or a SuperAdmin can comment"
        )

    comment = ErrorLogComment(error_log_id=error_log.id, body=payload.body, author_id=current_user.id)
    db.add(comment)
    await _notify_comment(db, error_log, current_user)
    await db.commit()
    await db.refresh(comment, attribute_names=["author"])
    return comment


@router.put("/{error_log_id}/comments/{comment_id}", response_model=CommentOut)
async def update_comment(
    error_log_id: uuid.UUID,
    comment_id: uuid.UUID,
    payload: CommentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ErrorLogComment:
    comment = (
        await db.execute(
            select(ErrorLogComment).where(
                ErrorLogComment.id == comment_id, ErrorLogComment.error_log_id == error_log_id
            )
        )
    ).scalar_one_or_none()
    if comment is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Comment not found")
    if comment.author_id != current_user.id and current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only edit your own comments")

    comment.body = payload.body
    comment.edited_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(comment, attribute_names=["author"])
    return comment


@router.delete("/{error_log_id}/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    error_log_id: uuid.UUID,
    comment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    comment = (
        await db.execute(
            select(ErrorLogComment).where(
                ErrorLogComment.id == comment_id, ErrorLogComment.error_log_id == error_log_id
            )
        )
    ).scalar_one_or_none()
    if comment is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Comment not found")
    if comment.author_id != current_user.id and current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only delete your own comments")

    await db.delete(comment)
    await db.commit()
