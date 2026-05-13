import pandas as pd

from config import settings  # noqa: F401 (settings 로드로 .env 적용)
from db.connection import get_connection

_PRICE_SPIKE_THRESHOLD = 0.03    # 전일 대비 ±3% 이상
_VOLUME_SPIKE_MULTIPLIER = 2.0   # 20일 평균 거래량의 200% 이상
_VOLUME_MA_DAYS = 20


def detect(ticker: str):
    """
    DB에 저장된 일별 주가 데이터를 읽어 이벤트를 감지하고 market_event 테이블에 저장한다.
    - PRICE_SPIKE: 전일 대비 종가 변동 ±3% 이상
    - VOLUME_SPIKE: 거래량이 20일 이동평균의 200% 이상
    """
    with get_connection() as conn:
        company_id = _get_company_id(conn, ticker)
        df = _load_prices(conn, company_id)

    events = _find_events(df, company_id)

    with get_connection() as conn:
        count = _save_events(conn, events)

    print(f"[event_detector] {ticker}: {count}건 이벤트 저장 완료 (총 감지: {len(events)}건)")


def _get_company_id(conn, ticker: str) -> int:
    row = conn.execute(
        "SELECT id FROM company WHERE ticker = %s", (ticker,)
    ).fetchone()
    if row is None:
        raise ValueError(f"티커를 찾을 수 없음: {ticker}")
    return row[0]


def _load_prices(conn, company_id: int) -> pd.DataFrame:
    rows = conn.execute(
        "SELECT date, close, volume FROM daily_price WHERE company_id = %s ORDER BY date",
        (company_id,),
    ).fetchall()

    df = pd.DataFrame(rows, columns=["date", "close", "volume"])
    df["date"] = pd.to_datetime(df["date"])
    df = df.set_index("date")
    df["close"] = df["close"].astype(float)
    df["volume"] = df["volume"].astype(float)
    return df


def _find_events(df: pd.DataFrame, company_id: int) -> list[dict]:
    # 전일 대비 종가 변동률 (첫 번째 행은 NaN → 비교 불가이므로 자동 제외됨)
    df["price_change"] = df["close"].pct_change()

    # 20일 거래량 이동평균 (처음 19일은 NaN → volume_spikes 계산에서 자동 제외됨)
    df["volume_ma20"] = df["volume"].rolling(_VOLUME_MA_DAYS).mean()

    events = []

    # PRICE_SPIKE: 절댓값 기준 ±3% 이상
    price_spike_mask = df["price_change"].abs() >= _PRICE_SPIKE_THRESHOLD
    for date in df[price_spike_mask].index:
        events.append({
            "company_id": company_id,
            "date": date.date(),
            "event_type": "PRICE_SPIKE",
        })

    # VOLUME_SPIKE: 20일 평균 대비 200% 이상
    volume_spike_mask = df["volume"] >= df["volume_ma20"] * _VOLUME_SPIKE_MULTIPLIER
    for date in df[volume_spike_mask].index:
        events.append({
            "company_id": company_id,
            "date": date.date(),
            "event_type": "VOLUME_SPIKE",
        })

    return events


def _save_events(conn, events: list[dict]) -> int:
    if not events:
        return 0

    # 이미 저장된 이벤트 목록을 미리 불러와 set으로 관리 (중복 INSERT 방지)
    existing_rows = conn.execute(
        "SELECT company_id, date, event_type FROM market_event WHERE company_id IS NOT NULL"
    ).fetchall()
    existing = {(row[0], row[1], row[2]) for row in existing_rows}

    count = 0
    for ev in events:
        key = (ev["company_id"], ev["date"], ev["event_type"])
        if key in existing:
            continue
        conn.execute(
            "INSERT INTO market_event (company_id, date, event_type) VALUES (%s, %s, %s)",
            (ev["company_id"], ev["date"], ev["event_type"]),
        )
        existing.add(key)  # 같은 실행 내에서도 중복 방지
        count += 1

    return count
