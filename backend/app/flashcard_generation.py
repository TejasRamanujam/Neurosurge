import logging

import httpx

from app.config import settings
from app.flashcard_parser import parse_flashcard_suggestions

logger = logging.getLogger("neurosurge")
GEMINI_GENERATE_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-2.5-flash:generateContent"
)


class FlashcardGenerationUnavailable(RuntimeError):
    pass


def generate_flashcard_suggestions(title: str, content: str) -> list[dict[str, str]]:
    if not settings.gemini_api_key:
        raise FlashcardGenerationUnavailable("Gemini card drafting is not configured")

    prompt = f"""Create 3 to 6 atomic study flashcards from the note below.
Each question must test one idea and each answer must be concise and self-contained.
Use only facts present in the note. Return a JSON array of objects with exactly
the keys \"question\" and \"answer\".

TITLE: {title[:500]}
NOTE:
{content[:12000]}
"""
    try:
        response = httpx.post(
            GEMINI_GENERATE_URL,
            headers={
                "x-goog-api-key": settings.gemini_api_key,
                "Content-Type": "application/json",
            },
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "responseMimeType": "application/json",
                    "temperature": 0.25,
                },
            },
            timeout=30.0,
        )
        response.raise_for_status()
        raw = response.json()["candidates"][0]["content"]["parts"][0]["text"]
        return parse_flashcard_suggestions(raw)
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError):
        logger.warning("Gemini flashcard generation failed", exc_info=True)
        raise FlashcardGenerationUnavailable(
            "Gemini could not draft cards from this note; try again in a moment"
        )
