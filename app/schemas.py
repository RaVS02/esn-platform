from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import List, Optional, Dict

# ==========================================
# MODELE UŻYTKOWNIKÓW (MUSZĄ BYĆ NA GÓRZE)
# ==========================================

class UserResponse(BaseModel):
    id: int
    username: str
    login: str
    email: str
    role: str
    is_official: bool = False
    avatar_path: Optional[str] = None  # <--- MUSISZ TO DOPISAĆ

    class Config:
        from_attributes = True

class UserCreate(BaseModel):
    username: str
    login: str
    email: str
    password: str

class UserVerify(BaseModel):
    email: str
    code: str

class ForgotPasswordRequest(BaseModel):
    email: str

class PasswordReset(BaseModel):
    email: str
    code: str
    new_password: str

class Token(BaseModel):
    access_token: str
    token_type: str

# ==========================================
# MODELE PROJEKTÓW
# ==========================================

class ProjectBase(BaseModel):
    title: str
    short_desc: str
    tags: str
    components: Optional[str] = None     # <--- NOWE
    markdown_path: Optional[str] = None  # <--- NOWE
    full_content_md: Optional[str] = None  # opis/artykuł pisany w edytorze (markdown z bezpiecznymi blokami)
    github_url: Optional[str] = None
    image_main: Optional[str] = None
    image_schematic: Optional[str] = None
    image_gallery_1: Optional[str] = None
    image_gallery_2: Optional[str] = None
    technical_notes: Optional[str] = None
    code_snippet: Optional[str] = None
    code_lang: Optional[str] = "cpp"
    is_official: bool = False
    status: Optional[str] = "stable"

class ProjectCreate(ProjectBase):
    pass

class Project(ProjectBase):
    id: int
    slug: str
    owner_id: Optional[int] = None # <--- ZMIANA: Musi być Optional!
    owner: Optional[UserResponse] = None
    created_at: datetime

    class Config:
        from_attributes = True

class PasswordChange(BaseModel):
    old_password: str
    new_password: str
    code: str

class EmailUpdate(BaseModel):
    new_email: str
    code: str

class ProfileUpdate(BaseModel):
    username: str

class CodeRequest(BaseModel):
    purpose: str

class AccountDelete(BaseModel):
    code: str

#Components#
class OfficialComponentBase(BaseModel):
    name: str
    symbol: Optional[str] = None
    inventory_category: str
    applications: List[str] = []
    tags: List[str] = [] # <--- NOWE
    technical_specs: Dict[str, str] = {}
    description: Optional[str] = None
    datasheet_url: Optional[str] = None
    
    # <--- NOWE: Zdjęcia
    image_main: Optional[str] = None
    image_gallery_1: Optional[str] = None
    image_gallery_2: Optional[str] = None
    image_gallery_3: Optional[str] = None
    pinout: Optional[dict] = None

class OfficialComponentCreate(OfficialComponentBase):
    pass

class OfficialComponentResponse(OfficialComponentBase):
    id: int
    created_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True