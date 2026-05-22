"""
기업별 뉴스 수집기 - Alpha Vantage NEWS_SENTIMENT API

Guardian의 거시/지정학 뉴스를 보완하는 기업 전용 레이어.
ticker 기반으로 M7 기업의 실제 투자 관련 뉴스를 수집한다.

선별 프롬프트 없음 — ticker 기반으로 이미 필터링되므로 바로 요약.

ES 저장 필드:
  source_type = "company"   ← Guardian 뉴스와 구분
  tickers     = ["NVDA"]    ← 관련 종목

Alpha Vantage 무료 플랜: 25 req/일
7종목 × 1개월 = 7 req → 충분
"""

import json
import re
import time
from datetime import datetime, timezone

import requests
import google.generativeai as genai

from config import settings
from db.pg_news import filter_existing, bulk_save

_AV_URL      = "https://www.alphavantage.co/query"
_M7_TICKERS  = ["NVDA", "AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA"]
_GEMINI_SLEEP = 4.5

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

아래 기업 뉴스 기사를 읽고 네 가지를 생성하세요.
반드시 순수 JSON만 출력하세요. markdown / code block / 설명 문장 일절 금지.

[title_ko]
- 한국 경제뉴스 스타일의 자연스러운 한국어 제목
- 원문 핵심 의미 유지, 직역투 금지
- 기업명·기관명은 통용 한국어 표기 사용
- 한 줄로 작성

[brief]
- 이 기사의 핵심 내용을 한 문장으로 요약
- 해당 기업 투자자가 즉시 핵심 맥락을 파악할 수 있어야 함
- 팩트·수치 중심. 해석·전망·투자 의견 금지
- 좋은 예: "엔비디아의 데이터센터 매출이 전년 대비 87% 증가했다"
- 나쁜 예: "엔비디아 주가에 긍정적으로 작용할 전망이다"

[summary]
- 첫 문장은 기사의 핵심 내용을 가장 압축적으로 전달하세요
- 한국어 요약 본문만 출력 (제목·레이블·불릿·번호 목록 금지)
- markdown 사용 금지
- 자연스러운 뉴스 기사 요약 형태로 작성
- 의미가 전환되는 경우에만 문단 분리. 문단 사이에는 빈 줄(\\n\\n) 사용
- 매우 짧은 기사라면 단일 문단 허용
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

기사의 핵심 투자 narrative와 직접적으로 관련된 theme만 선택하세요.
간접적으로 연관된 theme는 포함하지 마세요.

출력 형식 (이 외의 텍스트 일절 금지):
{{"title_ko": "...", "brief": "...", "summary": "...", "themes": ["THEME1"]}}

종목: {ticker}
날짜: {date}
출처: {source}
제목: {title}
내용: {body}"""


def collect(tickers: list[str] | None = None, start_date: str = "2020-02-01", end_date: str = "2020-02-29") -> None:
    """
    Alpha Vantage에서 기업별 뉴스를 수집해 PostgreSQL에 저장한다.
    선별 단계 없이 ticker 기반 필터링된 기사를 바로 요약.
    """
    if not settings.ALPHA_VANTAGE_API_KEY:
        print("[company_news] ALPHA_VANTAGE_API_KEY가 설정되지 않았습니다.")
        return

    target = tickers or _M7_TICKERS

    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel(settings.GEMINI_MODEL)

    total_saved = 0
    for ticker in target:
        saved = _collect_ticker(model, ticker, start_date, end_date)
        total_saved += saved
        print(f"[{ticker}] {saved}건 저장\n")

    print(f"[company_news] 전체 완료. 총 {total_saved}건")


def _collect_ticker(model, ticker: str, start_date: str, end_date: str) -> int:
    print(f"[{ticker}] 수집 시작: {start_date} ~ {end_date}")

    articles = _fetch_alpha_vantage(ticker, start_date, end_date)
    if not articles:
        print(f"[{ticker}] 기사 없음")
        return 0

    print(f"[{ticker}] {len(articles)}건 수집됨, 중복 제거 중...")
    articles = filter_existing(articles)
    print(f"[{ticker}] {len(articles)}건 신규, 요약 시작...")

    if not articles:
        return 0

    for a in articles:
        r = _summarize(model, a)
        a["title_ko"] = r["title_ko"]
        a["brief"]    = r["brief"]
        a["summary"]  = r["summary"]
        a["themes"]   = r["themes"]
        a["llm_raw"]  = r["llm_raw"]
        time.sleep(_GEMINI_SLEEP)

    return bulk_save(articles)


def _fetch_alpha_vantage(ticker: str, start_date: str, end_date: str) -> list[dict]:
    # Alpha Vantage time_from/time_to 포맷: YYYYMMDDThhmm
    time_from = start_date.replace("-", "") + "T0000"
    time_to   = end_date.replace("-", "") + "T2359"

    params = {
        "function":  "NEWS_SENTIMENT",
        "tickers":   ticker,
        "time_from": time_from,
        "time_to":   time_to,
        "limit":     200,
        "sort":      "EARLIEST",
        "apikey":    settings.ALPHA_VANTAGE_API_KEY,
    }
    try:
        resp = requests.get(_AV_URL, params=params, timeout=20, verify=False)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        print(f"  [{ticker}] API 오류: {e}")
        return []

    if "Information" in data:
        print(f"  [{ticker}] API 한도 도달: {data['Information']}")
        return []

    feed = data.get("feed", [])
    articles = []
    for item in feed:
        title = (item.get("title") or "").strip()
        body  = (item.get("summary") or "").strip()
        url   = item.get("url", "")
        if not title or not body:
            continue

        # published 시각 파싱: "20200201T163927"
        raw_time = item.get("time_published", "")
        try:
            dt = datetime.strptime(raw_time, "%Y%m%dT%H%M%S").replace(tzinfo=timezone.utc)
            date_str     = dt.strftime("%Y-%m-%d")
            published_at = dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        except Exception:
            date_str     = start_date
            published_at = None

        articles.append({
            "date":         date_str,
            "published_at": published_at,
            "category":     "COMPANY",
            "source_type":  "company",
            "tickers":      [ticker],
            "source":       item.get("source", "alphavantage"),
            "title":        title,
            "url":          url,
            "body":         body,
        })

    return articles


def _summarize(model, article: dict) -> dict:
    _empty = {"title_ko": "", "brief": "", "summary": "", "themes": ["OTHER"], "llm_raw": ""}
    if not article.get("body"):
        return _empty

    ticker = article.get("tickers", [""])[0]
    prompt = _SUMMARY_PROMPT.format(
        ticker=ticker,
        date=article.get("date", ""),
        source=article.get("source", ""),
        title=article.get("title", ""),
        body=article["body"],
    )
    try:
        result = model.generate_content(prompt)
        raw    = result.text.strip()
        clean  = re.sub(r"```(?:json)?\s*", "", raw).strip().rstrip("`").strip()
        parsed = json.loads(clean)

        themes = [t for t in parsed.get("themes", []) if isinstance(t, str) and t in _VALID_THEMES][:3]
        if not themes:
            themes = ["OTHER"]

        return {
            "title_ko": parsed.get("title_ko", "").strip(),
            "brief":    parsed.get("brief", "").strip(),
            "summary":  parsed.get("summary", "").strip(),
            "themes":   themes,
            "llm_raw":  raw,
        }
    except Exception as e:
        print(f"  요약 오류 ({article.get('title', '')[:40]}): {e}")
        return _empty


