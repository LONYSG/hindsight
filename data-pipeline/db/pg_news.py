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


# ─── 배치 재처리용 ─────────────────────────────────────────────

def get_pending_summary(
    batch_size: int = 50,
    offset: int = 0,
    date_from: str | None = None,
    date_to: str | None = None,
) -> list[dict]:
    """brief가 없는 기사 조회 (re_summarize_all용).
    date_from/date_to 지정 시 해당 기간만 조회 (예: '2020-02-01' ~ '2020-02-29').
    """
    conditions = [
        "body IS NOT NULL AND body != ''",
        "(brief IS NULL OR brief = '')",
    ]
    params: list = []
    if date_from:
        conditions.append("date >= %s")
        params.append(date_from)
    if date_to:
        conditions.append("date <= %s")
        params.append(date_to)
    params += [batch_size, offset]

    sql = f"""
        SELECT id, title, date, source, body
        FROM news
        WHERE {' AND '.join(conditions)}
        ORDER BY date ASC
        LIMIT %s OFFSET %s
    """
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()
    return [
        {"id": r[0], "title": r[1], "date": str(r[2]) if r[2] else "", "source": r[3], "body": r[4]}
        for r in rows
    ]


def get_pending_summarize_initial(batch_size: int = 50) -> list[dict]:
    """summary가 없는 기사 조회 (summarize_pending용)"""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, title, date, source, body
                FROM news
                WHERE body IS NOT NULL AND body != ''
                  AND (summary IS NULL OR summary = '')
                ORDER BY date ASC
                LIMIT %s
                """,
                (batch_size,),
            )
            rows = cur.fetchall()
    return [
        {"id": r[0], "title": r[1], "date": str(r[2]) if r[2] else "", "source": r[3], "body": r[4]}
        for r in rows
    ]


def update_llm_fields(news_id: int, title_ko: str, brief: str, summary: str, themes: list, llm_raw: str) -> None:
    """Gemini 처리 결과(title_ko, brief, summary, themes, llm_raw) 업데이트"""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE news
                SET title_ko = %s, brief = %s, summary = %s,
                    themes = %s::text[], llm_raw = %s
                WHERE id = %s
                """,
                (title_ko, brief, summary, themes, llm_raw, news_id),
            )


def get_distinct_dates() -> list[str]:
    """뉴스가 존재하는 날짜 목록 (re_score_all용)"""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT DISTINCT date FROM news WHERE date IS NOT NULL ORDER BY date ASC")
            return [str(row[0]) for row in cur.fetchall()]


def get_articles_by_date(date_str: str) -> list[dict]:
    """특정 날짜 기사 목록 (id, title, category)"""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, title, category FROM news WHERE date = %s",
                (date_str,),
            )
            return [{"id": r[0], "title": r[1], "category": r[2]} for r in cur.fetchall()]


def update_importance(news_id: int, importance: int) -> None:
    """importance 점수 업데이트"""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE news SET importance = %s WHERE id = %s", (importance, news_id))


def truncate_news() -> None:
    """news 테이블 전체 삭제 (reset용)"""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("TRUNCATE TABLE news RESTART IDENTITY")
