# Stock Simulator - CLAUDE.md

## 프로젝트 개요

실제 역사적 시점으로 돌아가서, 그때의 정보(뉴스/지표)를 보며 투자 판단을 내리고
**시장 대비 내 수익률(알파)** 을 측정하는 주식 투자 시뮬레이터.

> "나스닥이 우상향인 걸 알면서도, 당신은 시장을 이길 수 있는가?"

**프로젝트 본질 (2025년 5월 기준 방향):**
단순한 "주식 수익률 맞추기 게임"이 아닌,
**"당시 불확실성 속에서 내가 어떤 투자자였는가"를 체험하는 시뮬레이션**.
결과보다 과정과 행동 패턴 분석이 핵심.

---

## 핵심 컨셉

- 유저는 특정 역사적 시점(코로나 직전 등)을 선택해 플레이 시작
- 그 시점의 실제 뉴스/주가/지표를 보며 매수/매도 판단
- 날짜를 내 페이스대로 넘길 수 있음 (다음날 / 1주일 / 1달 / 3달)
- 최종 목표: **내 수익률 vs 시장(나스닥/S&P500) vs 해당 주식** 비교 → 알파 점수 산출
- MVP는 기업 1개, 이후 멀티 포트폴리오로 확장 예정

---

## 플레이 흐름

```
1. 회원가입 / 로그인
2. 시작점 선택 (예: 코로나 직전 2020년 2월)
3. 기업 선택 (MVP: 1개)
4. 시드머니 지급 후 플레이 시작
   ├── 주가 / 거래량 / 기술적 지표 확인
   ├── 뉴스 조회 (importance 기준 필터링 가능)
   ├── 매수 / 매도
   └── 날짜 점프 (다음날 / 1주일 / 1달 / 3달)
5. 최종 결과
   └── 수익률 + MDD + 거래 횟수 + 알파 + 투자 성향 분석
```

---

## 이벤트 감지 기준 (뉴스 제공 조건)

현재는 날짜별로 뉴스를 조회하는 방식으로 구현됨.
importance 점수(1~5)로 필터링해서 노출.

```
[자동 감지 - 이미 구현]
- 주가 ±3% 이상 변동일 (PRICE_SPIKE)
- 거래량이 20일 평균 대비 200% 이상인 날 (VOLUME_SPIKE)

[캘린더 기반 - 미구현]
- 실적 발표일 (EARNINGS)
- FOMC 금리 결정일 (FOMC)
- CPI 발표일 (CPI)
- 대선 등 주요 정치 이벤트 (POLITICAL)
```

뉴스는 사전에 수집 + AI 요약 후 DB에 저장 (플레이 중 실시간 AI 호출 없음)

---

## 기술 스택

### Backend
- **Spring Boot** - API 서버
- **Spring Security + JWT** - 인증/인가
- **Spring Batch** - 데이터 수집 및 AI 요약 배치 처리

### Data Pipeline
- **Python** - 주가/뉴스/거시지표 수집, 이벤트 감지
- **Kafka** - 이벤트 브로커 (수집 → 처리 파이프라인) ← 미구현
- **Logstash** - 로그 수집 ← 미구현

### Database
- **PostgreSQL** - 유저, 포트폴리오, 매매이력, 주가 데이터
- **Redis** - 세션, 수익률 계산 캐싱
- **Elasticsearch** - 뉴스 데이터 저장 및 검색

### Frontend
- **React** - 차트, 뉴스, 매매 UI

### Infrastructure
- **Docker + docker-compose** - 로컬 개발환경
- **Kubernetes** - 운영 배포, HPA 오토스케일링, Helm chart
- **Prometheus + Grafana** - 모니터링
- **GitHub Actions + ArgoCD** - CI/CD (GitOps)

### 외부 API
- **yfinance** - 과거 주가/거래량 데이터
- **FRED API** - 금리, 국채, 거시지표
- **The Guardian API** - 과거 뉴스 수집 (NewsAPI 대신 선택, 무료)
- **Google Gemini API (Flash)** - 뉴스 헤드라인 선별 + AI 요약 (배치 처리)

---

## DB 설계 (개요)

```
[유저]
user (id, email, password_hash, created_at)

[시작점]
start_point (id, name, description, start_date)
예: "코로나 직전", "금리인상 직전", "트럼프 관세 직전"

[기업]
company (id, ticker, name, exchange)
예: NVDA (MVP), 이후 AAPL, TSLA 등 확장 예정

[일별 시장 데이터]
daily_price (id, company_id, date, open, high, low, close, volume)
daily_indicator (id, company_id, date, rsi, macd, macd_signal, ichimoku_data)
daily_macro (id, date, fed_rate, us_10y_yield, usd_krw, sp500, nasdaq)

[이벤트 & 뉴스]
market_event (id, company_id, date, event_type, summary)
event_type: EARNINGS / FOMC / CPI / PRICE_SPIKE / VOLUME_SPIKE / POLITICAL

[플레이]
play_session (id, user_id, start_point_id, company_id, seed_money, current_date, status)
trade_history (id, session_id, date, action, quantity, price, ratio)
portfolio_snapshot (id, session_id, date, cash, stock_value, total_value)

[결과] ← play_result에 MDD, 거래 횟수 등 추가 고려
play_result (id, session_id, my_return, stock_return, nasdaq_return, sp500_return, alpha,
             mdd, trade_count, cash_ratio_avg)

[뉴스 열람 이벤트] ← 투자 성향 분석용, 추후 구현
news_view (id, session_id, news_es_id VARCHAR, viewed_at TIMESTAMP)
-- news_es_id: Elasticsearch _id 문자열 그대로 저장 (FK 없음, ES에서 직접 조회)
```

---

## 뉴스 시스템 설계

### 수집 구조 (Python - The Guardian API)

```
Guardian API (business/technology/world 섹션)
        ↓
Gemini - 헤드라인 선별 + importance 1~5점 부여
        ↓
Elasticsearch 저장 (importance, themes 포함)
        ↓
[별도 단계] Gemini - 요약 (title_ko + summary + themes 한번에 JSON으로)
```

**설계 원칙:**
- 기업별 전용 수집 레이어 없음 → "미국 투자자가 볼 만한 뉴스" 포괄 수집
  - 이유: AAPL, TSLA 등 기업 추가 시 재수집 불필요. 이미 BUSINESS/TECHNOLOGY 섹션에서 선별됨
- 수집(선별)과 요약은 분리된 단계로 실행

### ES 인덱스: hindsight-news

```
date:         keyword
published_at: date
category:     keyword  (BUSINESS / TECHNOLOGY / WORLD)
source:       keyword
title:        text
title_ko:     text      ← Gemini 번역
url:          keyword
body:         text
summary:      text      ← Gemini 한국어 요약
importance:   integer   ← 1~5 (선별 단계에서 부여)
themes:       keyword[] ← 투자 테마 태그 (요약 단계에서 부여)
llm_raw:      text      ← 디버깅용 Gemini 원본 응답 (index: false)
```

### importance 점수 기준

```
5 = 시장 전체 또는 핵심 산업에 매우 큰 영향 (코로나 봉쇄, FOMC 빅스텝 등)
4 = 주요 기업/산업 흐름에 중요한 뉴스
3 = 투자자가 참고할 가치가 높은 뉴스
2 = 약한 관련성이 있지만 일부 투자자에겐 의미 있을 수 있는 뉴스
1 = 관련성은 있으나 중요도가 매우 낮은 뉴스
```

UI에서 기본은 importance 3 이상 노출, 4단계 필터 버튼(전체/★★★이상/★★★★이상/★★★★★만)으로 선택.

### themes 태그 시스템 (28개 flat 구조)

```
AI, SEMICONDUCTOR, CLOUD, SOFTWARE, ROBOTICS,
EV, ENERGY, NUCLEAR, BIOTECH, HEALTHCARE,
FINANCE, CRYPTO, DEFENSE, AEROSPACE,
GEOPOLITICS, CHINA, TRADE,
MACRO, FED, RATE, INFLATION, SUPPLY_CHAIN,
CONSUMER, RETAIL, MANUFACTURING, CYBERSECURITY, DATA_CENTER,
OTHER
```

**설계 원칙:**
- flat 구조 (계층 없음) - LLM consistency 유지, iteration 속도
- 최대 3개 - 태그 남발 방지
- 애매하면 OTHER - 억지 분류 금지
- 요약 단계에서 title_ko + summary + themes 한번에 JSON으로 생성

**활용 계획:**
- 관심 분야 기반 뉴스 정렬 (나중에 플레이 시작 시 관심 테마 선택)
- 유저 뉴스 소비 패턴 분석 (어떤 테마 뉴스를 많이 봤는가)
- narrative 분석 (특정 시기 AI 뉴스 비중 급증 등)

---

## 결과 화면 설계 방향

**핵심 방향: "정답 공개"가 아닌 "투자 성향 분석"**

```
금지 표현:
  - "당신은 틀렸습니다"
  - "이 타이밍에 매수했어야 했습니다"

권장 표현:
  - "당신은 급락 구간에서 현금 비중을 빠르게 늘리는 경향이 있었습니다"
  - "당신은 AI 관련 뉴스에 강하게 반응하는 경향이 있었습니다"
  - "당신의 최대 낙폭은 -18%였습니다. 전체 유저 평균은 -34%였습니다."
```

**MVP 결과 지표:**

| 지표 | 설명 | 데이터 출처 |
|---|---|---|
| 최종 수익률 | 시드 대비 최종 수익 | portfolio_snapshot |
| **MDD** | 최대 낙폭 (매우 중요) | portfolio_snapshot에서 계산 |
| 알파 | 시장(S&P500/나스닥) 대비 초과수익 | play_result |
| 거래 횟수 | 총 매매 횟수 | trade_history |
| 현금 보유 비율 | 평균 현금 비중 | portfolio_snapshot |

> MDD가 중요한 이유: +80% 수익률이더라도 중간에 -70% drawdown이 있었다면
> 실제 투자 경험은 매우 고통스러웠을 것. 단순 수익률만으로는 그 경험을 설명 못함.

**나중에 추가 고려:**
- 승률 (매매별 손익)
- 평균 보유 기간
- 유저 평균 데이터와 비교 (유저 수가 쌓여야 의미 있음)
- 투자 성향 자동 분류 (공격적 / 보수적 / FOMO형 / 공포 매도형 등)

---

## 뉴스 열람 이벤트 (news_view)

유저가 뉴스 상세를 열람했을 때 기록. themes 태그와 결합해 투자 성향 분석에 활용.

**MVP 수준:**
- 뉴스 상세 펼쳤을 때만 기록 (open_detail)
- dwell time / scroll depth / focus tracking은 오버엔지니어링 → MVP에서 제외

**활용 예시:**
- "당신은 AI/SEMICONDUCTOR 뉴스를 전체의 60% 조회했습니다"
- "당신은 평균보다 적은 뉴스를 봤지만 높은 수익률을 기록했습니다"
- "당신은 뉴스 소비량은 많았지만 거래 빈도가 과도하게 높았습니다"

---

## 현재 진행 상황 (2025년 5월 기준)

### 완료
- Python 데이터 파이프라인
  - NVDA 주가 수집 (daily_price)
  - 거시지표 수집 (daily_macro)
  - 이벤트 감지 (PRICE_SPIKE, VOLUME_SPIKE)
  - 뉴스 수집 (Guardian API + Gemini 선별, importance 점수)
- Spring Boot API
  - JWT 인증
  - 플레이 세션 관리 (시작/진행/종료)
  - 매수/매도 API
  - 날짜 점프 API
  - 수익률/알파 계산
- React 프론트엔드
  - 로그인/회원가입
  - 메인 플레이 화면 (차트, 뉴스, 매매, 포트폴리오 탭)

### 완료 (2026-05-15 추가)
- 전체 UI 라이트모드 전환 (Login/Setup/Play/Result + 모든 탭)
- PlayPage 헤더 재설계
  - 🔔 종 아이콘 + 드롭다운 알림 패널 (이벤트 상세 표시)
  - 날짜 한줄 표시: `2020.02.15 (토)` 형식
  - EventInfo에 companyTicker 추가 → `NVDA 주가급변` 형태
  - 종료 버튼 + 탭 활성 표시기 버그 수정
- PriceTab 일간 변동률 수정 (시가 기준 → 전일 종가 기준)
- 차트 줌 레벨 유지 (날짜 점프 시 scrollToRealTime 사용)
- 바텀시트 주문창 maxWidth 480px로 수정 (셸 너비 일치)
- 뉴스 시스템 전면 개선
  - look-ahead bias 제거: published_at 범위 쿼리
  - 주말/공휴일 뉴스 자동 이월 (전 거래일 장마감 ~ 당일 장마감)
  - DST(서머타임) 반영: EDT 20:00 UTC / EST 21:00 UTC
  - 정렬: published_at ASC 고정 (시간순)
  - 날짜 구분선: 토요일/일요일/공휴일/전일 장후 배지
  - 중요도 필터 버튼 4단계로 교체
  - NewsResponse DTO: prevTradingDay 포함
  - summary 프롬프트: 의미 전환 시 \n\n 문단 분리
  - 비거래일 장전/장중/장후 배지 숨김

### 진행 중
- 뉴스 요약 재실행 (re_summarize_all) — 새 프롬프트(문단 분리) 적용 필요
  - 2020년 2월 381건 수집 완료, 요약은 구 프롬프트 상태

### 미완료 / 다음 작업
- 뉴스 요약 완료 (re_summarize_all 실행, Gemini 500 req/일 한도 내)
- FOMC/CPI 캘린더 이벤트 수집 (market_event 테이블)
- 멀티 포트폴리오 실제 플레이 검증 (M7 종목 분산 투자)
- 결과 화면 MDD 계산 검증
- 인프라 (docker-compose 정리, GitHub Actions CI/CD)

---

## 데이터 수집 범위 결정 방침

**현재: 2020년 2월 1개월치만 운영 중**

이유: 수집에 시간이 오래 걸리고 방향이 바뀔 수 있음.
시스템을 몇 번 사용해보고 나서 범위 확장 여부 결정.

수집 범위 확장 시 고려 시나리오:
- 2020년 2~4월 (코로나 급락 + 반등 전체)
- 2022년 금리 인상 시기
- 2025년 트럼프 관세 시기

기업 추가 시 뉴스 재수집 불필요:
BUSINESS/TECHNOLOGY/WORLD 섹션을 포괄 수집하는 구조이므로,
AAPL, TSLA 등 종목 추가해도 이미 해당 기업 뉴스가 포함되어 있음.

---

## 아키텍처 개요

```
[데이터 수집 - Python]
Guardian API / FRED
        ↓
[Gemini API]
  → 헤드라인 선별 + importance 점수
  → 한국어 번역 + 요약 + themes 태깅 (배치)
        ↓
[Elasticsearch] ← 뉴스 (hindsight-news 인덱스)
[PostgreSQL]    ← 주가, 지표, 거시지표, 플레이 데이터
        ↓
[Spring Boot API]
  - 인증 (JWT)
  - 플레이 세션 관리
  - 매수/매도 처리
  - 수익률/알파/MDD 계산
        ↓
[React Frontend]
  - 주가 차트 (날짜 진행)
  - 뉴스 카드 (importance 필터, themes 표시)
  - 매수/매도 UI
  - 결과 화면 (투자 성향 분석)
        ↓
[Kubernetes 배포] ← 미구현
[Prometheus + Grafana 모니터링] ← 미구현
```

---

## 개발 순서 (권장)

> 눈에 보이는 결과물을 빠르게 만드는 것을 우선으로 한다.
> 인프라 고도화는 플레이 가능한 상태가 된 이후에 진행한다.

```
Phase 1 - 데이터 파이프라인 ✅ 완료
  1. Python으로 yfinance 주가 수집 → PostgreSQL 저장 ✅
  2. 이벤트 감지 로직 (PRICE_SPIKE, VOLUME_SPIKE) ✅
  3. Guardian API 뉴스 수집 → Gemini 선별 + 요약 → Elasticsearch ✅ (요약 진행 중)
  4. FRED API 거시지표 수집 ✅
  5. FOMC/CPI 캘린더 이벤트 수집 ← 미완료

Phase 2 - Spring Boot API + React ✅ 완료 (기본 플레이 가능)
  [Backend]
  1. Spring Security + JWT 인증 ✅
  2. 플레이 세션 API (시작/진행/종료) ✅
  3. 매수/매도 API ✅
  4. 날짜 점프 API ✅
  5. 수익률/알파 계산 API ✅

  [Frontend]
  1. 로그인/회원가입 ✅
  2. 시작점 선택 화면 ✅
  3. 메인 플레이 화면 (차트 + 뉴스 + 매매) ✅
  4. 결과 화면 ← 개선 필요 (MDD + 투자 성향 분석 추가)

Phase 3 - 인프라 ← 미구현
  1. docker-compose 로컬 환경 정리
  2. Kubernetes 배포
  3. CI/CD (GitHub Actions + ArgoCD)
  4. Prometheus + Grafana 모니터링

Phase 4 - 고도화 (시간 여유 있을 때)
  1. 알파 공식 고도화
     단순 알파 → CAPM 기반 알파
     α = Rp - [Rf + β(Rm - Rf)]
     Rp: 유저 수익률 / Rm: 시장 수익률 / Rf: 무위험수익률(미국 10년 국채) / β: 포트폴리오 베타
  2. 결과 화면 고도화
     - MDD, 거래 횟수, 현금 비율 표시
     - 투자 성향 분류 (공격적 / 보수적 / FOMO형 등)
     - 유저 평균과 비교 (유저 수가 쌓인 이후)
  3. news_view 이벤트 수집 + 분석
  4. themes 기반 뉴스 필터링 / 관심 분야 설정
  5. 랭킹 시스템 고도화
  6. 멀티 포트폴리오 확장
```

---

## 확장 계획 (MVP 이후)

- **기업 확장**: AAPL, TSLA, META 등 추가 (뉴스 재수집 불필요)
- **멀티 포트폴리오**: A 30%, B 50%, 현금 20% 식 구성
- **시작점 확장**: 2022년 금리인상, 2025년 관세 시기 등
- **관심 분야 설정**: 플레이 시작 시 관심 themes 선택 → 해당 뉴스 상단 노출
- **narrative 분석**: 특정 시기 AI/MACRO 뉴스 비중 변화 시각화
- **투자 성향 리포트**: 누적 플레이 기록 기반 장기 성향 분석

---

## 로컬 개발환경 실행

```bash
# 인프라 전체 실행 (DB, Redis, Elasticsearch)
docker-compose up -d

# Python 뉴스 수집 (예: 2020년 2월)
cd data-pipeline
source venv/bin/activate
python -c "from collectors.news_collector import collect; collect('2020-02-01', '2020-02-29', summarize=False)"

# 뉴스 요약 (title_ko + summary + themes 생성, Gemini 과금 발생)
python -c "from collectors.news_collector import re_summarize_all; re_summarize_all()"

# Spring Boot 실행
cd backend
./gradlew bootRun

# React 실행
cd frontend
npm run dev
```

---

## LLM 사용 원칙

이 프로젝트는 단순 AI 데모가 아닌 **장기 유지될 투자 뉴스 데이터셋 구축** 성격이 강하다.
한 번 잘못 생성된 데이터가 이후 전체 시스템 품질에 지속적으로 영향을 준다.
따라서 LLM 성능을 과신하지 않는 것이 핵심 원칙이다.

### LLM은 "판단 엔진"이 아닌 "정규화(normalization) 엔진"으로 사용한다

```
✅ 안정적인 사용 (해도 되는 것)     ❌ 위험한 사용 (하면 안 되는 것)
───────────────────────────────    ────────────────────────────────────
제목 번역                           역사적 significance 판단
단순 요약                           "이 뉴스가 주가에 얼마나 영향을 줬는가"
coarse theme tagging               기사 간 인과관계 추론
structured JSON 생성               "당시 시장 심리" 판단
단순 sentiment 분류                미래 영향 예측 / 원인 단정
```

### dataset consistency를 최우선으로

- 시간축 데이터라는 특성상 연도별 품질 편차가 생기면 데이터셋 오염으로 이어진다
- LLM 결과를 "최종 진실"이 아닌 "현재 시점의 보조 가공 데이터"로 취급한다
- flat taxonomy / coarse-grained 분류 / OTHER 허용 / 태그 개수 제한은 모두 이 원칙에서 나온 설계다

### 원본 데이터를 반드시 보존한다

향후 더 좋은 모델이 등장하거나 taxonomy가 바뀌었을 때 재처리할 수 있도록:

- `body`: 원문 기사 본문 (ES에 저장)
- `url`: 원문 링크
- `published_at`: 원본 발행 시각
- `source`: 출처
- `llm_raw`: Gemini 원본 응답 (디버깅 + 재처리용)

이 필드들이 있으면 나중에 더 나은 모델로 theme tagging이나 sentiment 분류를 다시 할 수 있다.

### 새 LLM 기능 추가 시 이 기준으로 판단한다

"이게 단순 정규화인가, 아니면 고차원 판단인가?"
고차원 판단에 가까울수록 데이터 품질 리스크가 높다.

---

## 개발자 참고사항

- **확장성 최우선**: 모든 도메인 모델은 단일 기업 → 멀티 기업 확장을 전제로 설계
- **사전 처리 원칙**: 뉴스 AI 요약은 배치로 미리 처리, 플레이 중 실시간 AI 호출 없음
- **알파가 핵심 지표**: 단순 수익률이 아닌 시장 대비 초과수익률(alpha)이 이 서비스의 핵심
- **MDD도 핵심 지표**: 수익률과 함께 반드시 제공. 고수익 + 고drawdown은 다른 경험
- **뉴스 포괄 수집**: 기업별 전용 레이어 없이 섹션 기반 포괄 수집 → 종목 추가 시 재수집 불필요
- **이직 포트폴리오 목적**: 각 기술 선택의 이유를 코드/문서에 명시할 것

---

## 🚨 절대 규칙 (Claude Code가 반드시 따라야 할 원칙)

이 프로젝트는 단순 구현이 목적이 아니다. **오너(박찬종)의 학습과 이해가 최우선**이다.

### 1. 절대 뚝딱 만들지 않는다
- 파일 하나, 코드 한 줄을 추가하더라도 반드시 설명을 먼저 한다
- 설명 없이 코드를 먼저 작성하는 것은 금지

### 2. 작업 전 반드시 물어본다
모든 작업은 아래 형식으로 시작한다:
```
"[작업명]을 진행하려고 합니다.
이유: [왜 지금 이 작업이 필요한지]
내용: [무엇을 할 것인지]
진행할까요?"
```
오너가 명확히 이해하고 승인한 이후에만 작업을 시작한다.

### 3. 코드 한 줄도 설명한다
- 새로운 파일을 만들 때: 이 파일이 왜 필요한지, 전체 구조에서 어떤 역할인지
- 새로운 의존성(라이브러리)을 추가할 때: 이게 무엇인지, 왜 이걸 선택했는지
- 설정값을 추가할 때: 이 값이 무슨 의미인지, 왜 이 값인지
- 코드 블록을 작성할 때: 이 로직이 왜 이렇게 구현됐는지

### 4. 개념 확인 후 진행
오너가 부족한 지식이 많다는 것을 항상 인지한다.
- 새로운 개념이 등장하면 쉬운 말로 먼저 설명한다
- "이해가 되셨나요? 진행할까요?" 를 반드시 묻는다
- 오너가 완전히 이해했다는 확인이 있어야만 다음 단계로 넘어간다

### 5. 이 프로젝트의 주인은 오너다
- Claude Code는 도구일 뿐, 주도권은 항상 오너에게 있다
- 오너가 모르는 채로 넘어가는 단계는 없다
- 빠른 완성보다 완전한 이해가 우선이다

### 6. 의미 있는 변경 후 자동 git commit/push
아래 경우에 해당하면 자동으로 commit 및 push를 진행한다:
- 새로운 파일이 추가됐을 때
- 기능 단위 구현이 완료됐을 때
- 설정 변경이 있었을 때

커밋 메시지 형식:
```
[타입] 작업 내용 요약

- 세부 변경사항 1
- 세부 변경사항 2

# 타입: feat / fix / config / docs / refactor / chore
```
