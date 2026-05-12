"""
FRED API와 yfinance를 사용해 일별 거시지표를 수집하고 PostgreSQL에 저장한다.

수집 항목:
- 기준금리 (FEDFUNDS): 월별 발표 → 일별로 forward-fill
- 미국 10년 국채 수익률 (DGS10): 영업일 기준
- 달러/원 환율 (DEXKOUS): 영업일 기준
- S&P 500 종가 (^GSPC): yfinance
- 나스닥 종가 (^IXIC): yfinance
"""
import yfinance as yf
import pandas as pd
from fredapi import Fred
from config import settings
from db.connection import get_connection


def collect(start_date: str, end_date: str) -> None:
    """거시지표를 start_date ~ end_date 범위로 수집해 DB에 저장한다."""
    print(f"[거시지표] 수집 시작: {start_date} ~ {end_date}")

    fred = Fred(api_key=settings.FRED_API_KEY)

    # 날짜 범위의 모든 날짜를 인덱스로 생성 (영업일만)
    date_index = pd.date_range(start=start_date, end=end_date, freq="B")  # B = 영업일
    df = pd.DataFrame(index=date_index)

    # 기준금리: 월별 데이터를 일별로 forward-fill
    # forward-fill: 값이 없는 날은 직전 발표값을 그대로 사용
    fed_rate = fred.get_series("FEDFUNDS", observation_start=start_date, observation_end=end_date)
    df["fed_rate"] = fed_rate.reindex(date_index).ffill()

    # 미국 10년 국채 수익률 (영업일만 존재)
    us_10y = fred.get_series("DGS10", observation_start=start_date, observation_end=end_date)
    df["us_10y_yield"] = us_10y.reindex(date_index).ffill()

    # 달러/원 환율 (영업일만 존재)
    usd_krw = fred.get_series("DEXKOUS", observation_start=start_date, observation_end=end_date)
    df["usd_krw"] = usd_krw.reindex(date_index).ffill()

    # S&P 500 (yfinance)
    sp500 = yf.download("^GSPC", start=start_date, end=end_date, auto_adjust=True, progress=False)["Close"]
    if isinstance(sp500, pd.DataFrame):
        sp500 = sp500.squeeze()
    df["sp500"] = sp500.reindex(date_index).ffill()

    # 나스닥 (yfinance)
    nasdaq = yf.download("^IXIC", start=start_date, end=end_date, auto_adjust=True, progress=False)["Close"]
    if isinstance(nasdaq, pd.DataFrame):
        nasdaq = nasdaq.squeeze()
    df["nasdaq"] = nasdaq.reindex(date_index).ffill()

    # 모든 지표가 NaN인 행 제거
    df.dropna(how="all", inplace=True)

    with get_connection() as conn:
        count = _save_daily_macro(conn, df)

    print(f"[거시지표] 완료 - {count}건 저장")


def _save_daily_macro(conn, df: pd.DataFrame) -> int:
    """daily_macro 테이블에 거시지표를 저장한다."""

    def _safe_float(val):
        return None if pd.isna(val) else float(val)

    rows = [
        (
            row.Index.date(),
            _safe_float(row.fed_rate),
            _safe_float(row.us_10y_yield),
            _safe_float(row.usd_krw),
            _safe_float(row.sp500),
            _safe_float(row.nasdaq),
        )
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
