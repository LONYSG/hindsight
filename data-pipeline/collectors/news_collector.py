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

from config import settings
from db.pg_news import (
    already_collected, filter_existing, bulk_save,
    get_pending_summary, get_pending_summarize_initial,
    update_llm_fields, get_distinct_dates, get_articles_by_date,
    update_importance, truncate_news,
)
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

[투자 참고 가치 점수 기준]

각 뉴스에 대해 투자 참고 가치를 1~5점으로 평가하세요.
기준은 "당시 미국 투자자 관점에서 투자 판단에 참고할 가치가 얼마나 있는가"입니다.

이 점수는 "시장 충격도"가 아닌 "투자자가 참고할 이유가 있는가"를 측정합니다.
FOMC·CPI 같은 대형 이벤트뿐 아니라, 공급망 변화·AI 투자 확대·기업 전략 변화처럼
당장은 조용하지만 투자 판단에 의미 있는 뉴스도 높은 점수를 받을 수 있습니다.
단순 화제성이나 클릭 유도성 헤드라인은 낮게 평가하세요.

이 점수는 향후 주가 상승 여부를 예측하는 것이 아닙니다.
당시 투자자가 판단 과정에서 참고할 가능성이 있었는지를 기준으로 평가하세요.

5 = 대부분의 투자자가 반드시 참고해야 할 수준의 뉴스
4 = 특정 산업·기업 투자자에게 매우 중요한 뉴스
3 = 투자 판단에 충분히 참고 가치가 있는 뉴스
2 = 제한적이지만 일부 투자자에게 의미 있을 수 있는 뉴스
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
선택한 기사 번호와 relevance score를 한 줄씩, 파이프(|)로 구분하여 출력하세요.
relevance score 2점 이상인 기사만 포함하세요.

예시:
3|5
7|4
12|3
18|2"""

# 선별 최소 relevance score (이 이상인 기사만 저장)
_SELECTION_MIN_RELEVANCE = 2

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

아래 뉴스 기사를 읽고 네 가지를 생성하세요.
반드시 순수 JSON만 출력하세요. markdown / code block / 설명 문장 일절 금지.

[title_ko]
- 한국 경제뉴스 스타일의 자연스러운 한국어 제목
- 원문 핵심 의미 유지, 직역투 금지
- 기업명·기관명은 통용 한국어 표기 사용
- 숫자·비율·금액 정보 가능하면 유지
- 한 줄로 작성

[brief]
- 이 기사의 핵심 내용을 한 문장으로 요약
- 제목만 읽은 투자자가 즉시 핵심 맥락을 파악할 수 있어야 함
- 팩트·수치 중심. 해석·전망·투자 의견 금지
- 좋은 예: "중국 공장 가동 중단으로 아이폰 공급량이 15% 감소할 것으로 예상됐다"
- 나쁜 예: "애플에 악재로 작용할 전망이다"

[summary]
- 첫 문장은 기사의 핵심 내용을 가장 압축적으로 전달하세요
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
{{"title_ko": "...", "brief": "...", "summary": "...", "themes": ["THEME1", "THEME2"]}}

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
    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel(settings.GEMINI_MODEL)

    try:
        _collect_base(start_date, end_date, model, summarize)
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
    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel(settings.GEMINI_MODEL)

    total = 0
    while True:
        articles = get_pending_summarize_initial(batch_size)
        if not articles:
            break
        for a in articles:
            r = _summarize(model, a)
            update_llm_fields(a["id"], r["title_ko"], r["brief"], r["summary"], r["themes"], r["llm_raw"])
            total += 1
            time.sleep(_GEMINI_FREE_TIER_SLEEP)
        print(f"[summarize_pending] {total}건 완료...")

    print(f"[summarize_pending] 완료. 총 {total}건")


def reset_news():
    """
    news 테이블 전체 초기화 (재수집 전 실행).
    """
    truncate_news()
    print("[reset_news] news 테이블 초기화 완료")


def re_summarize_all(batch_size: int = 50, max_count: int = 0):
    """
    프롬프트 개선 후 전체 재요약.
    brief 필드가 없는 기사만 처리 → 중단 후 재실행해도 이어서 진행 가능.
    max_count > 0 이면 해당 건수만 처리 후 종료 (일일 API 한도 제어용).
    """
    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel(settings.GEMINI_MODEL)

    total = 0
    offset = 0
    while True:
        if max_count > 0 and total >= max_count:
            print(f"[re_summarize_all] max_count({max_count}) 도달. 중단.")
            break
        articles = get_pending_summary(batch_size, offset)
        if not articles:
            break
        for a in articles:
            if max_count > 0 and total >= max_count:
                break
            r = _summarize(model, a)
            update_llm_fields(a["id"], r["title_ko"], r["brief"], r["summary"], r["themes"], r["llm_raw"])
            total += 1
            time.sleep(_GEMINI_FREE_TIER_SLEEP)
        offset += batch_size
        print(f"[re_summarize_all] {total}건 완료...")

    print(f"[re_summarize_all] 전체 완료. 총 {total}건")
    print_token_stats()


def re_score_all():
    """
    기존 수집된 기사의 투자 참고 가치 점수(importance) 재평가.
    변경된 _SELECTION_PROMPT 기준으로 날짜별 재점수화.
    """
    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel(settings.GEMINI_MODEL)

    dates = get_distinct_dates()
    total = 0

    for day_str in dates:
        articles = get_articles_by_date(day_str)
        if not articles:
            continue

        headlines = "\n".join(f"{i+1}. [{a['category']}] {a['title']}" for i, a in enumerate(articles))
        prompt = _SELECTION_PROMPT.format(date=day_str, headlines=headlines)

        try:
            result = model.generate_content(prompt)
            _log_tokens(result.usage_metadata)

            score_map = {}
            for line in result.text.strip().split("\n"):
                line = line.strip()
                if "|" not in line:
                    continue
                parts = line.split("|")
                if len(parts) != 2 or not parts[0].strip().isdigit() or not parts[1].strip().isdigit():
                    continue
                idx = int(parts[0].strip()) - 1
                score = int(parts[1].strip())
                if 0 <= idx < len(articles):
                    score_map[articles[idx]["id"]] = score

            for art in articles:
                update_importance(art["id"], score_map.get(art["id"], 1))
                total += 1

            time.sleep(_GEMINI_FREE_TIER_SLEEP)
            print(f"  [{day_str}] {len(articles)}건 재점수화 완료")

        except Exception as e:
            print(f"  [{day_str}] 재점수화 오류: {e}")

    print(f"[re_score_all] 완료. 총 {total}건")
    print_token_stats()


# ─── 베이스 레이어 ────────────────────────────────────────────

def _collect_base(start_date: str, end_date: str, model, summarize: bool):
    start = date.fromisoformat(start_date)
    end = date.fromisoformat(end_date)
    current = start
    total_days = (end - start).days + 1
    total_saved = 0

    while current <= end:
        day_str = current.strftime("%Y-%m-%d")

        # 이미 처리된 날 스킵 (BUSINESS 기준으로 판단)
        if already_collected(day_str, "BUSINESS"):
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
        new_articles = filter_existing(selected)

        if summarize:
            for a in new_articles:
                r = _summarize(model, a)
                a["title_ko"] = r["title_ko"]
                a["brief"]    = r["brief"]
                a["summary"]  = r["summary"]
                a["themes"]   = r["themes"]
                a["llm_raw"]  = r["llm_raw"]
                time.sleep(_GEMINI_FREE_TIER_SLEEP)

        saved = bulk_save(new_articles)
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
            if 0 <= idx < len(articles) and score >= _SELECTION_MIN_RELEVANCE:
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
    JSON 단일 호출로 title_ko + brief + summary + themes 생성.
    반환: {"title_ko": str, "brief": str, "summary": str, "themes": list, "llm_raw": str}
    """
    _empty = {"title_ko": "", "brief": "", "summary": "", "themes": ["OTHER"], "llm_raw": ""}
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
        brief    = parsed.get("brief", "").strip()
        summary  = parsed.get("summary", "").strip()
        themes   = [
            t for t in parsed.get("themes", [])
            if isinstance(t, str) and t in _VALID_THEMES
        ][:3]
        if not themes:
            themes = ["OTHER"]

        return {"title_ko": title_ko, "brief": brief, "summary": summary, "themes": themes, "llm_raw": raw}

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




# ─── 유틸 ────────────────────────────────────────────────────

def _clean_text(text: str) -> str:
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()
