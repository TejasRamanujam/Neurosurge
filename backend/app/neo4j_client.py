import logging
from typing import List, Optional

from neo4j import GraphDatabase

from app.config import settings

logger = logging.getLogger("neurosurge")


class Neo4jClient:
    """Wraps Neo4j. When Neo4j is unreachable (e.g. the serverless demo has no
    graph DB), every method degrades to a safe no-op / empty result instead of
    raising, so notes, flashcards and the rest of the app keep working."""

    def __init__(self):
        try:
            self.driver = GraphDatabase.driver(
                settings.neo4j_uri,
                auth=(settings.neo4j_user, settings.neo4j_password),
                connection_timeout=3,
            )
        except Exception:
            self.driver = None

    def _session(self):
        if self.driver is None:
            raise RuntimeError("neo4j unavailable")
        return self.driver.session()

    def close(self):
        try:
            if self.driver is not None:
                self.driver.close()
        except Exception:
            pass

    def create_note_node(self, note_id: int, title: str, tags: Optional[List[str]] = None):
        try:
            with self._session() as session:
                session.run(
                    "MERGE (n:Note {id: $id}) SET n.title = $title, n.created_at = timestamp()",
                    id=note_id, title=title,
                )
                for tag in (tags or []):
                    session.run(
                        "MERGE (t:Tag {name: $name}) "
                        "MERGE (n:Note {id: $id}) "
                        "MERGE (n)-[:TAGGED_WITH]->(t)",
                        name=tag, id=note_id,
                    )
        except Exception:
            logger.warning("neo4j unavailable: create_note_node skipped")

    def create_relationship(self, source_id: int, target_id: int, weight: float = 1.0, relationship_type: str = "RELATES_TO"):
        try:
            with self._session() as session:
                session.run(
                    "MATCH (a:Note {id: $source_id}) "
                    "MATCH (b:Note {id: $target_id}) "
                    "MERGE (a)-[r:RELATES_TO {type: $rel_type}]->(b) "
                    "SET r.weight = $weight",
                    source_id=source_id, target_id=target_id, rel_type=relationship_type, weight=weight,
                )
        except Exception:
            logger.warning("neo4j unavailable: create_relationship skipped")

    def delete_note_node(self, note_id: int):
        try:
            with self._session() as session:
                session.run("MATCH (n:Note {id: $id}) DETACH DELETE n", id=note_id)
        except Exception:
            logger.warning("neo4j unavailable: delete_note_node skipped")

    def get_knowledge_graph(self) -> dict:
        try:
            with self._session() as session:
                nodes_result = session.run(
                    "MATCH (n:Note) "
                    "OPTIONAL MATCH (n)-[r]-() "
                    "RETURN n.id AS id, n.title AS title, "
                    "collect(DISTINCT type(r)) AS relationships, "
                    "count(DISTINCT r) AS connection_count "
                    "ORDER BY n.id"
                )
                nodes = []
                for record in nodes_result:
                    tags_result = session.run(
                        "MATCH (n:Note {id: $id})-[:TAGGED_WITH]->(t:Tag) RETURN t.name AS name",
                        id=record["id"],
                    )
                    nodes.append({
                        "id": record["id"],
                        "title": record["title"],
                        "tags": [t["name"] for t in tags_result],
                        "connection_count": record["connection_count"],
                    })
                edges_result = session.run(
                    "MATCH (a:Note)-[r:RELATES_TO]->(b:Note) "
                    "RETURN a.id AS source, b.id AS target, r.weight AS weight, r.type AS relationship_type"
                )
                edges = [dict(record) for record in edges_result]
                return {"nodes": nodes, "edges": edges}
        except Exception:
            logger.warning("neo4j unavailable: get_knowledge_graph -> empty")
            return {"nodes": [], "edges": []}

    def get_backlinks(self, note_id: int) -> list:
        try:
            with self._session() as session:
                result = session.run(
                    "MATCH (n:Note {id: $id})<-[:RELATES_TO]-(linked:Note) "
                    "RETURN linked.id AS note_id, linked.title AS title, 'linked' AS type",
                    id=note_id,
                )
                return [dict(record) for record in result]
        except Exception:
            return []

    def search_by_tag(self, tag: str) -> list:
        try:
            with self._session() as session:
                result = session.run(
                    "MATCH (t:Tag {name: $name})<-[:TAGGED_WITH]-(n:Note) "
                    "RETURN n.id AS id, n.title AS title",
                    name=tag,
                )
                return [dict(record) for record in result]
        except Exception:
            return []

    def get_all_tags(self) -> list:
        try:
            with self._session() as session:
                result = session.run("MATCH (t:Tag) RETURN t.name AS name ORDER BY t.name")
                return [record["name"] for record in result]
        except Exception:
            return []


neo4j_client = Neo4jClient()
