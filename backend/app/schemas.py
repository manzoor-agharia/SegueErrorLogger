import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models import ErrorEnvironment, ErrorPriority, ErrorStatus, NotificationType, UserRole


# ---- Auth / Users ----

class UserRegister(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    email: EmailStr
    role: UserRole
    is_active: bool
    created_at: datetime


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: UserRole = UserRole.DEV


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    email: EmailStr | None = None
    role: UserRole | None = None
    is_active: bool | None = None


class UserRoleUpdate(BaseModel):
    role: UserRole


# ---- Screens ----

class ScreenOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category: str


# ---- Error Logs ----

class ErrorLogCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    description: str = Field(min_length=1)
    screen_id: int | None = None
    screen_name_freetext: str | None = Field(default=None, max_length=300)
    priority: ErrorPriority = ErrorPriority.MEDIUM
    environment: ErrorEnvironment = ErrorEnvironment.DEV
    assigned_to_id: uuid.UUID | None = None


class ErrorLogUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=300)
    description: str | None = None
    screen_id: int | None = None
    screen_name_freetext: str | None = Field(default=None, max_length=300)
    priority: ErrorPriority | None = None
    environment: ErrorEnvironment | None = None
    assigned_to_id: uuid.UUID | None = None


class StatusUpdate(BaseModel):
    status: ErrorStatus


class AttachmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    original_filename: str
    content_type: str
    size_bytes: int
    uploaded_at: datetime


class StatusHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    old_status: ErrorStatus | None
    new_status: ErrorStatus
    changed_by: UserOut
    changed_at: datetime


class EditHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    summary: str
    changed_by: UserOut
    changed_at: datetime


# ---- Comments ----

class CommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class CommentUpdate(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class CommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    body: str
    author: UserOut
    created_at: datetime
    edited_at: datetime | None


class ErrorLogListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    status: ErrorStatus
    priority: ErrorPriority
    environment: ErrorEnvironment
    screen: ScreenOut | None
    screen_name_freetext: str | None
    reported_by: UserOut
    assigned_to: UserOut | None
    created_at: datetime
    updated_at: datetime


class ErrorLogDetail(ErrorLogListItem):
    description: str
    attachments: list[AttachmentOut]
    status_history: list[StatusHistoryOut]
    edit_history: list[EditHistoryOut]
    comments: list[CommentOut]
    # Computed per-request from the caller's identity (reporter / current or past assignee / SuperAdmin),
    # not read off the ORM object -- always overridden after model_validate(), so the default here is inert.
    can_comment: bool = False


class ErrorLogPage(BaseModel):
    items: list[ErrorLogListItem]
    total: int
    page: int
    page_size: int
    total_pages: int


# ---- Notifications ----

class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    error_log_id: uuid.UUID
    type: NotificationType
    message: str
    is_read: bool
    created_at: datetime


class UnreadCountOut(BaseModel):
    count: int
