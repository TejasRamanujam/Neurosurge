from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.models import Flashcard


def sm2(quality: int, repetition: int, previous_interval: int, previous_ease: float) -> dict:
    if quality < 0 or quality > 5:
        raise ValueError("Quality must be 0-5")

    if quality >= 3:
        if repetition == 0:
            interval = 1
        elif repetition == 1:
            interval = 6
        else:
            interval = round(previous_interval * previous_ease)

        repetitions = repetition + 1
    else:
        repetitions = 0
        interval = 1

    ease = previous_ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    if ease < 1.3:
        ease = 1.3

    return {
        "interval": interval,
        "repetitions": repetitions,
        "ease": round(ease, 2),
        "next_review": datetime.now(timezone.utc) + timedelta(days=interval)
    }


def review_flashcard(db: Session, card_id: int, quality: int) -> Flashcard:
    card = db.query(Flashcard).filter(Flashcard.id == card_id).first()
    if not card:
        raise ValueError("Flashcard not found")

    result = sm2(quality, card.repetitions, card.interval, card.ease)

    card.ease = result["ease"]
    card.interval = result["interval"]
    card.repetitions = result["repetitions"]
    card.next_review = result["next_review"]
    db.commit()
    db.refresh(card)
    return card


def get_due_flashcards(db: Session, limit: int = 20) -> list:
    now = datetime.now(timezone.utc)
    return (
        db.query(Flashcard)
        .filter(
            (Flashcard.next_review == None) | (Flashcard.next_review <= now)
        )
        .order_by(Flashcard.next_review.asc().nullsfirst())
        .limit(limit)
        .all()
    )


def get_flashcard_stats(db: Session) -> dict:
    total = db.query(Flashcard).count()
    now = datetime.now(timezone.utc)
    due = db.query(Flashcard).filter(
        (Flashcard.next_review == None) | (Flashcard.next_review <= now)
    ).count()
    reviewed_today = db.query(Flashcard).filter(
        Flashcard.next_review > now.replace(hour=0, minute=0, second=0)
    ).count()
    return {"total": total, "due": due, "reviewed_today": reviewed_today}
