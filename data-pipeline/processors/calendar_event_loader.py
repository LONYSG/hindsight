"""
캘린더 기반 이벤트 로더 - FOMC / CPI / EARNINGS

PRICE_SPIKE / VOLUME_SPIKE는 event_detector.py가 자동 감지.
이 스크립트는 공식 일정 기반 이벤트를 market_event 테이블에 추가한다.

FOMC/CPI: company_id = NULL (거시 이벤트)
EARNINGS:  company_id = 해당 기업 ID (기업별 이벤트)

날짜 출처:
  FOMC    - https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm
  CPI     - https://www.bls.gov/schedule/news_release/cpi.htm
  EARNINGS - SEC EDGAR / 기업 IR 공시
"""

from db.connection import get_connection

# ── FOMC 금리 결정일 ──────────────────────────────────────────
# 정기 회의 + 비상 긴급 회의 포함
_FOMC_DATES = [
    # 2019
    "2019-01-30", "2019-03-20", "2019-05-01", "2019-06-19",
    "2019-07-31", "2019-09-18", "2019-10-30", "2019-12-11",
    # 2020
    "2020-01-29",
    "2020-03-03",   # 비상 긴급 금리 인하 (코로나 대응)
    "2020-03-15",   # 비상 긴급 금리 인하 (코로나 대응, 주말)
    "2020-03-18",   # 정기 FOMC
    "2020-04-29", "2020-06-10", "2020-07-29",
    "2020-09-16", "2020-11-05", "2020-12-16",
]

# ── CPI 발표일 (BLS, 미국 소비자물가지수) ────────────────────
_CPI_DATES = [
    # 2019
    "2019-01-11", "2019-02-13", "2019-03-12", "2019-04-10",
    "2019-05-10", "2019-06-12", "2019-07-11", "2019-08-13",
    "2019-09-12", "2019-10-10", "2019-11-13", "2019-12-11",
    # 2020
    "2020-01-14", "2020-02-13", "2020-03-11", "2020-04-10",
    "2020-05-12", "2020-06-10", "2020-07-14", "2020-08-12",
    "2020-09-11", "2020-10-13", "2020-11-12", "2020-12-10",
]

# ── EARNINGS (기업별 실적 발표일) ─────────────────────────────
# ticker → [(발표일, 분기 설명)]
_EARNINGS_DATES = {
    "NVDA": [
        # FY2020 (회계연도 1월 종료)
        ("2019-02-14", "Q4 FY2019"),
        ("2019-05-16", "Q1 FY2020"),
        ("2019-08-15", "Q2 FY2020"),
        ("2019-11-14", "Q3 FY2020"),
        ("2020-02-26", "Q4 FY2020"),
        # FY2021
        ("2020-05-21", "Q1 FY2021"),
        ("2020-08-19", "Q2 FY2021"),
        ("2020-11-18", "Q3 FY2021"),
    ],
}


def load(start_date: str, end_date: str):
    """
    주어진 기간의 캘린더 이벤트를 market_event 테이블에 삽입한다.
    이미 존재하는 이벤트는 건너뛴다.
    """
    from datetime import date as dt
    start = dt.fromisoformat(start_date)
    end   = dt.fromisoformat(end_date)

    events = []

    # FOMC
    for d in _FOMC_DATES:
        day = dt.fromisoformat(d)
        if start <= day <= end:
            events.append({"company_id": None, "date": day, "event_type": "FOMC", "summary": None})

    # CPI
    for d in _CPI_DATES:
        day = dt.fromisoformat(d)
        if start <= day <= end:
            events.append({"company_id": None, "date": day, "event_type": "CPI", "summary": None})

    # EARNINGS
    with get_connection() as conn:
        for ticker, dates in _EARNINGS_DATES.items():
            row = conn.execute("SELECT id FROM company WHERE ticker = %s", (ticker,)).fetchone()
            if row is None:
                print(f"  [calendar] 티커 없음: {ticker}, 건너뜀")
                continue
            company_id = row[0]
            for d, quarter in dates:
                day = dt.fromisoformat(d)
                if start <= day <= end:
                    events.append({
                        "company_id": company_id,
                        "date": day,
                        "event_type": "EARNINGS",
                        "summary": f"{ticker} {quarter} 실적 발표",
                    })

    if not events:
        print(f"[calendar] {start_date} ~ {end_date} 구간 해당 이벤트 없음")
        return

    with get_connection() as conn:
        existing = {
            (row[0], str(row[1]), row[2])
            for row in conn.execute(
                "SELECT company_id, date, event_type FROM market_event"
            ).fetchall()
        }

        count = 0
        for ev in events:
            key = (ev["company_id"], str(ev["date"]), ev["event_type"])
            if key in existing:
                continue
            conn.execute(
                """INSERT INTO market_event (company_id, date, event_type, summary)
                   VALUES (%s, %s, %s, %s)""",
                (ev["company_id"], ev["date"], ev["event_type"], ev["summary"]),
            )
            existing.add(key)
            count += 1

    print(f"[calendar] {start_date} ~ {end_date}: {count}건 삽입 완료 (FOMC/CPI/EARNINGS)")
