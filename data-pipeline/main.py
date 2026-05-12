"""
데이터 파이프라인 진입점.
수집기(collector)들을 순서대로 실행한다.
"""
from collectors.price_collector import collect as collect_price


def main():
    print("Hindsight 데이터 파이프라인 시작")

    # NVDA 주가 수집: 코로나 직전 시작점(2020-02-01) 이전 데이터부터 오늘까지
    from datetime import date
    collect_price(ticker="NVDA", start_date="2019-10-01", end_date=date.today().strftime("%Y-%m-%d"))

    # TODO: macro_collector 실행
    # TODO: news_collector 실행
    # TODO: event_detector 실행


if __name__ == "__main__":
    main()
