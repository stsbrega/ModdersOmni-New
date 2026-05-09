from pydantic import BaseModel


class GameResponse(BaseModel):
    id: int
    name: str
    slug: str
    nexus_domain: str
    image_url: str | None = None
    versions: list[str] | None = None

    model_config = {"from_attributes": True}


class PlaystyleResponse(BaseModel):
    id: int
    game_id: int
    name: str
    slug: str
    description: str | None = None
    icon: str | None = None

    model_config = {"from_attributes": True}
