"""
뉴스 수집기용 PostgreSQL 저장 유틸리티 (psycopg v3)

ES 기반 _filter_existing / _bulk_save / _already_collected 를 대체한다.
"""

from db.connection import get_connection


def already_collected(day: str, category: str) -> bool:
    """해당 날짜+카테고리 기사가 이미 존재하면 True (날짜 중복 수집 방지)"""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM news WHERE date = %s AND category = %s LIMIT 1",
                (day, category),
            )
            return cur.fetchone() is not None


def filter_existing(articles: list[dict]) -> list[dict]:
    """DB에 이미 존재하는 URL 제거 + 배치 내 중복 URL 제거"""
    if not articles:
        return []

    urls = [a["url"] for a in articles if a.get("url")]
    if not urls:
        return articles

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT url FROM news WHERE url = ANY(%s)", (urls,))
            existing = {row[0] for row in cur.fetchall()}

    seen: set[str] = set()
    result = []
    for a in articles:
        url = a.get("url", "")
        if url and url not in existing and url not in seen:
            seen.add(url)
            result.append(a)
    return result


def bulk_save(articles: list[dict]) -> int:
    """articles를 news 테이블에 삽입. URL 중복은 무시(ON CONFLICT DO NOTHING)."""
    if not articles:
        return 0

    rows = []
    for a in articles:
        if not a.get("published_at"):
            continue
        rows.append((
            a.get("es_id"),
            a.get("title"),
            a.get("title_ko", ""),
            a.get("brief", ""),
            a.get("summary", ""),
            a.get("body"),
            a.get("category"),
            a.get("source_type"),
            a.get("tickers") or [],
            a.get("source"),
            a.get("url"),
            a.get("date"),
            a.get("published_at"),
            a.get("importance"),
            a.get("themes") or [],
            a.get("llm_raw"),
        ))

    if not rows:
        return 0

    sql = """
        INSERT INTO news
            (es_id, title, title_ko, brief, summary, body, category, source_type,
             tickers, source, url, date, published_at, importance, themes, llm_raw)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s::text[],%s,%s,%s,%s,%s,%s::text[],%s)
        ON CONFLICT (url) WHERE url IS NOT NULL AND url != '' DO NOTHING
    """
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.executemany(sql, rows)
    return len(rows)
