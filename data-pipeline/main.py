"""
데이터 파이프라인 진입점.
수집기(collector)들을 순서대로 실행한다.
"""
from datetime import date
from collectors.price_collector import collect as collect_price
from collectors.macro_collector import collect as collect_macro
from collectors.news_collector import collect as collect_news
from processors.event_detector import detect as detect_events


def main():
    print("Hindsight 데이터 파이프라인 시작")

    today = date.today().strftime("%Y-%m-%d")

    # NVDA 주가 수집: 코로나 직전 시작점(2020-02-01) 이전 데이터부터 오늘까지
    collect_price(ticker="NVDA", start_date="2019-10-01", end_date=today)

    # 거시지표 수집 (기준금리, 국채, 환율, S&P500, 나스닥)
    collect_macro(start_date="2019-10-01", end_date=today)

    # 이벤트 감지 (PRICE_SPIKE, VOLUME_SPIKE)
    detect_events(ticker="NVDA")

    # 뉴스 수집 (Guardian + NYT, Gemini 요약 제외 - 별도 승인 후 summarize_pending() 실행)
    collect_news(start_date="2019-10-01", end_date=today, summarize=False)


if __name__ == "__main__":
    main()
