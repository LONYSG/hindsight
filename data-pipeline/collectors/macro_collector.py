"""
FRED API를 사용해 일별 거시지표를 수집하고 PostgreSQL에 저장한다.
모든 거시지표를 FRED 단일 소스로 통일한다.

수집 항목:
- 기준금리     (FEDFUNDS):  월별 발표 → 일별 forward-fill
- 10년 국채    (DGS10):     영업일 기준
- 달러/원 환율 (DEXKOUS):   영업일 기준
- S&P 500      (SP500):     일별
- 나스닥       (NASDAQCOM): 일별
"""
import pandas as pd
from fredapi import Fred
from config import settings
from db.connection import get_connection


def collect(start_date: str, end_date: str) -> None:
    """거시지표를 start_date ~ end_date 범위로 수집해 DB에 저장한다."""
    print(f"[거시지표] 수집 시작: {start_date} ~ {end_date}")

    fred = Fred(api_key=settings.FRED_API_KEY)
    date_index = pd.date_range(start=start_date, end=end_date, freq="B")  # 영업일
    df = pd.DataFrame(index=date_index)

    fred_series = {
        "fed_rate":    "FEDFUNDS",
        "us_10y_yield": "DGS10",
        "usd_krw":     "DEXKOUS",
        "sp500":       "SP500",
        "nasdaq":      "NASDAQCOM",
    }

    for col, series_id in fred_series.items():
        data = fred.get_series(series_id, observation_start=start_date, observation_end=end_date)
        df[col] = data.reindex(date_index).ffill()

    df.dropna(how="all", inplace=True)

    with get_connection() as conn:
        count = _save_daily_macro(conn, df)

    print(f"[거시지표] 완료 - {count}건 저장")


def _save_daily_macro(conn, df: pd.DataFrame) -> int:
    def _f(val):
        return None if pd.isna(val) else float(val)

    rows = [
        (row.Index.date(), _f(row.fed_rate), _f(row.us_10y_yield),
         _f(row.usd_krw), _f(row.sp500), _f(row.nasdaq))
        for row in df.itertuples()
    ]
    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO daily_macro (date, fed_rate, us_10y_yield, usd_krw, sp500, nasdaq)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (date) DO NOTHING
            """,
            rows,
        )
    return len(rows)
