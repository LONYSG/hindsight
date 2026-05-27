-- =====================================================
-- Hindsight — Supabase 통합 스키마
-- 로컬 DB 현재 상태 기준 (2026-05-19)
-- =====================================================

CREATE TABLE company (
    id         BIGSERIAL PRIMARY KEY,
    ticker     VARCHAR(10)  NOT NULL UNIQUE,
    name       VARCHAR(100) NOT NULL,
    exchange   VARCHAR(20)  NOT NULL,
    created_at TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE start_point (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    start_date  DATE         NOT NULL,
    available   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE daily_price (
    id         BIGSERIAL PRIMARY KEY,
    company_id BIGINT         NOT NULL REFERENCES company(id),
    date       DATE           NOT NULL,
    open       NUMERIC(12,4)  NOT NULL,
    high       NUMERIC(12,4)  NOT NULL,
    low        NUMERIC(12,4)  NOT NULL,
    close      NUMERIC(12,4)  NOT NULL,
    volume     BIGINT         NOT NULL,
    UNIQUE (company_id, date)
);

CREATE INDEX idx_daily_price_company_date ON daily_price(company_id, date);

CREATE TABLE daily_indicator (
    id                BIGSERIAL PRIMARY KEY,
    company_id        BIGINT        NOT NULL REFERENCES company(id),
    date              DATE          NOT NULL,
    rsi               NUMERIC(8,4),
    macd              NUMERIC(12,4),
    macd_signal       NUMERIC(12,4),
    macd_histogram    NUMERIC(12,4),
    ichimoku_tenkan   NUMERIC(12,4),
    ichimoku_kijun    NUMERIC(12,4),
    ichimoku_senkou_a NUMERIC(12,4),
    ichimoku_senkou_b NUMERIC(12,4),
    UNIQUE (company_id, date)
);

CREATE INDEX idx_daily_indicator_company_date ON daily_indicator(company_id, date);

CREATE TABLE daily_macro (
    id           BIGSERIAL PRIMARY KEY,
    date         DATE          NOT NULL UNIQUE,
    fed_rate     NUMERIC(6,4),
    us_10y_yield NUMERIC(6,4),
    usd_krw      NUMERIC(10,4),
    sp500        NUMERIC(12,4),
    nasdaq       NUMERIC(12,4)
);

CREATE INDEX idx_daily_macro_date ON daily_macro(date);

CREATE TABLE market_event (
    id         BIGSERIAL PRIMARY KEY,
    company_id BIGINT      REFERENCES company(id),
    date       DATE        NOT NULL,
    event_type VARCHAR(20) NOT NULL,
    summary    TEXT,
    created_at TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_market_event_date         ON market_event(date);
CREATE INDEX idx_market_event_company_date ON market_event(company_id, date);

CREATE TABLE "user" (
    id            BIGSERIAL PRIMARY KEY,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255),
    kakao_id      BIGINT       UNIQUE,
    nickname      VARCHAR(100),
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE play_session (
    id             BIGSERIAL PRIMARY KEY,
    user_id        BIGINT         NOT NULL REFERENCES "user"(id),
    start_point_id BIGINT         NOT NULL REFERENCES start_point(id),
    seed_money     NUMERIC(15,4)  NOT NULL,
    sim_date       DATE           NOT NULL,
    status         VARCHAR(20)    NOT NULL DEFAULT 'IN_PROGRESS',
    alias          VARCHAR(100),
    created_at     TIMESTAMP      NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMP      NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_play_session_user ON play_session(user_id);

CREATE TABLE trade_history (
    id         BIGSERIAL PRIMARY KEY,
    session_id BIGINT        NOT NULL REFERENCES play_session(id),
    company_id BIGINT        REFERENCES company(id),
    date       DATE          NOT NULL,
    action     VARCHAR(10)   NOT NULL,
    quantity   INTEGER       NOT NULL,
    price      NUMERIC(12,4) NOT NULL,
    ratio      NUMERIC(5,4),
    created_at TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trade_history_session ON trade_history(session_id);

CREATE TABLE portfolio_snapshot (
    id          BIGSERIAL PRIMARY KEY,
    session_id  BIGINT        NOT NULL REFERENCES play_session(id),
    date        DATE          NOT NULL,
    cash        NUMERIC(15,4) NOT NULL,
    stock_value NUMERIC(15,4) NOT NULL,
    total_value NUMERIC(15,4) NOT NULL,
    UNIQUE (session_id, date)
);

CREATE INDEX idx_portfolio_snapshot_session ON portfolio_snapshot(session_id);

CREATE TABLE play_result (
    id            BIGSERIAL PRIMARY KEY,
    session_id    BIGINT        NOT NULL UNIQUE REFERENCES play_session(id),
    my_return     NUMERIC(10,4),
    stock_return  NUMERIC(10,4),
    nasdaq_return NUMERIC(10,4),
    sp500_return  NUMERIC(10,4),
    alpha         NUMERIC(10,4),
    mdd           NUMERIC(20,6),
    cash_ratio_avg NUMERIC(20,6),
    trade_count   INTEGER,
    created_at    TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE TABLE news_view (
    id         BIGSERIAL PRIMARY KEY,
    session_id BIGINT       NOT NULL REFERENCES play_session(id),
    news_es_id VARCHAR(255) NOT NULL,
    viewed_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_news_view_session ON news_view(session_id);

CREATE TABLE news (
    id           BIGSERIAL PRIMARY KEY,
    es_id        VARCHAR(255) UNIQUE,
    title        TEXT,
    title_ko     TEXT,
    brief        TEXT,
    summary      TEXT,
    body         TEXT,
    category     VARCHAR(50),
    source_type  VARCHAR(50),
    tickers      TEXT[],
    source       VARCHAR(255),
    url          TEXT,
    date         DATE,
    published_at TIMESTAMPTZ  NOT NULL,
    importance   INTEGER,
    themes       TEXT[],
    llm_raw      TEXT
);

CREATE INDEX idx_news_published_at ON news(published_at);
CREATE INDEX idx_news_importance   ON news(importance);
CREATE UNIQUE INDEX idx_news_url   ON news(url) WHERE url IS NOT NULL AND url != '';

-- =====================================================
-- 기초 데이터
-- =====================================================

INSERT INTO company (ticker, name, exchange) VALUES
    ('NVDA',  'NVIDIA Corporation', 'NASDAQ'),
    ('AAPL',  'Apple Inc.',         'NASDAQ'),
    ('MSFT',  'Microsoft Corp.',    'NASDAQ'),
    ('GOOGL', 'Alphabet Inc.',      'NASDAQ'),
    ('AMZN',  'Amazon.com Inc.',    'NASDAQ'),
    ('META',  'Meta Platforms Inc.','NASDAQ'),
    ('TSLA',  'Tesla Inc.',         'NASDAQ');

INSERT INTO start_point (name, description, start_date, available) VALUES
    ('EP 1. 코로나 유동성 파티',
     '미국 증시가 11년 연속 강세장을 이어가며 사상 최고치를 갱신하던 시기. 중국발 신종 바이러스 소식이 조금씩 들려오고 있었지만, 시장은 크게 개의치 않는 분위기였다.',
     '2020-02-03', TRUE),
    ('EP 2. 연준의 역습',
     '2021년 말, 나스닥이 사상 최고치를 기록하며 낙관론이 팽배하던 시기. 연준은 인플레이션이 일시적이라 했고, 금리는 여전히 제로 수준이었다.',
     '2021-11-01', FALSE),  -- 데이터 미준비, 시작 차단
    ('EP 3. AI 혁명과 M7 독주',
     '2022년 한 해의 급락 이후 기술주가 바닥에서 방향을 모색하던 시기. IT 업계 전반에 구조조정이 이어졌고, AI 관련 소식들이 막 들려오기 시작했다.',
     '2023-01-03', FALSE);  -- 데이터 미준비, 시작 차단
