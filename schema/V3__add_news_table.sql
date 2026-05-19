CREATE TABLE news (
    id          BIGSERIAL PRIMARY KEY,
    es_id       VARCHAR(255) UNIQUE,
    title       TEXT,
    title_ko    TEXT,
    brief       TEXT,
    summary     TEXT,
    body        TEXT,
    category    VARCHAR(50),
    source_type VARCHAR(50),
    tickers     TEXT[],
    source      VARCHAR(255),
    url         TEXT,
    date        DATE,
    published_at TIMESTAMPTZ NOT NULL,
    importance  INTEGER,
    themes      TEXT[]
);

CREATE INDEX idx_news_published_at ON news(published_at);
CREATE INDEX idx_news_importance   ON news(importance);
CREATE UNIQUE INDEX idx_news_url ON news(url) WHERE url IS NOT NULL AND url != '';
