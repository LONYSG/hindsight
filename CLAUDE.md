# Hindsight — Claude Code 컨텍스트 (CLAUDE.md)

> 새 세션이라면 이 파일과 `docs/dev-log.md` 를 먼저 읽으세요.
> 이 파일은 **현재 상태와 작업 원칙**, dev-log 는 **여기에 도달한 의사결정 히스토리**.

---

## 1. 프로젝트 본질

실제 역사적 시점으로 돌아가서 그때의 정보(뉴스/주가/지표)만으로 매수·매도 판단을 내리고,
**시장 대비 알파(α)** 와 **최대 낙폭(MDD)** 으로 자신의 투자 성향을 체험하는 시뮬레이터.

> "나스닥이 우상향인 걸 알면서도, 당신은 시장을 이길 수 있는가?"

핵심은 결과가 아니라 **과정과 행동 패턴**.
"수익률 맞추기 게임"이 아니라 **"당시 불확실성 속에서 내가 어떤 투자자였는가"** 를 체험시키는 시뮬레이션.

---

## 2. 플레이 흐름

```
1. 회원가입 / 로그인 (이메일 or Kakao OAuth)
2. 시작점 선택 (EP1: 코로나 직전 2020-02-03 등)
3. 기업 선택 (M7 중 하나, ETF는 거래 불가 지표용)
4. 시드머니 지급 후 플레이
   ├── 캔들 차트 / 거시 지표 띠 / 기술 지표
   ├── 뉴스 (글로벌/기업, importance 필터)
   ├── 매수 / 매도
   └── 날짜 점프 (다음날 / 1주 / 1달 / 3달)
5. 종료 → 결과 리포트
   └── 수익률 / MDD / 알파 / 거래 횟수 / 투자 성향 뱃지
```

---

## 3. 현재 사용 중인 기술 스택 (실측)

| 영역 | 사용 기술 | 비고 |
|------|----------|------|
| Backend | **Spring Boot 3.5** + Spring Security (JWT) + JPA + Lombok | Java 17 |
| Frontend | **React + Vite**, lightweight-charts v5, axios | |
| Database | **PostgreSQL (Supabase Session Pooler)** | **단일 DB** |
| Data Pipeline | **Python 3.12 + psycopg3** | psycopg2 아님 |
| Auth | JWT 자체 발급 + Kakao OAuth | |
| 외부 API | Tiingo / FRED / yfinance / Guardian / Alpha Vantage / Google Gemini | |
| 자동화 | GitHub Actions | |
| 알림 | **ntfy** (`hindsight_lonysg` 채널) | |
| 백엔드 배포 | Render (현재, 임시) → Oracle Cloud Always Free ARM (대기 중) | |

### 의도적으로 도입하지 않은 것
이전 문서/주석에 등장하지만 **실제로 쓰지 않음** — 추후 도입 여부 미정.

- ❌ **Elasticsearch** — 뉴스도 PostgreSQL `news` 테이블에 저장
- ❌ **Kafka** — 배치 호출만 있는 현재 규모에서 불필요
- ❌ **Kubernetes / Helm / ArgoCD** — OCI ARM 단일 VM에 Docker 로 배치 예정
- ❌ **Redis** — 캐시가 필요한 핫 패스 없음
- ❌ **Spring Batch** — Python + GitHub Actions 가 모든 배치 담당
- ❌ **Prometheus / Grafana / Logstash** — 모니터링은 ntfy + GitHub Actions UI 로 충분

→ **추가 도입 결정은 반드시 오너 승인 후.** dev-log 의 의사결정 흔적이 사라지지 않도록 한다.

---

## 4. 외부 API 별 한도와 역할

| API | 무료 한도 | 역할 | 비고 |
|-----|----------|------|------|
| **Tiingo** | 제한적 | 주가 (adjusted, 전체 기간) | 다른 무료 소스가 모두 유료화되어 마지막 선택지 |
| **FRED** | 거의 무제한 | 거시지표 (기준금리, 국채, DXY, VIX, WTI, US2Y) | |
| **yfinance** | 무제한(스크래핑) | 금(GC=F), BTC | FRED 미제공 시리즈 |
| **The Guardian** | 500 req/day | 글로벌 거시 뉴스 본문 (BUSINESS / TECH / WORLD 섹션) | UK 매체라 M7 기업 뉴스 밀도 낮음 |
| **Alpha Vantage** | **25 req/day** | ticker 기반 기업 뉴스 (NEWS_SENTIMENT API) | 한도 매우 빠듯 |
| **Google Gemini** | **1,500 req/day**, 15 RPM | 헤드라인 selection + title_ko / brief / summary / themes 생성 | 무료 모델: `gemini-3.1-flash-lite` |

### Gemini 사용 패턴 — **이번 세션의 핵심 교훈**
1달치 수집·요약을 **한 워크플로우에서 같은 날에** 처리한다. 분리하면 두 워크플로우가 같은 API 키의 일일 한도를 다투다 깨진다.

- 1달치 Guardian selection: ~30 호출
- 1달치 요약 (Guardian + Alpha Vantage): ~350~660 호출 (코로나 시기 최대)
- 합계 ~380~700 호출 → **1,500 한도의 25~45% 만 사용**

429(quota) 발생 시 **fallback 저장은 절대 하지 않는다** — `news_collector._select_with_gemini` 가 `[]` 를 반환하여 해당 날짜를 스킵, `already_collected()` 가 다음 실행에서 재시도하지 않으므로 **잘못된 데이터가 영구적으로 박힐 수 있다**.

---

## 5. DB 스키마 개요 (실제)

```
[유저]
user (id, email, password_hash, nickname, kakao_id, created_at)

[시작점]
start_point (id, name, description, start_date, available)
   - available=false 면 프론트/백 둘 다 시작을 막는다

[기업]
company (id, ticker, name, exchange)
   - M7 + 섹터 ETF 7개 (SOXX/XLK/XLE/XLF/XLV/XLI/XLY)
   - ETF 는 /api/data/companies 에서 제외 → 거래 불가, 지표로만 노출

[일별 시장 데이터]
daily_price     (id, company_id, date, open, high, low, close, volume)
daily_indicator (id, company_id, date, rsi, macd, macd_signal, ichimoku_data)
daily_macro     (id, date, fed_rate, us_10y_yield, usd_krw, sp500, nasdaq,
                 dxy, vix, wti_oil, gold, btc, us_2y_yield)   ← V4 확장 컬럼

[이벤트]
market_event (id, company_id, date, event_type, summary)
   event_type: EARNINGS / FOMC / CPI / PRICE_SPIKE / VOLUME_SPIKE / POLITICAL
   company_id NULL = 거시 이벤트 (FOMC/CPI)

[뉴스] ← V3 (Elasticsearch 폐기 후 통합)
news (id, es_id, title, title_ko, brief, summary, body,
      category, source_type, tickers[], source, url,
      date, published_at, importance, themes[])
   - source_type=NULL → Guardian (글로벌)
   - source_type='company' → Alpha Vantage (기업) + tickers=['NVDA' 등]
   - es_id 컬럼은 Elasticsearch 시절의 잔재로 nullable, 신규 데이터는 NULL

[플레이]
play_session       (id, user_id, start_point_id, company_id, seed_money, current_date, status)
trade_history      (id, session_id, date, action, quantity, price, ratio)
portfolio_snapshot (id, session_id, date, cash, stock_value, total_value)
   UNIQUE (session_id, date)
play_result        (id, session_id, my_return, stock_return, nasdaq_return,
                    sp500_return, alpha, mdd, trade_count, cash_ratio_avg)

[뉴스 열람] — 추후 투자 성향 분석용
news_view (id, session_id, news_id, viewed_at)
```

마이그레이션은 `schema/V1..V4*.sql` (Flyway 명명규칙). Supabase 에는 수동 적용 (또는 워크플로우 내 스텝).

---

## 6. 뉴스 시스템 — 2계층

```
[레이어 1 — 글로벌 거시 (Guardian)]
business|money / technology / world|us-news|politics
  → Gemini selection (relevance 1~5, ≥2 만 저장)
  → news 테이블 (source_type=NULL)

[레이어 2 — 기업 전용 (Alpha Vantage)]
NEWS_SENTIMENT API, ticker 필터
  → 선별 없이 전량 저장 (이미 ticker 기반)
  → news 테이블 (source_type='company', tickers=['NVDA'])

[요약 단계 — re_summarize_all]
brief IS NULL 인 건만 처리
  → Gemini 로 title_ko + brief + summary + themes 한번에 JSON 생성
  → date_from / date_to 파라미터로 월 단위 처리 가능
```

### relevance 기준 (importance 컬럼명 유지)
```
5 = 대부분의 투자자가 반드시 참고
4 = 특정 산업·기업 투자자에게 매우 중요
3 = 투자 판단에 충분히 참고 가치
2 = 제한적이지만 일부 투자자에게 의미
1 = 참고 가치 낮음, 그러나 무관하지는 않음
```
기준: **"시장 충격도"가 아니라 "당시 투자자가 참고할 이유가 있는가"** (hindsight bias 방어).

UI 기본 필터: importance ≥ 3. 4단계 선택: 전체 / ★★★ 이상 / ★★★★ 이상 / ★★★★★ 만.

### themes 태그 (28개 flat)
```
AI · SEMICONDUCTOR · CLOUD · SOFTWARE · ROBOTICS
EV · ENERGY · NUCLEAR · BIOTECH · HEALTHCARE
FINANCE · CRYPTO · DEFENSE · AEROSPACE
GEOPOLITICS · CHINA · TRADE
MACRO · FED · RATE · INFLATION · SUPPLY_CHAIN
CONSUMER · RETAIL · MANUFACTURING · CYBERSECURITY · DATA_CENTER
OTHER
```
- flat 구조 / 기사당 최대 3개 / 애매하면 OTHER

### look-ahead bias 방어
`date` 필드가 아니라 `published_at` UTC 범위로 쿼리.
노출 범위: `(전 거래일 장마감, 당일 장마감]` — EDT/EST DST 자동 분기.
주말/공휴일 뉴스는 다음 거래일로 자동 이월.

---

## 7. 자동화 워크플로우 (.github/workflows/)

| 파일 | 트리거 | 핵심 |
|------|--------|------|
| `collect_news.yml` | **매일 09:05 KST** + 수동 | **1달치** Guardian + Alpha Vantage 수집 → 해당 월 Gemini 요약 → `collection_state.json` next_month++ 자동 커밋 → **ntfy 알림** (성공/실패) |
| `collect_macro.yml` | 수동 | FRED + yfinance 거시지표 수집 (DXY/VIX/WTI/Gold/BTC/US2Y 포함) |
| `collect_etf.yml` | 수동 | 섹터 ETF 가격 수집 |
| `collect_calendar.yml` | 수동 | FOMC / CPI / EARNINGS 캘린더 적재 |
| `oracle_retry.yml` | 6시간 주기 | OCI Always Free ARM 인스턴스 생성 재시도 (춘천 리전) |

### collection_state.json
```json
{ "next_month": "2020-02", "end_month": "2024-12" }
```
워크플로우가 끝날 때 `next_month` 를 한 달 앞으로 밀고 `[skip ci]` 커밋. `next_month > end_month` 가 되면 스킵.

### ntfy 알림 형식
- **성공**: `✅ {month} 수집+요약 완료` + Click → GitHub Actions 로그 URL
- **실패**: `❌ {month} 수집 실패` + 어느 스텝에서 죽었는지(Guardian / Alpha Vantage / Gemini / 상태 업데이트) + 예상 원인 + Click → 로그 URL

채널: `https://ntfy.sh/hindsight_lonysg` (앱에서 구독)

---

## 8. 디렉토리 구조

```
hindsight/
├── backend/                     Spring Boot
│   ├── src/main/java/com/hindsight/
│   │   ├── auth/                User, JWT, Kakao OAuth
│   │   ├── play/                세션, 매매, 점프, 결과
│   │   ├── data/                주가/뉴스/거시 조회 API
│   │   │   └── service/
│   │   │       ├── NewsSearchService.java       (interface)
│   │   │       └── PostgresNewsService.java     (@Profile("postgres"))
│   │   └── news/                news_view (열람 기록)
│   └── src/main/resources/application.yml
├── frontend/                    React + Vite
│   └── src/
│       ├── pages/   Login / Setup / Play / Result / Home / Nickname / KakaoCallback
│       ├── tabs/    Price / Order / Portfolio / News
│       ├── components/  AppHeader / MacroTicker / MacroSheet / OrderBottomSheet / FullScreenLoader
│       └── api/     client (axios) + auth helpers
├── data-pipeline/               Python 3.12
│   ├── collectors/
│   │   ├── price_collector.py        Tiingo
│   │   ├── macro_collector.py        FRED + yfinance
│   │   ├── news_collector.py         Guardian + Gemini selection
│   │   ├── company_news_collector.py Alpha Vantage
│   │   ├── calendar_collector.py     FOMC / CPI / EARNINGS
│   │   └── (없음) ES 관련 — 모두 제거됨
│   ├── processors/  event_detector / calendar_event_loader
│   ├── db/
│   │   ├── connection.py   psycopg3, Supabase pooler 호환 (prepare_threshold=None)
│   │   └── pg_news.py      news 테이블 CRUD
│   ├── config/settings.py
│   └── collection_state.json
├── schema/                      Flyway 마이그레이션 V1~V4
├── docs/dev-log.md              개발 일지
├── CLAUDE.md                    이 파일
├── README.md
├── docker-compose.yml           (현재 empty placeholder)
└── .github/workflows/           자동화 5개
```

---

## 9. 시작점(에피소드) 상태

| EP | 시작일 | 시나리오 | 데이터 상태 |
|----|--------|---------|------------|
| EP1 | 2020-02-03 | 코로나 직전 → 급락+반등 | 부분 수집 (재수집 진행 예정) |
| EP2 | 2021-11-?? | 금리 인상 직전 | **데이터 미준비** → 시작 차단 (`available=false`) |
| EP3 | 2022 말 | 저점 부근 | **데이터 미준비** → 시작 차단 |

EP2/EP3 차단은 **프론트(버튼 비활성) + 백엔드(`PlayService.startSession` 에서 IllegalArgumentException)** 두 군데에서 동시에 수행. 향후 결제 게이팅의 토대.

---

## 10. 이번 세션(2026-05-26)의 핵심 결정

이 부분은 다음 세션에서 컨텍스트 끊김을 막기 위한 요약입니다. 자세한 경위는 `docs/dev-log.md` 의 2026-05-26 섹션 참고.

1. **Gemini 한도 충돌 발견** — 기존 `summarize_news.yml` (KST 01:05) 와 `collect_news.yml` (KST 09:05) 가 같은 Gemini 키의 1,500 req/day 를 다투다 둘 다 실패.
2. **Guardian selection fallback 의 치명적 결함 발견** — 429 발생 시 `articles[:3]` 을 importance=2 로 저장하던 fallback 로직이 **이미 1,000+ 건의 쓰레기 데이터를 영구화**시킨 상태. 발견 후 즉시 `[]` 반환으로 수정.
3. **워크플로우 통합** — `summarize_news.yml` 을 삭제하고 `collect_news.yml` 이 **1달치 수집 → 그 달 요약 → 상태 커밋 → ntfy 알림** 까지 일체 처리하도록 재설계.
4. **`pg_news.get_pending_summary`, `re_summarize_all` 에 `date_from/date_to` 파라미터 추가** — 월 단위 요약을 위해 필수.
5. **news 테이블 전체 truncate + collection_state 초기화** — 더러운 데이터 5,820건을 폐기하고 `next_month=2020-02, end_month=2024-12` (총 59개월) 로 재수집 시작.
6. **ntfy 알림** — `hindsight_lonysg` 채널로 성공/실패 알림. 실패 시 어느 스텝이 죽었는지 + GitHub Actions URL 까지 포함.
7. **레거시 정리** — `ElasticsearchNewsService.java`, `migrate_es_to_pg.py`, `k8s/` 디렉토리, `settings.py` 의 ES/Kafka/NYT/Finnhub/GCP 변수, README/CLAUDE 의 오래된 기술 스택 언급을 모두 제거.

---

## 11. 진행 상황 (2026-05-26 기준)

### 완료
- 데이터 파이프라인 (Tiingo / FRED / Guardian / Alpha Vantage / Gemini)
- 이벤트 감지 + 캘린더 이벤트 (FOMC/CPI/EARNINGS)
- daily_macro 확장 (DXY/VIX/WTI/Gold/BTC/US2Y)
- 섹터 ETF 7개
- Spring Boot API (JWT + Kakao OAuth, 세션/매매/점프/결과)
- React 프론트 (Login/Setup/Play/Result, 라이트모드, MacroTicker, MacroSheet)
- MDD 계산, 알파(NASDAQ 기준), 종목별 비교
- 워크플로우 자동화 + ntfy 알림 + Supabase 단일 DB 통합

### 진행 중
- **뉴스 처음부터 재수집** (2020-02 ~ 2024-12, 59개월, 매일 1달씩 ≈ 59일 소요)
- Oracle Cloud Always Free ARM 인스턴스 대기 (6h 주기 재시도)

### 다음 작업 (우선순위 미정)
- 실제 EP1 end-to-end 플레이 테스트 (한 번도 안 했음, 숨은 버그 색출)
- 투자 성향 분석 고도화 (보유 기간, 손절/익절 패턴)
- 전문가 포트폴리오 비교 (버핏 등 하드코딩 정성 요약)
- Oracle 확보 후 Render → OCI 이전 (백엔드)
- 결제 게이팅 (EP2/EP3 유료 잠금)

---

## 12. LLM 사용 원칙

이 프로젝트는 단순 AI 데모가 아닌 **장기 유지될 투자 뉴스 데이터셋 구축** 성격이 강하다.
한번 잘못 생성된 데이터가 이후 전체 품질에 지속 영향을 준다.

### LLM 은 "정규화 엔진" 으로만 사용
```
✅ 해도 되는 것                    ❌ 하면 안 되는 것
번역 / 단순 요약                  역사적 significance 판단
coarse theme tagging              "이 뉴스가 주가에 얼마나 영향?"
structured JSON 생성              기사 간 인과관계 추론
단순 sentiment 분류               미래 영향 예측 / 원인 단정
```

### 원본 데이터는 반드시 보존
`body / url / published_at / source / llm_raw` 를 모두 저장. 더 나은 모델/taxonomy 등장 시 재처리 가능하도록.

### dataset consistency 우선
연도별 품질 편차는 데이터셋 오염. flat taxonomy / 태그 최대 3개 / OTHER 허용 모두 이 원칙에서 나왔다.

### Gemini fallback 의 위험
이번 세션에서 뼈저리게 경험했듯, "그래도 뭐라도 저장하자" 식 fallback 은 절대 금지.
실패면 그냥 [] 반환 → 스킵. 데이터가 비는 것이 잘못된 데이터가 박히는 것보다 100배 낫다.

---

## 13. 개발자 참고

- **확장성 최우선**: 단일 기업 → 멀티 포트폴리오 전제
- **사전 처리 원칙**: 뉴스 AI 요약은 배치, 플레이 중 실시간 AI 호출 절대 금지
- **알파 + MDD 가 핵심 지표**: 단순 수익률만으로 표현 불가능한 "고통의 경로" 가 MDD
- **뉴스 포괄 수집**: 섹션 기반(Guardian) + ticker 기반(Alpha Vantage) → 종목 추가 시 재수집 불필요
- **이직 포트폴리오 목적**: 모든 기술 선택의 *이유* 를 코드/문서에 흔적으로 남긴다 (dev-log.md)

---

## 14. 🚨 절대 규칙 (Claude Code 가 반드시 따라야 함)

이 프로젝트는 **오너(박찬종)의 학습과 이해** 가 최우선이다.

### 1) 절대 뚝딱 만들지 않는다
파일 하나, 코드 한 줄을 추가하더라도 반드시 설명을 먼저 한다. 설명 없이 코드를 먼저 쓰지 않는다.

### 2) 단순 작업은 자동 진행, 설계/과금/커밋은 승인 필요
사용자가 합의한 작업 확인 정책 (`feedback_confirmation_policy.md` 메모리):
- 단순 코드 수정 / 자동 재기동 → 자동 진행
- 새로운 설계 결정 / 과금되는 API 호출 / git 커밋·머지 → 반드시 사전 승인

### 3) 코드 한 줄도 설명한다
새 파일/의존성/설정값/로직마다 "이게 왜 필요하고 왜 이렇게 했는지" 를 짚어준다.

### 4) 개념 확인 후 진행
새 개념이 나오면 쉬운 말로 먼저 설명 → "이해되셨나요?" 를 거친 후 다음 단계로.

### 5) 환각 방지
- 메모리/대화 컨텍스트에 의존해 "X 가 있다"고 단정하지 말 것. 파일을 읽거나 grep 으로 검증 후 발언.
- 이전 세션에서 결정된 것 ≠ 현재 코드. 항상 현재 코드를 한 번 더 확인.
- 사용자가 명시적으로 "쓰지 않는다"고 한 것 (ES / Kafka / K8s / Redis / 로컬 DB) 을 다시 끌어오지 말 것.

### 6) 의미 있는 변경 후 자동 커밋·푸시
신규 파일 추가 / 기능 단위 완료 / 설정 변경 시 자동 commit + push. **단, 사용자가 "커밋해" 라고 명시하지 않은 경우엔 묻고 진행.**

커밋 메시지 형식:
```
[타입] 작업 내용 요약

- 세부 변경 1
- 세부 변경 2

# 타입: feat / fix / config / docs / refactor / chore
```

### 7) 브랜치 정책
- 개발은 `develop` 에서. 검증된 변경만 `main` 으로 머지.
- 사용자 명시 요청 없이는 `main` 에 직접 커밋·푸시 절대 금지.

---

## 15. 외부 메모리·문서 위치

| 문서 | 위치 | 용도 |
|------|------|------|
| 개발 일지 | `docs/dev-log.md` | 의사결정 히스토리 — "왜 이렇게 됐나" |
| Claude 메모리 | `~/.claude/projects/-mnt-c-work-hindsight/memory/` | 사용자 선호 / 피드백 / 외부 시스템 포인터 |
| Memory 인덱스 | 위 디렉토리의 `MEMORY.md` | 항상 conversation context 에 자동 로드됨 |
