from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/neurosurge"
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "password"
    redis_url: str = "redis://localhost:6379/0"
    openai_api_key: str = ""
    embedding_model: str = "text-embedding-3-small"
    vector_dimension: int = 1536
    sm2_default_ease: float = 2.5
    sm2_default_interval: int = 1
    similarity_threshold: float = 0.7

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
