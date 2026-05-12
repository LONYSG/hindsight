"""
yfinance를 사용해 일별 주가 및 기술적 지표를 수집하고 PostgreSQL에 저장한다.
"""
import time
import yfinance as yf
import pandas as pd
import pandas_ta as ta
from db.connection import get_connection

# 기술적 지표 계산에 필요한 최소 이전 데이터 (일목균형표 52일 + 여유)
_LOOKBACK_DAYS = 80


def collect(ticker: str, start_date: str, end_date: str) -> None:
    """
    ticker 주가를 start_date ~ end_date 범위로 수집해 DB에 저장한다.
    이미 존재하는 날짜는 건너뛴다 (ON CONFLICT DO NOTHING).
    """
    print(f"[{ticker}] 수집 시작: {start_date} ~ {end_date}")

    # 지표 계산을 위해 실제 시작일보다 앞당겨서 다운로드
    fetch_start = (pd.Timestamp(start_date) - pd.Timedelta(days=_LOOKBACK_DAYS)).strftime("%Y-%m-%d")
    df = _download_with_retry(ticker, fetch_start, end_date)

    if df.empty:
        print(f"[{ticker}] 데이터 없음")
        return

    # yfinance 버전에 따라 MultiIndex 컬럼이 올 수 있으므로 평탄화
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

    df = _calculate_indicators(df)

    # lookback 구간 제거 → 실제 저장 대상 날짜만 남김
    df = df[df.index >= pd.Timestamp(start_date)]

    if df.empty:
        print(f"[{ticker}] 저장할 데이터 없음")
        return

    with get_connection() as conn:
        company_id = _get_company_id(conn, ticker)
        price_count = _save_daily_price(conn, company_id, df)
        indicator_count = _save_daily_indicator(conn, company_id, df)

    print(f"[{ticker}] 완료 - 주가 {price_count}건, 지표 {indicator_count}건 저장")


def _download_with_retry(ticker: str, start: str, end: str, retries: int = 3) -> pd.DataFrame:
    """
    rate limit 에러 시 지수 백오프(30s → 60s → 120s)로 재시도한다.
    yf.download()는 rate limit을 예외 없이 빈 DataFrame으로 반환하므로
    yf.Ticker().history()를 사용해 예외를 직접 받는다.
    """
    wait = 30
    for attempt in range(1, retries + 1):
        try:
            df = yf.Ticker(ticker).history(start=start, end=end, auto_adjust=True)
            if isinstance(df.columns, pd.MultiIndex):
                df.columns = df.columns.get_level_values(0)
            if not df.empty:
                return df
            if attempt < retries:
                print(f"[{ticker}] 빈 응답 ({attempt}/{retries}), {wait}초 후 재시도...")
                time.sleep(wait)
                wait *= 2
        except Exception as e:
            if attempt == retries:
                raise
            print(f"[{ticker}] 다운로드 실패 ({attempt}/{retries}), {wait}초 후 재시도... ({e})")
            time.sleep(wait)
            wait *= 2
    return pd.DataFrame()


def _calculate_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """RSI, MACD, 일목균형표를 계산해 DataFrame에 컬럼으로 추가한다."""
    close = df["Close"].squeeze()
    high = df["High"].squeeze()
    low = df["Low"].squeeze()

    # RSI (14일)
    df["rsi"] = ta.rsi(close, length=14)

    # MACD (단기 12일, 장기 26일, 시그널 9일)
    macd_df = ta.macd(close, fast=12, slow=26, signal=9)
    if macd_df is not None:
        df["macd"]           = macd_df.iloc[:, 0]  # MACD 라인
        df["macd_histogram"] = macd_df.iloc[:, 1]  # 히스토그램
        df["macd_signal"]    = macd_df.iloc[:, 2]  # 시그널 라인

    # 일목균형표 (전환선 9일, 기준선 26일, 선행스팬B 52일)
    ichimoku_df, _ = ta.ichimoku(high, low, close, tenkan=9, kijun=26, senkou=52)
    if ichimoku_df is not None:
        df["ichimoku_tenkan"]   = ichimoku_df.get(f"ITS_9")
        df["ichimoku_kijun"]    = ichimoku_df.get(f"IKS_26")
        df["ichimoku_senkou_a"] = ichimoku_df.get(f"ISA_9")
        df["ichimoku_senkou_b"] = ichimoku_df.get(f"ISB_26")

    return df


def _get_company_id(conn, ticker: str) -> int:
    """티커로 company 테이블의 id를 조회한다."""
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM company WHERE ticker = %s", (ticker,))
        row = cur.fetchone()
        if row is None:
            raise ValueError(f"company 테이블에 ticker '{ticker}' 없음. V2 seed 데이터를 확인하세요.")
        return row[0]


def _save_daily_price(conn, company_id: int, df: pd.DataFrame) -> int:
    """
    daily_price 테이블에 OHLCV 데이터를 저장한다.
    ON CONFLICT DO NOTHING: 같은 (company_id, date)가 이미 있으면 건너뜀.
    """
    rows = [
        (
            company_id,
            row.Index.date(),
            float(row.Open),
            float(row.High),
            float(row.Low),
            float(row.Close),
            int(row.Volume),
        )
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
    """
    daily_indicator 테이블에 기술적 지표를 저장한다.
    ON CONFLICT DO NOTHING: 같은 (company_id, date)가 이미 있으면 건너뜀.
    """
    indicator_cols = [
        "rsi", "macd", "macd_signal", "macd_histogram",
        "ichimoku_tenkan", "ichimoku_kijun", "ichimoku_senkou_a", "ichimoku_senkou_b"
    ]
    # 지표 컬럼이 하나도 없는 행은 저장하지 않음
    indicator_df = df[[col for col in indicator_cols if col in df.columns]].copy()

    def _safe_float(val):
        return None if pd.isna(val) else float(val)

    rows = [
        (
            company_id,
            row.Index.date(),
            _safe_float(getattr(row, "rsi", None)),
            _safe_float(getattr(row, "macd", None)),
            _safe_float(getattr(row, "macd_signal", None)),
            _safe_float(getattr(row, "macd_histogram", None)),
            _safe_float(getattr(row, "ichimoku_tenkan", None)),
            _safe_float(getattr(row, "ichimoku_kijun", None)),
            _safe_float(getattr(row, "ichimoku_senkou_a", None)),
            _safe_float(getattr(row, "ichimoku_senkou_b", None)),
        )
        for row in indicator_df.itertuples()
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
