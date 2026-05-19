"""
Elasticsearch → PostgreSQL 뉴스 데이터 이전 스크립트 (1회성)

실행:
  cd data-pipeline
  source venv/bin/activate
  python migrate_es_to_pg.py
"""

import json
import requests
import psycopg2
from psycopg2.extras import execute_values
from datetime import datetime, timezone
from config import settings

ES_URL   = f"http://{getattr(settings, 'ELASTICSEARCH_HOST', 'localhost')}:{getattr(settings, 'ELASTICSEARCH_PORT', 9200)}"
ES_INDEX = getattr(settings, 'ELASTICSEARCH_INDEX', 'hindsight-news')

PG_DSN = f"host={getattr(settings, 'DB_HOST', 'localhost')} port={getattr(settings, 'DB_PORT', 5433)} dbname={getattr(settings, 'DB_NAME', 'hindsight')} user={getattr(settings, 'DB_USER', 'hindsight')} password={getattr(settings, 'DB_PASSWORD', 'hindsight')}"


def fetch_all_from_es() -> list[dict]:
    """ES에서 전체 문서 조회 (scroll API)"""
    resp = requests.post(
        f"{ES_URL}/{ES_INDEX}/_search?scroll=2m",
        json={"query": {"match_all": {}}, "size": 500, "_source": True},
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    scroll_id = data["_scroll_id"]
    hits = data["hits"]["hits"]
    docs = list(hits)

    while hits:
        resp = requests.post(
            f"{ES_URL}/_search/scroll",
            json={"scroll": "2m", "scroll_id": scroll_id},
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        hits = data["hits"]["hits"]
        docs.extend(hits)

    # scroll 컨텍스트 해제
    requests.delete(f"{ES_URL}/_search/scroll", json={"scroll_id": scroll_id})
    return docs


def insert_to_pg(docs: list[dict]) -> int:
    """docs를 PostgreSQL news 테이블에 INSERT (중복 es_id 무시)"""
    rows = []
    for doc in docs:
        src = doc.get("_source", {})
        es_id = doc["_id"]

        published_at_raw = src.get("published_at")
        if not published_at_raw:
            continue
        try:
            published_at = datetime.fromisoformat(published_at_raw.replace("Z", "+00:00"))
        except Exception:
            continue

        date_raw = src.get("date")
        try:
            date_val = datetime.strptime(date_raw, "%Y-%m-%d").date() if date_raw else None
        except Exception:
            date_val = None

        tickers = src.get("tickers") or []
        themes  = src.get("themes")  or []

        rows.append((
            es_id,
            src.get("title"),
            src.get("title_ko"),
            src.get("brief"),
            src.get("summary"),
            src.get("body"),
            src.get("category"),
            src.get("source_type"),
            tickers,   # list → psycopg2가 text[]로 변환
            src.get("source"),
            src.get("url"),
            date_val,
            published_at,
            src.get("importance"),
            themes,
        ))

    if not rows:
        print("이전할 문서 없음")
        return 0

    with psycopg2.connect(PG_DSN) as conn:
        with conn.cursor() as cur:
            execute_values(
                cur,
                """
                INSERT INTO news
                    (es_id, title, title_ko, brief, summary, body, category, source_type,
                     tickers, source, url, date, published_at, importance, themes)
                VALUES %s
                ON CONFLICT (es_id) DO NOTHING
                """,
                rows,
                template="(%s,%s,%s,%s,%s,%s,%s,%s,%s::text[],%s,%s,%s,%s,%s,%s::text[])",
            )
            conn.commit()
            return cur.rowcount


if __name__ == "__main__":
    print("ES에서 전체 문서 조회 중...")
    docs = fetch_all_from_es()
    print(f"조회된 문서: {len(docs)}건")

    print("PostgreSQL로 이전 중...")
    inserted = insert_to_pg(docs)
    print(f"이전 완료: {inserted}건 신규 삽입 (중복 제외)")
