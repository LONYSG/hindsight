-- daily_macro 확장: 달러/공포/원자재/크립토 지표
ALTER TABLE daily_macro
    ADD COLUMN IF NOT EXISTS dxy         NUMERIC(10, 4),   -- 달러 인덱스 (DTWEXBGS)
    ADD COLUMN IF NOT EXISTS vix         NUMERIC(8,  4),   -- 공포 지수 (VIXCLS)
    ADD COLUMN IF NOT EXISTS wti_oil     NUMERIC(10, 4),   -- WTI 원유 USD/배럴
    ADD COLUMN IF NOT EXISTS gold        NUMERIC(12, 4),   -- 금 USD/온스
    ADD COLUMN IF NOT EXISTS btc         NUMERIC(16, 2),   -- 비트코인 USD
    ADD COLUMN IF NOT EXISTS us_2y_yield NUMERIC(6,  4);   -- 미국 2년물 국채 (%)

-- 섹터 ETF (daily_price 재활용)
INSERT INTO company (ticker, name, exchange) VALUES
    ('SOXX', 'iShares Semiconductor ETF',                    'NASDAQ'),
    ('XLK',  'Technology Select Sector SPDR',                'NYSE'),
    ('XLE',  'Energy Select Sector SPDR',                    'NYSE'),
    ('XLF',  'Financial Select Sector SPDR',                 'NYSE'),
    ('XLV',  'Health Care Select Sector SPDR',               'NYSE'),
    ('XLI',  'Industrial Select Sector SPDR',                'NYSE'),
    ('XLY',  'Consumer Discretionary Select Sector SPDR',    'NYSE')
ON CONFLICT (ticker) DO NOTHING;
