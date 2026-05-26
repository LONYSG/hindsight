"""
데이터 파이프라인 통합 실행용 데모 진입점 (수동 실행 전용).

실제 운영은 .github/workflows/ 의 개별 워크플로우가 담당한다.
  - collect_news.yml    : Guardian + Alpha Vantage 수집 → Gemini 요약 (월 1회/일)
  - collect_macro.yml   : FRED + yfinance 거시지표 수집
  - collect_etf.yml     : 섹터 ETF 주가 수집
  - collect_calendar.yml: FOMC / CPI / EARNINGS 캘린더 적재
"""
from datetime import date
from collectors.price_collector import collect as collect_price
from collectors.macro_collector import collect as collect_macro
from collectors.news_collector import collect as collect_news
from collectors.company_news_collector import collect as collect_company_news
from processors.event_detector import detect as detect_events
from processors.calendar_event_loader import load as load_calendar_events


def main():
    print("Hindsight 데이터 파이프라인 시작")
    today = date.today().strftime("%Y-%m-%d")

    # 주가 수집 (Tiingo) — 기술지표 계산을 위해 시작점 이전 80일치 확보
    collect_price(ticker="NVDA", start_date="2019-10-01", end_date=today)

    # 거시지표 수집 (FRED + yfinance)
    collect_macro(start_date="2019-10-01", end_date=today)

    # 이벤트 감지 (PRICE_SPIKE, VOLUME_SPIKE)
    detect_events(ticker="NVDA")

    # 캘린더 이벤트 (FOMC, CPI, EARNINGS)
    load_calendar_events(start_date="2019-10-01", end_date=today)

    # 글로벌 거시 뉴스 (Guardian, summarize=False 로 두고 별도 단계에서 요약)
    collect_news(start_date="2020-02-01", end_date=today, summarize=False)

    # 기업 뉴스 (Alpha Vantage NEWS_SENTIMENT, ticker 필터)
    collect_company_news(start_date="2020-02-01", end_date=today)


if __name__ == "__main__":
    main()
