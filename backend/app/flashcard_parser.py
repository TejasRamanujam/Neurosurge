import json


def parse_flashcard_suggestions(raw: str, limit: int = 6) -> list[dict[str, str]]:
    payload = json.loads(raw)
    if isinstance(payload, dict):
        payload = payload.get("flashcards", [])
    if not isinstance(payload, list):
        raise ValueError("Gemini returned an invalid flashcard payload")

    suggestions = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        question = str(item.get("question", "")).strip()
        answer = str(item.get("answer", "")).strip()
        if not question or not answer:
            continue
        suggestions.append({"question": question[:500], "answer": answer[:2000]})
        if len(suggestions) >= limit:
            break

    if not suggestions:
        raise ValueError("Gemini returned no usable flashcards")
    return suggestions
