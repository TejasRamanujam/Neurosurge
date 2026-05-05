from neo4j import GraphDatabase
from app.config import settings
from typing import List, Optional


class Neo4jClient:
    def __init__(self):
        self.driver = GraphDatabase.driver(
            settings.neo4j_uri,
            auth=(settings.neo4j_user, settings.neo4j_password)
        )

    def close(self):
        self.driver.close()

    def create_note_node(self, note_id: int, title: str, tags: Optional[List[str]] = None):
        with self.driver.session() as session:
            session.run(
                "MERGE (n:Note {id: $id}) SET n.title = $title, n.created_at = timestamp()",
                id=note_id, title=title
            )
            if tags:
                for tag in tags:
                    session.run(
                        "MERGE (t:Tag {name: $name}) "
                        "MERGE (n:Note {id: $id}) "
                        "MERGE (n)-[:TAGGED_WITH]->(t)",
                        name=tag, id=note_id
                    )

    def create_relationship(self, source_id: int, target_id: int, weight: float = 1.0, relationship_type: str = "RELATES_TO"):
        with self.driver.session() as session:
            session.run(
                "MATCH (a:Note {id: $source_id}) "
                "MATCH (b:Note {id: $target_id}) "
                "MERGE (a)-[r:RELATES_TO {type: $rel_type}]->(b) "
                "SET r.weight = $weight",
                source_id=source_id, target_id=target_id, rel_type=relationship_type, weight=weight
            )

    def delete_note_node(self, note_id: int):
        with self.driver.session() as session:
            session.run("MATCH (n:Note {id: $id}) DETACH DELETE n", id=note_id)

    def get_knowledge_graph(self) -> dict:
        with self.driver.session() as session:
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
                    id=record["id"]
                )
                tags = [t["name"] for t in tags_result]
                nodes.append({
                    "id": record["id"],
                    "title": record["title"],
                    "tags": tags,
                    "connection_count": record["connection_count"]
                })

            edges_result = session.run(
                "MATCH (a:Note)-[r:RELATES_TO]->(b:Note) "
                "RETURN a.id AS source, b.id AS target, r.weight AS weight, r.type AS relationship_type"
            )
            edges = [dict(record) for record in edges_result]

            return {"nodes": nodes, "edges": edges}

    def get_backlinks(self, note_id: int) -> list:
        with self.driver.session() as session:
            result = session.run(
                "MATCH (n:Note {id: $id})<-[:RELATES_TO]-(linked:Note) "
                "RETURN linked.id AS note_id, linked.title AS title, 'linked' AS type",
                id=note_id
            )
            return [dict(record) for record in result]

    def search_by_tag(self, tag: str) -> list:
        with self.driver.session() as session:
            result = session.run(
                "MATCH (t:Tag {name: $name})<-[:TAGGED_WITH]-(n:Note) "
                "RETURN n.id AS id, n.title AS title",
                name=tag
            )
            return [dict(record) for record in result]

    def get_all_tags(self) -> list:
        with self.driver.session() as session:
            result = session.run("MATCH (t:Tag) RETURN t.name AS name ORDER BY t.name")
            return [record["name"] for record in result]


neo4j_client = Neo4jClient()
