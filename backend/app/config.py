from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/neurosurge"
    redis_url: str = "redis://localhost:6379/0"
    gemini_api_key: str = ""
    embedding_model: str = "gemini-embedding-001"
    vector_dimension: int = 1536
    sm2_default_ease: float = 2.5
    sm2_default_interval: int = 1
    similarity_threshold: float = 0.55

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
