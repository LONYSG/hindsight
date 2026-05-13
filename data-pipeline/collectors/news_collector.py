"""
뉴스 수집기 - The Guardian API

[베이스 레이어] 하루씩 쿼리 → Gemini 선별 → 선별된 기사만 저장
  Guardian BUSINESS    (business|money 섹션, 하루치 전체)
  Guardian TECHNOLOGY  (technology 섹션, 하루치 전체)
  Guardian WORLD       (world|us-news|politics 섹션, 하루치 전체)
  → 전체 헤드라인을 Gemini에 전달 → 시장 영향도 3점 이상만 선별

[NVDA 레이어] 월 단위 배치 → 전량 저장 (Gemini 선별 없음)
  Guardian NVDA_DIRECT (nvidia 키워드, 월 최대 200건)

Guardian 500회/일 한도 도달 시 자동 중단 → 재실행 시 이어서 진행
URL 기준 중복 제거 → NVDA 뉴스가 베이스에서도 선별되면 1건만 저장
"""

import re
import time
import calendar
from datetime import date, timedelta

import requests
import google.generativeai as genai
from elasticsearch import Elasticsearch, helpers

from config import settings

_ES_INDEX = "hindsight-news"
_GUARDIAN_URL = "https://content.guardianapis.com/search"

_BASE_SECTIONS = [
    ("business|money",         "BUSINESS"),
    ("technology",             "TECHNOLOGY"),
    ("world|us-news|politics", "WORLD"),
]

_SELECTION_PROMPT = """\
당신은 미국 주식시장 전문 매크로/섹터 뉴스 필터 AI입니다.

목표는 단순히 유명 뉴스를 고르는 것이 아니라,
실제로 미국 증시(S&P500, Nasdaq), 주요 산업,
또는 글로벌 자금 흐름에 영향을 줄 가능성이 있는 뉴스만 선별하는 것입니다.

헤드라인의 화제성보다 "시장 영향 가능성"을 우선 평가하세요.

아래는 {date} 하루치 뉴스 헤드라인 전체 목록입니다.

[중요 뉴스 판단 기준]

다음 요소 중 하나라도 강하게 해당하면 중요 뉴스로 판단하세요:

- 미국 증시 주요 지수 변동 가능성
- 미국 국채금리 / 달러 / 유가 / 환율 영향
- 연준(Fed), 금리, CPI, 고용, GDP 등 거시경제 영향
- 글로벌 유동성 변화 가능성
- AI / 반도체 / 클라우드 / 방산 / 에너지 / 바이오 등 핵심 섹터 영향
- 시가총액 상위 기업 실적 또는 가이던스 영향
- 공급망, 관세, 제재, 규제 영향
- 지정학 리스크 및 글로벌 투자심리 변화
- 글로벌 자금 흐름(risk-on / risk-off) 변화 가능성

미국 뉴스가 아니더라도,
미국 시장에 실질적 파급효과가 예상되면 포함하세요.

예:
- 일본 금리 정책
- 중국 경기 부양책
- OPEC 정책
- 중동/대만 지정학
- 유럽 규제
- 글로벌 반도체 공급망 이슈

[제외 기준]

다음 유형은 제외하세요:

- 미국 금융시장과 연결성이 약한 지역 로컬 뉴스
- 영국/유럽 지역 내수 위주 뉴스
- 스포츠/연예/문화 뉴스
- 단순 사건사고
- 클릭 유도형 기사
- 투자 판단에 실질 도움이 없는 정치 공방
- 유명 기업이라도 시장 영향성이 낮은 단발성 이슈

[중요도 평가]

각 뉴스의 시장 영향도를 0~5로 평가하세요.

5 = 미국 증시 전체에 큰 영향 가능
4 = 핵심 섹터에 큰 영향
3 = 주요 기업/산업에 의미 있는 영향
2 이하 = 일반적으로 제외

동일 사건은 가장 포괄적인 기사 1개만 선택하세요.

최종적으로 중요도 3 이상 뉴스만 선택하세요.

헤드라인 목록:
{headlines}

응답 형식:
선택한 번호만 쉼표로 구분하여 출력
예시: 3,7,12,18"""

_NVDA_SELECTION_PROMPT = """\
당신은 NVIDIA 주식 투자자를 위한 뉴스 필터 AI입니다.

아래 기사들은 "nvidia" 키워드로 검색된 결과입니다.
실제로 NVIDIA 또는 AI/반도체 투자와 직접 관련 있는 기사만 선택하세요.

[선택 기준]
- NVIDIA 제품, 실적, 전략, CEO/임원 발언에 관한 기사
- AI/반도체 산업에서 NVIDIA의 역할이 핵심인 기사
- NVIDIA 주가, 시총, 투자 의견에 관한 기사
- NVIDIA에 직접 영향을 주는 규제·공급망·경쟁사 동향

[제외 기준]
- NVIDIA가 본문에서 단 한 번만 부수적으로 언급된 기사
- 주제가 다른 기사에 NVIDIA가 예시로만 나온 경우
- 미국 시장과 무관한 지역 내수 뉴스

동일 사건은 가장 포괄적인 기사 1개만 선택하세요.

헤드라인 목록:
{headlines}

선택한 번호만 쉼표로 구분하여 출력하세요."""

# 무료 티어: 분당 15회 호출 → 호출 간 최소 4초
_GEMINI_FREE_TIER_SLEEP = 4.5

_SUMMARY_PROMPT = """\
당신은 주식 투자자를 위한 뉴스 요약 전문가입니다.
아래 뉴스 기사를 읽고, 주식 투자자 관점에서 한국어로 5~6문장으로 요약해주세요.

요약에 반드시 포함할 것:
1. 무슨 일이 있었는지 (핵심 사실)
2. 왜 중요한지 (시장/산업 맥락)
3. 수치가 있으면 포함 (주가, 시총, %, 금리 등)
4. 반도체·AI·NVIDIA 관련 투자 시사점 (해당되는 경우)
5. 리스크 또는 불확실성 요인 (있는 경우)

날짜: {date}
출처: {source}
제목: {title}
내용: {body}

요약:"""


class RateLimitError(Exception):
    pass


# 토큰 사용량 누적 카운터 (실행 세션 내)
_token_stats = {"input": 0, "output": 0, "calls": 0}

def _log_tokens(usage_metadata):
    _token_stats["input"]  += usage_metadata.prompt_token_count or 0
    _token_stats["output"] += usage_metadata.candidates_token_count or 0
    _token_stats["calls"]  += 1

def print_token_stats():
    inp = _token_stats["input"]
    out = _token_stats["output"]
    calls = _token_stats["calls"]
    cost_usd = inp * 0.075 / 1_000_000 + out * 0.30 / 1_000_000
    cost_krw = cost_usd * 1380
    print(f"[토큰 사용량] 호출 {calls}회 | input {inp:,} | output {out:,} | "
          f"예상 비용 ${cost_usd:.4f} (약 {cost_krw:.0f}원)")


def collect(start_date: str, end_date: str, summarize: bool = False):
    """
    뉴스 수집 메인 함수.

    Gemini 선별(저렴 ~$0.29)은 항상 실행 — 시장 무관 기사 제거.
    Gemini 요약(비쌈 ~$4)은 summarize=True일 때만 — 기본값 False.

    rate limit 도달 시 즉시 중단 → 재실행하면 이어서 진행.
    """
    es = _get_es_client()
    _ensure_index(es)

    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel(settings.GEMINI_MODEL)

    try:
        print("[news_collector] 베이스 레이어 수집 시작")
        _collect_base(es, start_date, end_date, model, summarize)

        print("[news_collector] NVDA 레이어 수집 시작")
        _collect_nvda(es, start_date, end_date, model if summarize else None)

    except RateLimitError:
        print()
        print("[news_collector] Guardian API 일일 한도(500회) 도달.")
        print("  내일 재실행하면 중단된 지점부터 이어서 진행됩니다.")
    finally:
        print_token_stats()


def summarize_pending(batch_size: int = 50):
    """
    summary 필드가 없는 기사를 Gemini로 요약.
    collect() 완료 후 별도 실행. 이 함수가 주요 과금 발생 지점.
    """
    es = _get_es_client()
    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel(settings.GEMINI_MODEL)

    total = 0
    while True:
        resp = es.search(
            index=_ES_INDEX,
            query={"bool": {"must_not": {"exists": {"field": "summary"}}}},
            _source=["title", "date", "source", "body"],
            size=batch_size,
        )
        hits = resp["hits"]["hits"]
        if not hits:
            break
        for hit in hits:
            summary = _summarize(model, hit["_source"])
            es.update(index=_ES_INDEX, id=hit["_id"], body={"doc": {"summary": summary}})
            total += 1
            time.sleep(_GEMINI_FREE_TIER_SLEEP)
        print(f"[summarize_pending] {total}건 완료...")

    print(f"[summarize_pending] 완료. 총 {total}건")


# ─── 베이스 레이어 ────────────────────────────────────────────

def _collect_base(es: Elasticsearch, start_date: str, end_date: str, model, summarize: bool):
    start = date.fromisoformat(start_date)
    end = date.fromisoformat(end_date)
    current = start
    total_days = (end - start).days + 1
    total_saved = 0

    while current <= end:
        day_str = current.strftime("%Y-%m-%d")

        # 이미 처리된 날 스킵 (BUSINESS 기준으로 판단)
        if _already_collected(es, day_str, "BUSINESS"):
            current += timedelta(days=1)
            continue

        # 3개 섹션 전체 수집
        all_articles = []
        for section, cat in _BASE_SECTIONS:
            articles = _fetch_guardian_day(day_str, section, cat)
            all_articles.extend(articles)
            time.sleep(1.1)

        if not all_articles:
            current += timedelta(days=1)
            continue

        # Gemini 헤드라인 선별
        selected = _select_with_gemini(model, all_articles, day_str)
        new_articles = _filter_existing(es, selected)

        if summarize:
            for a in new_articles:
                a["summary"] = _summarize(model, a)
                time.sleep(_GEMINI_FREE_TIER_SLEEP)  # 무료 티어: 15RPM

        saved = _bulk_save(es, new_articles)
        total_saved += saved

        elapsed = (current - start).days + 1
        if elapsed % 90 == 0 or current == end:
            pct = elapsed / total_days * 100
            print(f"  {day_str} ({pct:.0f}%) 누적 {total_saved}건")

        current += timedelta(days=1)

    print(f"[news_collector] 베이스 수집 완료. 총 {total_saved}건")


def _fetch_guardian_day(day: str, section: str, category: str) -> list[dict]:
    params = {
        "from-date":    day,
        "to-date":      day,
        "section":      section,
        "show-fields":  "headline,trailText,bodyText",
        "page-size":    200,
        "order-by":     "newest",
        "api-key":      settings.GUARDIAN_API_KEY,
    }
    try:
        resp = requests.get(_GUARDIAN_URL, params=params, timeout=15)
        if resp.status_code == 429:
            raise RateLimitError()
        resp.raise_for_status()
        return [_parse_guardian(r, category) for r in resp.json()["response"]["results"]]
    except RateLimitError:
        raise
    except Exception as e:
        print(f"  Guardian {category} {day} 오류: {e}")
        return []


def _select_with_gemini(model, articles: list[dict], day: str) -> list[dict]:
    """전체 헤드라인을 Gemini에 전달해 시장 영향도 3점 이상 기사만 선별."""
    if not articles:
        return []

    headlines = "\n".join(
        f"{i+1}. [{a['category']}] {a['title']}"
        for i, a in enumerate(articles)
    )
    prompt = _SELECTION_PROMPT.format(date=day, headlines=headlines)

    try:
        result = model.generate_content(prompt)
        _log_tokens(result.usage_metadata)
        raw = result.text.strip().replace("\n", ",")
        indices = [
            int(x.strip()) - 1
            for x in raw.split(",")
            if x.strip().isdigit()
        ]
        selected = [articles[i] for i in indices if 0 <= i < len(articles)]
        return selected if selected else articles[:5]  # 선별 실패 시 상위 5건 fallback
    except Exception as e:
        print(f"  Gemini 선별 오류 ({day}): {e}")
        return articles[:5]


def _select_nvda_with_gemini(model, articles: list[dict], month: str) -> list[dict]:
    """NVDA 키워드 검색 결과에서 실제 NVIDIA 관련 기사만 선별."""
    if not articles:
        return []
    headlines = "\n".join(
        f"{i+1}. {a['title']}" for i, a in enumerate(articles)
    )
    prompt = _NVDA_SELECTION_PROMPT.format(headlines=headlines)
    try:
        result = model.generate_content(prompt)
        _log_tokens(result.usage_metadata)
        time.sleep(_GEMINI_FREE_TIER_SLEEP)
        raw = result.text.strip().replace("\n", ",")
        indices = [int(x.strip()) - 1 for x in raw.split(",") if x.strip().isdigit()]
        selected = [articles[i] for i in indices if 0 <= i < len(articles)]
        return selected if selected else []
    except Exception as e:
        print(f"  Gemini NVDA 선별 오류 ({month}): {e}")
        return articles


# ─── NVDA 레이어 ──────────────────────────────────────────────

def _collect_nvda(es: Elasticsearch, start_date: str, end_date: str, model):
    months = _get_month_ranges(start_date, end_date)
    total_saved = 0

    for i, (month_start, month_end) in enumerate(months, 1):
        articles = _fetch_guardian_nvda(month_start, month_end)

        # NVDA 관련성 Gemini 선별 (키워드 검색의 false positive 제거)
        selected = _select_nvda_with_gemini(model, articles, month_start)
        new_articles = _filter_existing(es, selected)

        if model:
            for a in new_articles:
                a["summary"] = _summarize(model, a)
                time.sleep(_GEMINI_FREE_TIER_SLEEP)  # 무료 티어: 15RPM

        saved = _bulk_save(es, new_articles)
        total_saved += saved

        if i % 12 == 0 or i == len(months):
            print(f"  {month_start[:7]} ({i}/{len(months)}) 누적 {total_saved}건")
        time.sleep(1.1)

    print(f"[news_collector] NVDA 수집 완료. 총 {total_saved}건")


def _fetch_guardian_nvda(from_date: str, to_date: str) -> list[dict]:
    params = {
        "from-date":   from_date,
        "to-date":     to_date,
        "q":           "nvidia",
        "section":     "technology|business|money",
        "show-fields": "headline,trailText,bodyText",
        "page-size":   200,
        "order-by":    "relevance",
        "api-key":     settings.GUARDIAN_API_KEY,
    }
    try:
        resp = requests.get(_GUARDIAN_URL, params=params, timeout=15)
        if resp.status_code == 429:
            raise RateLimitError()
        resp.raise_for_status()
        return [_parse_guardian(r, "NVDA_DIRECT") for r in resp.json()["response"]["results"]]
    except RateLimitError:
        raise
    except Exception as e:
        print(f"  Guardian NVDA {from_date} 오류: {e}")
        return []


# ─── Gemini 요약 ──────────────────────────────────────────────

def _summarize(model, article: dict) -> str:
    if not article.get("body"):
        return ""
    prompt = _SUMMARY_PROMPT.format(
        date=article["date"],
        source=article["source"],
        title=article["title"],
        body=article["body"],
    )
    try:
        result = model.generate_content(prompt)
        _log_tokens(result.usage_metadata)
        return result.text.strip()
    except Exception as e:
        print(f"  Gemini 요약 오류 ({article['title'][:40]}): {e}")
        return ""


# ─── 파싱 ────────────────────────────────────────────────────

def _parse_guardian(r: dict, category: str) -> dict:
    fields = r.get("fields", {}) or {}
    body = _clean_text(fields.get("bodyText") or fields.get("trailText") or "")
    return {
        "date":         r["webPublicationDate"][:10],
        "published_at": r["webPublicationDate"],
        "category":     category,
        "source":       "guardian",
        "title":        fields.get("headline") or r.get("webTitle", ""),
        "url":          r["webUrl"],
        "body":         body,
    }


# ─── Elasticsearch ────────────────────────────────────────────

def _get_es_client() -> Elasticsearch:
    return Elasticsearch(f"http://{settings.ELASTICSEARCH_HOST}:{settings.ELASTICSEARCH_PORT}")


def _ensure_index(es: Elasticsearch):
    if es.indices.exists(index=_ES_INDEX):
        return
    es.indices.create(
        index=_ES_INDEX,
        body={
            "mappings": {
                "properties": {
                    "date":         {"type": "keyword"},
                    "published_at": {"type": "date"},
                    "category":     {"type": "keyword"},
                    "source":       {"type": "keyword"},
                    "title":        {"type": "text", "analyzer": "english"},
                    "url":          {"type": "keyword"},
                    "body":         {"type": "text", "analyzer": "english"},
                    "summary":      {"type": "text"},
                }
            }
        },
    )
    print(f"[news_collector] ES 인덱스 '{_ES_INDEX}' 생성됨")


def _already_collected(es: Elasticsearch, day: str, category: str) -> bool:
    try:
        resp = es.count(
            index=_ES_INDEX,
            query={"bool": {"must": [
                {"term": {"date": day}},
                {"term": {"category": category}},
            ]}}
        )
        return resp["count"] > 0
    except Exception:
        return False


def _filter_existing(es: Elasticsearch, articles: list[dict]) -> list[dict]:
    if not articles:
        return []
    urls = list({a["url"] for a in articles})
    try:
        resp = es.search(
            index=_ES_INDEX,
            query={"terms": {"url": urls}},
            _source=["url"],
            size=len(urls),
        )
        existing = {h["_source"]["url"] for h in resp["hits"]["hits"]}
    except Exception:
        existing = set()

    seen: set[str] = set()
    result = []
    for a in articles:
        if a["url"] not in existing and a["url"] not in seen:
            seen.add(a["url"])
            result.append(a)
    return result


def _bulk_save(es: Elasticsearch, articles: list[dict]) -> int:
    if not articles:
        return 0
    actions = [{"_index": _ES_INDEX, "_source": a} for a in articles]
    success, _ = helpers.bulk(es, actions, raise_on_error=False)
    return success


# ─── 유틸 ────────────────────────────────────────────────────

def _get_month_ranges(start: str, end: str) -> list[tuple[str, str]]:
    start_dt = date.fromisoformat(start)
    end_dt = date.fromisoformat(end)
    ranges = []
    cur = start_dt.replace(day=1)
    while cur <= end_dt:
        last_day = calendar.monthrange(cur.year, cur.month)[1]
        month_end = cur.replace(day=last_day)
        ranges.append((
            max(cur, start_dt).strftime("%Y-%m-%d"),
            min(month_end, end_dt).strftime("%Y-%m-%d"),
        ))
        cur = cur.replace(month=cur.month + 1) if cur.month < 12 \
            else cur.replace(year=cur.year + 1, month=1)
    return ranges


def _clean_text(text: str) -> str:
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()
