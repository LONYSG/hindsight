# Stock Simulator - CLAUDE.md

## 프로젝트 개요

실제 역사적 시점으로 돌아가서, 그때의 정보(뉴스/지표)를 보며 투자 판단을 내리고
**시장 대비 내 수익률(알파)** 을 측정하는 주식 투자 시뮬레이터.

> "나스닥이 우상향인 걸 알면서도, 당신은 시장을 이길 수 있는가?"

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
   ├── 이벤트 발생일에만 뉴스 요약 제공
   ├── 매수 / 매도 (시드의 몇 % 단위로 입력)
   └── 날짜 점프 (다음날 / 1주일 / 1달 / 3달)
5. 최종 결과
   └── 내 알파 vs 해당 주식 수익률 vs 나스닥 vs S&P500
       → 타 유저 수익률과 비교 (랭킹)
```

---

## 이벤트 감지 기준 (뉴스 제공 조건)

평상시엔 뉴스 없이 주가/지표만 제공.
아래 조건에 해당하는 날에만 뉴스 요약 노출.

```
[자동 감지]
- 주가 ±3% 이상 변동일
- 거래량이 20일 평균 대비 200% 이상인 날

[캘린더 기반]
- 실적 발표일 (어닝)
- FOMC 금리 결정일
- CPI 발표일
- 대선 등 주요 정치 이벤트
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
- **Kafka** - 이벤트 브로커 (수집 → 처리 파이프라인)
- **Logstash** - 로그 수집

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
- **SEC EDGAR** - 실적 발표일
- **NewsAPI / GDELT / NYT API** - 과거 뉴스 수집
- **Claude API (Haiku)** - 뉴스 AI 요약 (배치 처리)

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
예: AAPL, NVDA, TSLA

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

[결과]
play_result (id, session_id, my_return, stock_return, nasdaq_return, sp500_return, alpha)
```

---

## 아키텍처 개요

```
[데이터 수집 - Python]
yfinance / FRED / NewsAPI
        ↓
[Kafka] ← 이벤트 브로커
        ↓
[Spring Batch]
  → PostgreSQL (주가, 지표, 거시지표)
  → Claude API 요약 → Elasticsearch (뉴스)
        ↓
[Spring Boot API]
  - 인증 (JWT)
  - 플레이 세션 관리
  - 매수/매도 처리
  - 수익률/알파 계산
        ↓
[React Frontend]
  - 주가 차트 (날짜 진행)
  - 뉴스 요약 카드
  - 매수/매도 UI
  - 최종 결과 대시보드
        ↓
[Kubernetes 배포]
[Prometheus + Grafana 모니터링]
```

---

## 개발 순서 (권장)

> 눈에 보이는 결과물을 빠르게 만드는 것을 우선으로 한다.
> 인프라 고도화는 플레이 가능한 상태가 된 이후에 진행한다.

```
Phase 1 - 데이터 파이프라인 (기반 데이터 확보)
  1. Python으로 yfinance 주가 수집 → PostgreSQL 저장
  2. 이벤트 감지 로직 (변동폭 + 캘린더)
  3. NewsAPI 뉴스 수집 → Claude API 요약 → Elasticsearch 저장
  4. FRED API 거시지표 수집
  5. Kafka 연동

Phase 2 - Spring Boot API + React 동시 진행 (플레이 가능한 상태 목표)
  [Backend]
  1. Spring Security + JWT 인증
  2. 플레이 세션 API (시작/진행/종료)
  3. 매수/매도 API
  4. 날짜 점프 API
  5. 수익률/알파 계산 API (단순 알파: 내 수익률 - 벤치마크 수익률)

  [Frontend]
  1. 로그인/회원가입
  2. 시작점 선택 화면
  3. 메인 플레이 화면 (차트 + 뉴스 + 매매)
  4. 결과 화면 (알파 비교)

Phase 3 - 인프라
  1. docker-compose 로컬 환경 구성
  2. Kubernetes 배포
  3. CI/CD (GitHub Actions + ArgoCD)
  4. Prometheus + Grafana 모니터링

Phase 4 - 고도화 (시간 여유 있을 때)
  1. 알파 공식 고도화
     단순 알파 → CAPM 기반 알파
     α = Rp - [Rf + β(Rm - Rf)]
     Rp: 유저 수익률 / Rm: 시장 수익률 / Rf: 무위험수익률(미국 10년 국채) / β: 포트폴리오 베타
  2. 랭킹 시스템 고도화
  3. 멀티 포트폴리오 확장
```

---

## 확장 계획 (MVP 이후)

- 기업 N개 추가 → 포트폴리오 구성 (A 30%, B 50%, 현금 20%)
- 멀티 포트폴리오 수익률 vs 시장 비교
- 시작점 추가 큐레이션
- 랭킹 시스템 고도화

---

## 로컬 개발환경 실행

```bash
# 인프라 전체 실행 (DB, Redis, Kafka, Elasticsearch)
docker-compose up -d

# Python 데이터 수집
cd data-pipeline
python collect.py

# Spring Boot 실행
cd backend
./gradlew bootRun

# React 실행
cd frontend
npm start
```

---

## 디렉토리 구조 (예정)

```
stock-simulator/
├── CLAUDE.md
├── docker-compose.yml
├── data-pipeline/        # Python 수집 스크립트
│   ├── collect_price.py
│   ├── collect_news.py
│   ├── collect_macro.py
│   └── detect_events.py
├── backend/              # Spring Boot
│   └── src/
│       ├── auth/         # Spring Security + JWT
│       ├── play/         # 플레이 세션 도메인
│       ├── trade/        # 매수/매도 도메인
│       ├── data/         # 주가/뉴스 데이터 API
│       └── result/       # 수익률/알파 계산
├── frontend/             # React
│   └── src/
│       ├── pages/
│       │   ├── Login/
│       │   ├── StartPoint/
│       │   ├── Play/
│       │   └── Result/
│       └── components/
└── k8s/                  # Kubernetes manifests
    ├── backend/
    ├── frontend/
    └── infra/
```

---

## 개발자 참고사항

- **확장성 최우선**: 모든 도메인 모델은 단일 기업 → 멀티 기업 확장을 전제로 설계
- **사전 처리 원칙**: 뉴스 AI 요약은 배치로 미리 처리, 플레이 중 실시간 AI 호출 없음
- **알파가 핵심 지표**: 단순 수익률이 아닌 시장 대비 초과수익률(alpha)이 이 서비스의 핵심
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
