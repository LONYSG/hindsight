"""
거시지표 수집기

FRED API:  기준금리, 국채, S&P500, 나스닥, DXY, VIX, WTI, 금, 2년물
yfinance:  BTC (FRED에 없음)
"""
import pandas as pd
import yfinance as yf
from fredapi import Fred
from config import settings
from db.connection import get_connection


def collect(start_date: str, end_date: str) -> None:
    print(f"[거시지표] 수집 시작: {start_date} ~ {end_date}")

    fred = Fred(api_key=settings.FRED_API_KEY)
    date_index = pd.date_range(start=start_date, end=end_date, freq="B")
    df = pd.DataFrame(index=date_index)

    fred_series = {
        "fed_rate":     "FEDFUNDS",
        "us_10y_yield": "DGS10",
        "usd_krw":      "DEXKOUS",
        "sp500":        "SP500",
        "nasdaq":       "NASDAQCOM",
        "dxy":          "DTWEXBGS",   # 달러 인덱스
        "vix":          "VIXCLS",     # 공포 지수
        "wti_oil":      "DCOILWTICO", # WTI 원유
        "us_2y_yield":  "DGS2",       # 2년물 국채
    }

    for col, series_id in fred_series.items():
        try:
            data = fred.get_series(series_id, observation_start=start_date, observation_end=end_date)
            df[col] = data.reindex(date_index).ffill()
        except Exception as e:
            print(f"  [FRED {series_id}] 오류: {e}")
            df[col] = None

    # BTC, Gold: yfinance (FRED에 없음)
    for col, ticker in [("btc", "BTC-USD"), ("gold", "GC=F")]:
        try:
            raw = yf.download(ticker, start=start_date, end=end_date, progress=False, auto_adjust=True)
            if not raw.empty:
                close = raw["Close"].squeeze()
                close.index = close.index.tz_localize(None)
                df[col] = close.reindex(date_index).ffill()
            else:
                df[col] = None
        except Exception as e:
            print(f"  [{ticker}] 오류: {e}")
            df[col] = None

    df.dropna(how="all", inplace=True)

    with get_connection() as conn:
        count = _save_daily_macro(conn, df)

    print(f"[거시지표] 완료 - {count}건 저장")


def _save_daily_macro(conn, df: pd.DataFrame) -> int:
    def _f(val):
        return None if pd.isna(val) else float(val)

    rows = [
        (
            row.Index.date(),
            _f(getattr(row, "fed_rate",     None)),
            _f(getattr(row, "us_10y_yield", None)),
            _f(getattr(row, "usd_krw",      None)),
            _f(getattr(row, "sp500",        None)),
            _f(getattr(row, "nasdaq",       None)),
            _f(getattr(row, "dxy",          None)),
            _f(getattr(row, "vix",          None)),
            _f(getattr(row, "wti_oil",      None)),
            _f(getattr(row, "gold",         None)),
            _f(getattr(row, "btc",          None)),
            _f(getattr(row, "us_2y_yield",  None)),
        )
        for row in df.itertuples()
    ]
    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO daily_macro
                (date, fed_rate, us_10y_yield, usd_krw, sp500, nasdaq,
                 dxy, vix, wti_oil, gold, btc, us_2y_yield)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (date) DO UPDATE SET
                dxy          = EXCLUDED.dxy,
                vix          = EXCLUDED.vix,
                wti_oil      = EXCLUDED.wti_oil,
                gold         = EXCLUDED.gold,
                btc          = EXCLUDED.btc,
                us_2y_yield  = EXCLUDED.us_2y_yield
            """,
            rows,
        )
    return len(rows)
