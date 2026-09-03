import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class UserRole(str, enum.Enum):
    DEV = "Dev"
    QA = "QA"
    SUPER_ADMIN = "SuperAdmin"


class ErrorStatus(str, enum.Enum):
    YET_TO_START = "YetToStart"
    IN_PROGRESS = "InProgress"
    FIXED = "Fixed"
    TESTED_BY_QA = "TestedByQA"
    REOPENED = "Reopened"
    CLOSED = "Closed"


class ErrorPriority(str, enum.Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    CRITICAL = "Critical"


class NotificationType(str, enum.Enum):
    ASSIGNED = "Assigned"
    CREATED = "Created"


class ErrorEnvironment(str, enum.Enum):
    DEV = "Dev"
    STAGING = "Staging"
    MASTER = "Master"
    QA = "QA"
    PRODUCTION = "Production"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole, name="user_role"), nullable=False, default=UserRole.DEV)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    reported_logs: Mapped[list["ErrorLog"]] = relationship(
        back_populates="reported_by", foreign_keys="ErrorLog.reported_by_id"
    )
    assigned_logs: Mapped[list["ErrorLog"]] = relationship(
        back_populates="assigned_to", foreign_keys="ErrorLog.assigned_to_id"
    )


class Screen(Base):
    __tablename__ = "screens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    category: Mapped[str] = mapped_column(String(100), nullable=False)


class ErrorLog(Base):
    __tablename__ = "error_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)

    screen_id: Mapped[int | None] = mapped_column(ForeignKey("screens.id"), nullable=True)
    screen_name_freetext: Mapped[str | None] = mapped_column(String(300), nullable=True)

    status: Mapped[ErrorStatus] = mapped_column(
        Enum(ErrorStatus, name="error_status"), nullable=False, default=ErrorStatus.YET_TO_START
    )
    priority: Mapped[ErrorPriority] = mapped_column(
        Enum(ErrorPriority, name="error_priority"), nullable=False, default=ErrorPriority.MEDIUM
    )
    environment: Mapped[ErrorEnvironment] = mapped_column(
        Enum(ErrorEnvironment, name="error_environment"),
        nullable=False,
        default=ErrorEnvironment.DEV,
        server_default=ErrorEnvironment.DEV.name,
    )

    reported_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    assigned_to_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    screen: Mapped["Screen | None"] = relationship()
    reported_by: Mapped["User"] = relationship(back_populates="reported_logs", foreign_keys=[reported_by_id])
    assigned_to: Mapped["User | None"] = relationship(back_populates="assigned_logs", foreign_keys=[assigned_to_id])
    attachments: Mapped[list["ErrorLogAttachment"]] = relationship(
        back_populates="error_log", cascade="all, delete-orphan"
    )
    status_history: Mapped[list["ErrorLogStatusHistory"]] = relationship(
        back_populates="error_log", cascade="all, delete-orphan", order_by="ErrorLogStatusHistory.changed_at"
    )


class ErrorLogAttachment(Base):
    __tablename__ = "error_log_attachments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    error_log_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("error_logs.id", ondelete="CASCADE"), nullable=False
    )
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(300), nullable=False)
    content_type: Mapped[str] = mapped_column(String(150), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    error_log: Mapped["ErrorLog"] = relationship(back_populates="attachments")


class ErrorLogStatusHistory(Base):
    __tablename__ = "error_log_status_history"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    error_log_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("error_logs.id", ondelete="CASCADE"), nullable=False
    )
    old_status: Mapped[ErrorStatus | None] = mapped_column(Enum(ErrorStatus, name="error_status"), nullable=True)
    new_status: Mapped[ErrorStatus] = mapped_column(Enum(ErrorStatus, name="error_status"), nullable=False)
    changed_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    error_log: Mapped["ErrorLog"] = relationship(back_populates="status_history")
    changed_by: Mapped["User"] = relationship()


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    error_log_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("error_logs.id", ondelete="CASCADE"), nullable=False
    )
    type: Mapped[NotificationType] = mapped_column(Enum(NotificationType, name="notification_type"), nullable=False)
    message: Mapped[str] = mapped_column(String(500), nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    error_log: Mapped["ErrorLog"] = relationship()
