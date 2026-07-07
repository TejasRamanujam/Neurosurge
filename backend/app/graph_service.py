"""Knowledge graph computed directly from Postgres note content.

Nodes are notes; edges come from explicit [[wikilinks]] between notes and
from shared #hashtags. Everything is derived in a single pass over the
notes table per request — cheap at demo scale, no graph database needed.
"""
import re

from sqlalchemy.orm import Session

from app.models import Note

TAG_RE = re.compile(r"#([A-Za-z0-9_][\w/-]*)")
WIKILINK_RE = re.compile(r"\[\[([^\[\]]+)\]\]")

LINK_WEIGHT = 2.0
SHARED_TAG_BASE_WEIGHT = 0.6
SHARED_TAG_STEP = 0.3
SHARED_TAG_MAX_WEIGHT = 1.5


def extract_tags(content: str) -> list:
    return sorted({t.lower() for t in TAG_RE.findall(content or "")})


def extract_wikilinks(content: str) -> list:
    return [w.strip() for w in WIKILINK_RE.findall(content or "") if w.strip()]


def _load_notes(db: Session):
    return db.query(Note.id, Note.title, Note.content).all()


def build_graph(db: Session) -> dict:
    """Return {nodes, edges} in the same shape the old Neo4j client produced."""
    notes = _load_notes(db)

    tags_by_note = {}
    title_to_id = {}
    for n in notes:
        tags_by_note[n.id] = extract_tags(n.content)
        title_to_id[(n.title or "").strip().lower()] = n.id

    edges = {}  # unordered (a, b) -> edge dict; explicit links beat tag edges

    def add_edge(src: int, dst: int, weight: float, rel: str):
        if src == dst:
            return
        key = (min(src, dst), max(src, dst))
        existing = edges.get(key)
        if existing is None:
            edges[key] = {"source": src, "target": dst, "weight": weight, "relationship_type": rel}
        elif rel == "linked" and existing["relationship_type"] != "linked":
            edges[key] = {"source": src, "target": dst, "weight": weight, "relationship_type": rel}

    # 1. Explicit [[wikilinks]]
    for n in notes:
        for link in extract_wikilinks(n.content):
            target = title_to_id.get(link.lower())
            if target is not None:
                add_edge(n.id, target, LINK_WEIGHT, "linked")

    # 2. Shared hashtags
    notes_by_tag = {}
    for note_id, tags in tags_by_note.items():
        for t in tags:
            notes_by_tag.setdefault(t, []).append(note_id)
    shared_counts = {}
    for members in notes_by_tag.values():
        for i in range(len(members)):
            for j in range(i + 1, len(members)):
                key = (min(members[i], members[j]), max(members[i], members[j]))
                shared_counts[key] = shared_counts.get(key, 0) + 1
    for (a, b), count in shared_counts.items():
        weight = min(SHARED_TAG_BASE_WEIGHT + SHARED_TAG_STEP * (count - 1), SHARED_TAG_MAX_WEIGHT)
        add_edge(a, b, weight, "shared_tag")

    connection_count = {n.id: 0 for n in notes}
    for edge in edges.values():
        connection_count[edge["source"]] = connection_count.get(edge["source"], 0) + 1
        connection_count[edge["target"]] = connection_count.get(edge["target"], 0) + 1

    nodes = [
        {
            "id": n.id,
            "title": n.title,
            "tags": tags_by_note.get(n.id, []),
            "connection_count": connection_count.get(n.id, 0),
        }
        for n in notes
    ]
    return {"nodes": nodes, "edges": list(edges.values())}


def get_backlinks(db: Session, note_id: int) -> list:
    """Notes that reference this note: [[Title]] wikilinks, or a plain-text
    mention of the title (for titles long enough to be unambiguous)."""
    target = db.query(Note.id, Note.title).filter(Note.id == note_id).first()
    if not target or not (target.title or "").strip():
        return []
    title_lower = target.title.strip().lower()

    backlinks = []
    for n in _load_notes(db):
        if n.id == note_id:
            continue
        content_lower = (n.content or "").lower()
        wikilinks = [w.lower() for w in extract_wikilinks(n.content)]
        if title_lower in wikilinks:
            backlinks.append({"note_id": n.id, "title": n.title, "type": "linked"})
        elif len(title_lower) >= 4 and title_lower in content_lower:
            backlinks.append({"note_id": n.id, "title": n.title, "type": "mention"})
    return backlinks


def get_all_tags(db: Session) -> list:
    tags = set()
    for n in _load_notes(db):
        tags.update(extract_tags(n.content))
    return sorted(tags)
