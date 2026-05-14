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
2 = 약한 관련성이 있지만 일부 투자자에겐 의미 있을 수 있는 뉴스
1 = 관련성은 있으나 중요도가 매우 낮은 뉴스

[선별 원칙]

* 너무 엄격하게 필터링하지 마세요.
* 중요한 뉴스를 놓치는 것보다 약간 더 넓게 포함하는 것을 우선하세요.
* 동일 사건은 가장 포괄적인 기사 1개만 선택하세요.
* 헤드라인의 자극성보다 실제 정보 가치를 우선 평가하세요.
* "당시 투자자가 참고할 만했는가"를 가장 중요하게 판단하세요.

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

_TITLE_KO_PROMPT = """\
당신은 글로벌 금융 뉴스 헤드라인 전문 번역 시스템입니다.

입력된 영어 뉴스 헤드라인을
한국 경제뉴스 스타일의 자연스러운 한국어 제목으로 번역하세요.

출력 규칙:
- 번역된 헤드라인만 출력
- 설명, 부연, 따옴표, 괄호 설명 추가 금지
- "번역:" 같은 표현 금지
- markdown 사용 금지
- 한 줄로 출력

번역 규칙:
- 원문의 핵심 의미 유지
- 과장되거나 감정적인 표현 금지
- 클릭 유도형 표현 제거
- 한국 경제뉴스에서 실제 사용할 법한 자연스러운 문장으로 작성
- 직역투 표현 금지
- 기업명, 기관명, 국가명은 일반적으로 알려진 한국어 표기 사용
- ticker symbol이나 고유명사는 필요 시 유지
- 숫자, 비율, 금액, 금리 정보는 가능하면 유지
- 의미가 불분명해지지 않는 범위 내에서 간결하게 작성
- 투자자가 빠르게 핵심을 이해할 수 있게 작성

헤드라인: {title}"""

_SUMMARY_PROMPT = """\
당신은 글로벌 뉴스 전문 번역 및 요약 시스템입니다.

입력된 영어 뉴스 기사를 읽고,
핵심 정보만 한국어로 자연스럽고 가독성 좋게 요약하세요.

출력 형식 규칙:
- 오직 요약 본문만 출력
- 다른 문장은 절대 추가하지 말 것
- "다음은 요약입니다", "요약:", "핵심 내용:" 같은 표현 금지
- 제목 생성 금지
- 번호 목록 및 불릿 포인트 금지
- markdown 사용 금지
- 일반 문단 형태로만 작성
- 가독성을 위해 의미 단위로 자연스럽게 줄바꿈 사용 가능
- 문맥이 전환되면 새 줄로 구분 가능
- 단, 목록 형태처럼 작성하지 말 것
- 지나치게 긴 한 문단은 피할 것

작성 규칙:
- 기사 내용이 짧으면 짧게, 중요 정보가 많으면 더 자세히 작성
- 억지로 분량을 맞추지 말 것
- 핵심 정보 밀도를 우선할 것
- 무엇이 발생했는지 명확하게 설명
- 중요한 기업, 인물, 기관, 국가명 유지
- 핵심 수치와 데이터는 가능하면 포함
- 시장 또는 산업 맥락이 중요하면 간략히 포함
- 향후 변수나 리스크가 중요하면 포함
- 원문의 의미를 왜곡하지 말 것
- 한국인이 읽기에 자연스러운 문장으로 번역할 것
- 직역투 표현 금지
- 세부 설명보다 핵심 사실 전달을 우선할 것

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
            title_ko, summary = _summarize(model, hit["_source"])
            es.update(index=_ES_INDEX, id=hit["_id"], body={"doc": {"title_ko": title_ko, "summary": summary}})
            total += 1
            time.sleep(_GEMINI_FREE_TIER_SLEEP)
        print(f"[summarize_pending] {total}건 완료...")

    print(f"[summarize_pending] 완료. 총 {total}건")


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
            title_ko, summary = _summarize(model, src)
            es.update(index=_ES_INDEX, id=hit["_id"], body={"doc": {"title_ko": title_ko, "summary": summary}})
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
                title_ko, summary = _summarize(model, a)
                a["title_ko"] = title_ko
                a["summary"]  = summary
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
                title_ko, summary = _summarize(model, a)
                a["title_ko"] = title_ko
                a["summary"]  = summary
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

def _summarize(model, article: dict) -> tuple[str, str]:
    """
    (title_ko, summary) 튜플 반환.
    헤드라인 번역과 본문 요약을 각각 별도 호출로 처리.
    """
    title_ko = _translate_title(model, article.get("title", ""))
    time.sleep(_GEMINI_FREE_TIER_SLEEP)
    summary  = _summarize_body(model, article)
    return title_ko, summary


def _translate_title(model, title: str) -> str:
    if not title:
        return ""
    prompt = _TITLE_KO_PROMPT.format(title=title)
    try:
        result = model.generate_content(prompt)
        _log_tokens(result.usage_metadata)
        return result.text.strip()
    except Exception as e:
        print(f"  제목 번역 오류 ({title[:40]}): {e}")
        return ""


def _summarize_body(model, article: dict) -> str:
    if not article.get("body"):
        return ""
    prompt = _SUMMARY_PROMPT.format(
        date=article.get("date", ""),
        source=article.get("source", ""),
        title=article.get("title", ""),
        body=article["body"],
    )
    try:
        result = model.generate_content(prompt)
        _log_tokens(result.usage_metadata)
        return result.text.strip()
    except Exception as e:
        print(f"  본문 요약 오류 ({article.get('title','')[:40]}): {e}")
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
                    "title_ko":     {"type": "text"},
                    "url":          {"type": "keyword"},
                    "body":         {"type": "text", "analyzer": "english"},
                    "summary":      {"type": "text"},
                    "importance":   {"type": "integer"},  # 당시 투자자 중요도 (1~5)
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
