"""
Tiingo API를 사용해 일별 주가 및 기술적 지표를 수집하고 PostgreSQL에 저장한다.
Tiingo: 무료, split/배당 반영 adjusted 가격 제공, 전체 기간 제공.
"""
import requests
import pandas as pd
import pandas_ta as ta
from config import settings
from db.connection import get_connection

_TIINGO_URL = "https://api.tiingo.com/tiingo/daily/{ticker}/prices"
_LOOKBACK_DAYS = 80  # 일목균형표 52일 + 여유


def collect(ticker: str, start_date: str, end_date: str) -> None:
    """
    ticker 주가를 start_date ~ end_date 범위로 수집해 DB에 저장한다.
    이미 존재하는 날짜는 건너뛴다 (ON CONFLICT DO NOTHING).
    """
    print(f"[{ticker}] 수집 시작: {start_date} ~ {end_date}")

    fetch_start = (pd.Timestamp(start_date) - pd.Timedelta(days=_LOOKBACK_DAYS)).strftime("%Y-%m-%d")
    df = _fetch_from_tiingo(ticker, fetch_start, end_date)

    if df.empty:
        print(f"[{ticker}] 데이터 없음")
        return

    df = _calculate_indicators(df)
    df = df[df.index >= pd.Timestamp(start_date)]

    with get_connection() as conn:
        company_id = _get_company_id(conn, ticker)
        price_count = _save_daily_price(conn, company_id, df)
        indicator_count = _save_daily_indicator(conn, company_id, df)

    print(f"[{ticker}] 완료 - 주가 {price_count}건, 지표 {indicator_count}건 저장")


def _fetch_from_tiingo(ticker: str, start: str, end: str) -> pd.DataFrame:
    """
    Tiingo에서 일별 OHLCV 데이터를 가져온다.
    adjClose: split·배당 반영 수정 종가 사용.
    """
    url = _TIINGO_URL.format(ticker=ticker.lower())
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Token {settings.TIINGO_API_KEY}",
    }
    params = {"startDate": start, "endDate": end}

    resp = requests.get(url, headers=headers, params=params, timeout=120)
    resp.raise_for_status()
    data = resp.json()

    if not data:
        return pd.DataFrame()

    records = [
        {
            "date":   pd.Timestamp(item["date"][:10]),  # ISO 형식에서 날짜만 추출
            "Open":   float(item["adjOpen"]),
            "High":   float(item["adjHigh"]),
            "Low":    float(item["adjLow"]),
            "Close":  float(item["adjClose"]),           # 수정 종가
            "Volume": int(item["adjVolume"]),
        }
        for item in data
    ]

    df = pd.DataFrame(records).set_index("date").sort_index()
    return df


def _calculate_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """RSI, MACD, 일목균형표를 계산해 DataFrame에 컬럼으로 추가한다."""
    close = df["Close"].squeeze()
    high  = df["High"].squeeze()
    low   = df["Low"].squeeze()

    df["rsi"] = ta.rsi(close, length=14)

    macd_df = ta.macd(close, fast=12, slow=26, signal=9)
    if macd_df is not None:
        df["macd"]           = macd_df.iloc[:, 0]
        df["macd_histogram"] = macd_df.iloc[:, 1]
        df["macd_signal"]    = macd_df.iloc[:, 2]

    ichimoku_df, _ = ta.ichimoku(high, low, close, tenkan=9, kijun=26, senkou=52)
    if ichimoku_df is not None:
        df["ichimoku_tenkan"]   = ichimoku_df.get("ITS_9")
        df["ichimoku_kijun"]    = ichimoku_df.get("IKS_26")
        df["ichimoku_senkou_a"] = ichimoku_df.get("ISA_9")
        df["ichimoku_senkou_b"] = ichimoku_df.get("ISB_26")

    return df


def _get_company_id(conn, ticker: str) -> int:
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM company WHERE ticker = %s", (ticker,))
        row = cur.fetchone()
        if row is None:
            raise ValueError(f"company 테이블에 ticker '{ticker}' 없음.")
        return row[0]


def _save_daily_price(conn, company_id: int, df: pd.DataFrame) -> int:
    rows = [
        (company_id, row.Index.date(),
         float(row.Open), float(row.High), float(row.Low), float(row.Close), int(row.Volume))
        for row in df.itertuples()
        if pd.notna(row.Close)
    ]
    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO daily_price (company_id, date, open, high, low, close, volume)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (company_id, date) DO NOTHING
            """,
            rows,
        )
    return len(rows)


def _save_daily_indicator(conn, company_id: int, df: pd.DataFrame) -> int:
    def _f(val):
        return None if pd.isna(val) else float(val)

    rows = [
        (company_id, row.Index.date(),
         _f(getattr(row, "rsi", None)),
         _f(getattr(row, "macd", None)),
         _f(getattr(row, "macd_signal", None)),
         _f(getattr(row, "macd_histogram", None)),
         _f(getattr(row, "ichimoku_tenkan", None)),
         _f(getattr(row, "ichimoku_kijun", None)),
         _f(getattr(row, "ichimoku_senkou_a", None)),
         _f(getattr(row, "ichimoku_senkou_b", None)))
        for row in df.itertuples()
    ]
    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO daily_indicator
                (company_id, date, rsi, macd, macd_signal, macd_histogram,
                 ichimoku_tenkan, ichimoku_kijun, ichimoku_senkou_a, ichimoku_senkou_b)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (company_id, date) DO NOTHING
            """,
            rows,
        )
    return len(rows)
