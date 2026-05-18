"""
뉴스 수집기 - The Guardian API

하루씩 쿼리 → Gemini 선별 → 선별된 기사만 저장
  Guardian BUSINESS    (business|money 섹션, 하루치 전체)
  Guardian TECHNOLOGY  (technology 섹션, 하루치 전체)
  Guardian WORLD       (world|us-news|politics 섹션, 하루치 전체)
  → 전체 헤드라인을 Gemini에 전달 → 미국 투자자 관점 중요도 2점 이상만 선별

Guardian 500회/일 한도 도달 시 자동 중단 → 재실행 시 이어서 진행
URL 기준 중복 제거
"""

import json
import re
import time
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
당신은 미국 주식 투자자를 위한 금융 뉴스 필터 시스템입니다.

아래는 {date} 하루 동안 수집된 뉴스 헤드라인 목록입니다.

목표는 단순히 가장 큰 뉴스만 고르는 것이 아니라,
당시 미국 주식 투자자가 투자 판단에 참고할 가능성이 있는 뉴스들을 선별하는 것입니다.

현재 시장 반응이 크지 않았더라도,
기업 성장성, 산업 변화, 기술 변화, 거시경제 흐름,
또는 투자 심리에 영향을 줄 가능성이 있다면 포함할 수 있습니다.

특히 당시에는 중요도가 낮아 보였더라도,
이후 산업 변화나 시장 흐름 측면에서 의미가 있었을 가능성이 있는 뉴스는 포함할 수 있습니다.

단, 억지 해석이나 결과론적 과대평가는 피하고,
실제 투자자가 참고할 가치가 있는 정보인지 기준으로 판단하세요.

[포함 기준]

다음과 관련된 뉴스는 우선적으로 포함하세요:

* 미국 증시(S&P500, Nasdaq) 관련 이슈
* 미국 및 글로벌 거시경제 (Fed, 금리, CPI, 고용, GDP, 국채금리, 환율, 유동성 등)
* 주요 기업 뉴스 (실적, 가이던스, 제품 출시, 공급망, 계약, 투자, 구조조정, CEO 발언 등)
* 기술 및 산업 변화 (AI, 반도체, 클라우드, 전기차, 에너지, 바이오, 로봇, 방산, 우주 등)
* 글로벌 지정학 및 정책 변화 (중국, 대만, 중동, 러시아, 관세, 제재, 수출규제 등)
* 시장 심리에 영향을 줄 수 있는 이벤트
* 장기적으로 중요해질 가능성이 있는 산업/기술 변화
* 당시 투자자들이 관심 있게 볼 가능성이 있는 뉴스

미국 뉴스가 아니더라도,
미국 기업·산업·시장에 영향을 줄 가능성이 있다면 포함하세요.

[제외 기준]

다음 유형은 제외하세요:

* 미국 투자자와 관련성이 낮은 지역 로컬 뉴스
* 영국/유럽 지역 내수 위주 뉴스
* 스포츠, 연예, 문화 뉴스
* 일반 사건사고 및 범죄 뉴스
* 투자 판단과 관련성이 낮은 정치 공방
* 지나치게 지역적인 사회 이슈
* 시장 및 산업 영향이 거의 없는 단순 화제성 기사

[중요도 점수 기준]

각 뉴스에 대해 당시 기준 투자 중요도를 1~5점으로 평가하세요.
기준은 "당시 투자자가 일반적으로 얼마나 중요하게 받아들였을 가능성이 있는가"입니다.

5 = 시장 전체 또는 핵심 산업에 매우 큰 영향을 주는 이벤트
4 = 주요 기업/산업 흐름에 중요한 뉴스
3 = 투자자가 참고할 가치가 높은 뉴스
2 = 특정 산업·기업·거시 흐름에 제한적으로 관련 있는 뉴스
1 = 미국 투자자 관점에서 참고 가치가 거의 없는 뉴스

[선별 원칙]

* 너무 엄격하게 필터링하지 마세요.
* 중요한 뉴스를 놓치는 것보다 약간 더 넓게 포함하는 것을 우선하세요.
* 동일 사건은 가장 포괄적인 기사 1개만 선택하세요.
* 헤드라인의 자극성보다 실제 정보 가치를 우선 평가하세요.
* "당시 투자자가 참고할 만했는가"를 가장 중요하게 판단하세요.
* 선택 기사 수에는 제한이 없습니다. 하루에 3개만 선택될 수도 있고 30개가 선택될 수도 있습니다.

헤드라인 목록:
{headlines}

응답 형식 (반드시 준수):
선택한 기사 번호와 중요도를 한 줄씩, 파이프(|)로 구분하여 출력하세요.
중요도 2점 이상인 기사만 포함하세요.

예시:
3|5
7|4
12|3
18|2"""

# 선별 최소 중요도 (이 이상인 기사만 저장)
_SELECTION_MIN_SCORE = 2

# 무료 티어: 분당 15회 호출 → 호출 간 최소 4초
_GEMINI_FREE_TIER_SLEEP = 4.5

_VALID_THEMES = {
    "AI", "SEMICONDUCTOR", "CLOUD", "SOFTWARE", "ROBOTICS",
    "EV", "ENERGY", "NUCLEAR", "BIOTECH", "HEALTHCARE",
    "FINANCE", "CRYPTO", "DEFENSE", "AEROSPACE",
    "GEOPOLITICS", "CHINA", "TRADE",
    "MACRO", "FED", "RATE", "INFLATION", "SUPPLY_CHAIN",
    "CONSUMER", "RETAIL", "MANUFACTURING", "CYBERSECURITY", "DATA_CENTER",
    "OTHER",
}

_SUMMARY_PROMPT = """\
당신은 글로벌 금융 뉴스 분석 시스템입니다.

아래 뉴스 기사를 읽고 세 가지를 생성하세요.
반드시 순수 JSON만 출력하세요. markdown / code block / 설명 문장 일절 금지.

[title_ko]
- 한국 경제뉴스 스타일의 자연스러운 한국어 제목
- 원문 핵심 의미 유지, 직역투 금지
- 기업명·기관명은 통용 한국어 표기 사용
- 숫자·비율·금액 정보 가능하면 유지
- 한 줄로 작성

[summary]
- 한국어 요약 본문만 출력 (제목·레이블·불릿·번호 목록 금지)
- markdown 사용 금지
- 자연스러운 뉴스 기사 요약 형태로 작성
- 의미가 전환되는 경우에만 문단 분리. 문단 사이에는 빈 줄(\n\n) 사용
- 매우 짧은 기사라면 단일 문단 허용. 억지 문단 분리 금지
- 핵심 정보 밀도 우선, 억지 분량 맞추기 금지
- 핵심 수치·데이터 포함
- 추측성 전망이나 투자 조언 금지. 기사에 나온 사실 중심으로만 작성

[themes]
아래 허용 목록에서만 선택. 최대 3개. 애매하면 억지 분류 말고 OTHER 사용.

허용 목록:
AI, SEMICONDUCTOR, CLOUD, SOFTWARE, ROBOTICS,
EV, ENERGY, NUCLEAR, BIOTECH, HEALTHCARE,
FINANCE, CRYPTO, DEFENSE, AEROSPACE,
GEOPOLITICS, CHINA, TRADE,
MACRO, FED, RATE, INFLATION, SUPPLY_CHAIN,
CONSUMER, RETAIL, MANUFACTURING, CYBERSECURITY, DATA_CENTER,
OTHER

태그 정의 (유사 태그 구분 기준 포함):
- AI: 인공지능 기술·제품·연구·기업
- SEMICONDUCTOR: 반도체 설계·제조·장비·소재
- CLOUD: 클라우드 인프라·서비스·하이퍼스케일러
- SOFTWARE: 소프트웨어·SaaS·플랫폼·앱
- ROBOTICS: 로봇공학·자동화 하드웨어
- EV: 전기차·배터리·충전 인프라
- ENERGY: 에너지·석유·가스·재생에너지
- NUCLEAR: 원자력·소형모듈원자로(SMR)
- BIOTECH: 바이오기술·신약개발·임상
- HEALTHCARE: 의료기기·병원·보험·헬스케어 시스템
- FINANCE: 금융·은행·보험·자산운용
- CRYPTO: 암호화폐·블록체인·디지털자산
- DEFENSE: 방산·무기·군사기술
- AEROSPACE: 항공우주·위성·발사체
- GEOPOLITICS: 지정학·전쟁·국제정치 (중국 관련은 CHINA 사용)
- CHINA: 중국 경제·규제·공급망·대만 이슈
- TRADE: 무역·관세·수출규제·통상정책
- MACRO: 거시경제·GDP·고용·경기지표 (FED·RATE·INFLATION 제외)
- FED: 연준 정책·FOMC 결정·연준 발언
- RATE: 금리 인상·인하·채권금리 변화
- INFLATION: CPI·PPI·물가·인플레이션 지표
- SUPPLY_CHAIN: 공급망·물류·부품 수급
- CONSUMER: 소비자 지출·소비심리
- RETAIL: 소매·유통·이커머스
- MANUFACTURING: 제조업·공장·생산지수·PMI
- CYBERSECURITY: 사이버보안·해킹·데이터침해
- DATA_CENTER: 데이터센터·AI 인프라·서버·전력 수요
- OTHER: 위 테마에 해당하지 않는 경우

기사의 핵심 투자 narrative와 직접적으로 관련된 theme만 선택하세요.
간접적으로 연관된 theme는 포함하지 마세요.

출력 형식 (이 외의 텍스트 일절 금지):
{{"title_ko": "...", "summary": "...", "themes": ["THEME1", "THEME2"]}}

날짜: {date}
출처: {source}
제목: {title}
내용: {body}"""


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
        _collect_base(es, start_date, end_date, model, summarize)

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
            r = _summarize(model, hit["_source"])
            es.update(index=_ES_INDEX, id=hit["_id"], body={"doc": {
                "title_ko": r["title_ko"],
                "summary":  r["summary"],
                "themes":   r["themes"],
                "llm_raw":  r["llm_raw"],
            }})
            total += 1
            time.sleep(_GEMINI_FREE_TIER_SLEEP)
        print(f"[summarize_pending] {total}건 완료...")

    print(f"[summarize_pending] 완료. 총 {total}건")


def reset_index():
    """
    ES 인덱스 초기화 (재수집 전 실행).
    기존 데이터 전체 삭제 후 새 매핑으로 재생성.
    """
    es = _get_es_client()
    if es.indices.exists(index=_ES_INDEX):
        es.indices.delete(index=_ES_INDEX)
        print(f"[reset_index] '{_ES_INDEX}' 인덱스 삭제 완료")
    _ensure_index(es)
    print(f"[reset_index] '{_ES_INDEX}' 인덱스 재생성 완료 (importance 필드 포함)")


def re_summarize_all(batch_size: int = 50):
    """
    프롬프트 개선 후 전체 재요약.
    기존 summary/title_ko 를 새 프롬프트로 덮어쓴다.
    하루 500회 무료 쿼터 → 약 500건/일 처리 가능.
    """
    es = _get_es_client()
    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel(settings.GEMINI_MODEL)

    total = 0
    page = 0
    while True:
        resp = es.search(
            index=_ES_INDEX,
            query={"match_all": {}},
            _source=["title", "date", "source", "body"],
            size=batch_size,
            from_=page * batch_size,
            sort=[{"date": "asc"}],
        )
        hits = resp["hits"]["hits"]
        if not hits:
            break
        for hit in hits:
            src = hit["_source"]
            if not src.get("body"):
                continue
            r = _summarize(model, src)
            es.update(index=_ES_INDEX, id=hit["_id"], body={"doc": {
                "title_ko": r["title_ko"],
                "summary":  r["summary"],
                "themes":   r["themes"],
                "llm_raw":  r["llm_raw"],
            }})
            total += 1
            time.sleep(_GEMINI_FREE_TIER_SLEEP)
        page += 1
        print(f"[re_summarize_all] {total}건 완료...")

    print(f"[re_summarize_all] 전체 완료. 총 {total}건")
    print_token_stats()


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
                r = _summarize(model, a)
                a["title_ko"] = r["title_ko"]
                a["summary"]  = r["summary"]
                a["themes"]   = r["themes"]
                a["llm_raw"]  = r["llm_raw"]
                time.sleep(_GEMINI_FREE_TIER_SLEEP)

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
    """
    전체 헤드라인을 Gemini에 전달해 선별 + 중요도 점수 부여.
    응답 형식: 번호|중요도 (한 줄씩)
    _SELECTION_MIN_SCORE 이상인 기사만 반환하며, importance 필드를 추가한다.
    """
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

        selected = []
        for line in result.text.strip().split("\n"):
            line = line.strip()
            if "|" not in line:
                continue
            parts = line.split("|")
            if len(parts) != 2:
                continue
            num_str, score_str = parts[0].strip(), parts[1].strip()
            if not num_str.isdigit() or not score_str.isdigit():
                continue
            idx   = int(num_str) - 1
            score = int(score_str)
            if 0 <= idx < len(articles) and score >= _SELECTION_MIN_SCORE:
                article = articles[idx].copy()
                article["importance"] = score
                selected.append(article)

        if not selected:
            print(f"  [{day}] 선별 결과 없음 (fallback: 상위 3건, importance=2)")
            fallback = [dict(a, importance=2) for a in articles[:3]]
            return fallback

        return selected

    except Exception as e:
        print(f"  Gemini 선별 오류 ({day}): {e}")
        return [dict(a, importance=2) for a in articles[:3]]


# ─── Gemini 요약 ──────────────────────────────────────────────

def _summarize(model, article: dict) -> dict:
    """
    JSON 단일 호출로 title_ko + summary + themes 생성.
    반환: {"title_ko": str, "summary": str, "themes": list, "llm_raw": str}
    """
    _empty = {"title_ko": "", "summary": "", "themes": ["OTHER"], "llm_raw": ""}
    if not article.get("body"):
        return _empty

    prompt = _SUMMARY_PROMPT.format(
        date=article.get("date", ""),
        source=article.get("source", ""),
        title=article.get("title", ""),
        body=article["body"],
    )
    try:
        result = model.generate_content(prompt)
        _log_tokens(result.usage_metadata)
        raw = result.text.strip()

        clean = re.sub(r"```(?:json)?\s*", "", raw).strip().rstrip("`").strip()
        parsed = json.loads(clean)

        title_ko = parsed.get("title_ko", "").strip()
        summary  = parsed.get("summary", "").strip()
        themes   = [
            t for t in parsed.get("themes", [])
            if isinstance(t, str) and t in _VALID_THEMES
        ][:3]
        if not themes:
            themes = ["OTHER"]

        return {"title_ko": title_ko, "summary": summary, "themes": themes, "llm_raw": raw}

    except Exception as e:
        print(f"  요약 오류 ({article.get('title', '')[:40]}): {e}")
        return _empty


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
                    "title_ko":     {"type": "text"},
                    "url":          {"type": "keyword"},
                    "body":         {"type": "text", "analyzer": "english"},
                    "summary":      {"type": "text"},
                    "importance":   {"type": "integer"},
                    "themes":       {"type": "keyword"},
                    "llm_raw":      {"type": "text", "index": False},
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

def _clean_text(text: str) -> str:
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()
