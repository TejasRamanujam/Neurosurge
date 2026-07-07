"""Hand-rolled TF-IDF cosine similarity — the no-API-key fallback.

Pure Python (no numpy/sklearn); trivially fast at demo scale. Used for
related-note suggestions and semantic-ish search whenever Gemini
embeddings are unavailable.
"""
import math
import re
from collections import Counter

TOKEN_RE = re.compile(r"[a-z0-9][a-z0-9+#./-]*")

STOPWORDS = {
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
    "being", "have", "has", "had", "do", "does", "did", "will", "would",
    "could", "should", "may", "might", "shall", "can", "need", "dare",
    "ought", "used", "this", "that", "these", "those", "i", "you", "he",
    "she", "it", "we", "they", "me", "him", "her", "us", "them", "my",
    "your", "his", "its", "our", "their", "not", "no", "nor", "none",
    "some", "any", "all", "both", "each", "few", "more", "most", "other",
    "such", "what", "which", "who", "whom", "whose", "when", "where",
    "why", "how", "as", "if", "than", "then", "so", "just", "also", "into",
    "over", "under", "about", "between", "through", "there", "here",
}


def tokenize(text: str) -> list:
    return [
        t for t in TOKEN_RE.findall((text or "").lower())
        if len(t) > 2 and t not in STOPWORDS
    ]


def _tfidf_vectors(token_lists: list) -> list:
    n_docs = len(token_lists)
    df = Counter()
    for toks in token_lists:
        df.update(set(toks))
    vectors = []
    for toks in token_lists:
        if not toks:
            vectors.append({})
            continue
        tf = Counter(toks)
        total = len(toks)
        vectors.append({
            term: (count / total) * (math.log((n_docs + 1) / (df[term] + 1)) + 1.0)
            for term, count in tf.items()
        })
    return vectors


def _cosine(a: dict, b: dict) -> float:
    if not a or not b:
        return 0.0
    if len(b) < len(a):
        a, b = b, a
    dot = sum(v * b.get(k, 0.0) for k, v in a.items())
    if dot == 0.0:
        return 0.0
    norm_a = math.sqrt(sum(v * v for v in a.values()))
    norm_b = math.sqrt(sum(v * v for v in b.values()))
    return dot / (norm_a * norm_b)


def rank_by_similarity(documents: list, target_text: str, min_score: float = 0.02) -> list:
    """Rank documents against target_text with TF-IDF cosine.

    documents: list of (doc_id, text). Returns [(doc_id, score)] sorted
    descending, scores rounded, entries below min_score dropped.
    """
    token_lists = [tokenize(text) for _, text in documents]
    token_lists.append(tokenize(target_text))
    vectors = _tfidf_vectors(token_lists)
    target_vec = vectors[-1]

    scored = []
    for (doc_id, _), vec in zip(documents, vectors[:-1]):
        score = _cosine(vec, target_vec)
        if score >= min_score:
            scored.append((doc_id, round(score, 4)))
    scored.sort(key=lambda pair: pair[1], reverse=True)
    return scored
