-- =====================================================
-- Hindsight - 초기 스키마
-- =====================================================

-- =====================================================
-- 기업 정보
-- =====================================================
CREATE TABLE company (
    id          BIGSERIAL PRIMARY KEY,
    ticker      VARCHAR(10)  NOT NULL UNIQUE,        -- 티커 (예: AAPL)
    name        VARCHAR(100) NOT NULL,               -- 기업명
    exchange    VARCHAR(20)  NOT NULL,               -- 거래소 (NASDAQ, NYSE)
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 시작점 (플레이 시작 시점 선택지)
-- 예: "코로나 직전", "금리인상 직전", "트럼프 관세 직전"
-- =====================================================
CREATE TABLE start_point (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    start_date  DATE         NOT NULL,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 일별 주가
-- =====================================================
CREATE TABLE daily_price (
    id          BIGSERIAL PRIMARY KEY,
    company_id  BIGINT         NOT NULL REFERENCES company(id),
    date        DATE           NOT NULL,
    open        NUMERIC(12, 4) NOT NULL,
    high        NUMERIC(12, 4) NOT NULL,
    low         NUMERIC(12, 4) NOT NULL,
    close       NUMERIC(12, 4) NOT NULL,
    volume      BIGINT         NOT NULL,
    UNIQUE (company_id, date)
);

CREATE INDEX idx_daily_price_company_date ON daily_price(company_id, date);

-- =====================================================
-- 일별 기술적 지표
-- RSI, MACD, 일목균형표
-- =====================================================
CREATE TABLE daily_indicator (
    id                  BIGSERIAL PRIMARY KEY,
    company_id          BIGINT         NOT NULL REFERENCES company(id),
    date                DATE           NOT NULL,
    rsi                 NUMERIC(8, 4),              -- 상대강도지수 (0~100)
    macd                NUMERIC(12, 4),             -- MACD 라인
    macd_signal         NUMERIC(12, 4),             -- 시그널 라인
    macd_histogram      NUMERIC(12, 4),             -- MACD 히스토그램
    ichimoku_tenkan     NUMERIC(12, 4),             -- 일목: 전환선 (9일)
    ichimoku_kijun      NUMERIC(12, 4),             -- 일목: 기준선 (26일)
    ichimoku_senkou_a   NUMERIC(12, 4),             -- 일목: 선행스팬 A
    ichimoku_senkou_b   NUMERIC(12, 4),             -- 일목: 선행스팬 B
    UNIQUE (company_id, date)
);

CREATE INDEX idx_daily_indicator_company_date ON daily_indicator(company_id, date);

-- =====================================================
-- 일별 거시지표
-- 금리, 국채, 환율, 벤치마크 지수
-- =====================================================
CREATE TABLE daily_macro (
    id              BIGSERIAL PRIMARY KEY,
    date            DATE           NOT NULL UNIQUE,
    fed_rate        NUMERIC(6, 4),                  -- 기준금리 (%)
    us_10y_yield    NUMERIC(6, 4),                  -- 미국 10년 국채 수익률 (%)
    usd_krw         NUMERIC(10, 4),                 -- 달러/원 환율
    sp500           NUMERIC(12, 4),                 -- S&P 500 종가
    nasdaq          NUMERIC(12, 4)                  -- 나스닥 종가
);

CREATE INDEX idx_daily_macro_date ON daily_macro(date);

-- =====================================================
-- 이벤트 & 뉴스 요약
-- 이벤트 발생일에만 뉴스 노출 (AI 사전 요약)
-- company_id = NULL 이면 거시경제 이벤트 (FOMC, CPI 등)
-- =====================================================
CREATE TABLE market_event (
    id          BIGSERIAL PRIMARY KEY,
    company_id  BIGINT       REFERENCES company(id),  -- NULL 허용
    date        DATE         NOT NULL,
    event_type  VARCHAR(20)  NOT NULL,
    -- EARNINGS: 실적 발표
    -- FOMC: 금리 결정
    -- CPI: 소비자물가 발표
    -- PRICE_SPIKE: 주가 급변 (±3% 이상)
    -- VOLUME_SPIKE: 거래량 급증 (20일 평균 200% 이상)
    -- POLITICAL: 대선 등 정치 이벤트
    summary     TEXT,                                 -- AI 요약 내용
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_market_event_company_date ON market_event(company_id, date);
CREATE INDEX idx_market_event_date ON market_event(date);

-- =====================================================
-- 회원
-- =====================================================
CREATE TABLE "user" (
    id              BIGSERIAL PRIMARY KEY,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 플레이 세션
-- 유저가 특정 시작점 + 기업을 선택해 시뮬레이션 시작
-- =====================================================
CREATE TABLE play_session (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT         NOT NULL REFERENCES "user"(id),
    start_point_id  BIGINT         NOT NULL REFERENCES start_point(id),
    company_id      BIGINT         NOT NULL REFERENCES company(id),
    seed_money      NUMERIC(15, 4) NOT NULL,          -- 시드머니
    sim_date        DATE           NOT NULL,           -- 현재 시뮬레이션 날짜
    status          VARCHAR(20)    NOT NULL DEFAULT 'IN_PROGRESS',
    -- IN_PROGRESS: 진행 중
    -- COMPLETED: 완료
    created_at      TIMESTAMP      NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP      NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_play_session_user ON play_session(user_id);

-- =====================================================
-- 매수/매도 이력
-- =====================================================
CREATE TABLE trade_history (
    id          BIGSERIAL PRIMARY KEY,
    session_id  BIGINT         NOT NULL REFERENCES play_session(id),
    date        DATE           NOT NULL,
    action      VARCHAR(10)    NOT NULL,              -- BUY, SELL
    quantity    INTEGER        NOT NULL,              -- 수량 (주)
    price       NUMERIC(12, 4) NOT NULL,              -- 체결 가격
    ratio       NUMERIC(5, 4),                        -- 시드 대비 비율 (0.0 ~ 1.0)
    created_at  TIMESTAMP      NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trade_history_session ON trade_history(session_id);

-- =====================================================
-- 포트폴리오 스냅샷
-- 날짜 점프마다 자산 현황 기록 (수익률 계산에 사용)
-- =====================================================
CREATE TABLE portfolio_snapshot (
    id          BIGSERIAL PRIMARY KEY,
    session_id  BIGINT         NOT NULL REFERENCES play_session(id),
    date        DATE           NOT NULL,
    cash        NUMERIC(15, 4) NOT NULL,              -- 현금 잔액
    stock_value NUMERIC(15, 4) NOT NULL,              -- 보유 주식 평가액
    total_value NUMERIC(15, 4) NOT NULL,              -- 총 자산 (cash + stock_value)
    UNIQUE (session_id, date)
);

CREATE INDEX idx_portfolio_snapshot_session ON portfolio_snapshot(session_id);

-- =====================================================
-- 최종 결과
-- 세션 종료 시 수익률 및 알파 기록
-- =====================================================
CREATE TABLE play_result (
    id              BIGSERIAL PRIMARY KEY,
    session_id      BIGINT         NOT NULL UNIQUE REFERENCES play_session(id),
    my_return       NUMERIC(10, 4),                   -- 유저 수익률 (%)
    stock_return    NUMERIC(10, 4),                   -- 해당 주식 수익률 (%)
    nasdaq_return   NUMERIC(10, 4),                   -- 나스닥 수익률 (%)
    sp500_return    NUMERIC(10, 4),                   -- S&P 500 수익률 (%)
    alpha           NUMERIC(10, 4),                   -- 알파 (my_return - nasdaq_return)
    created_at      TIMESTAMP      NOT NULL DEFAULT NOW()
);
