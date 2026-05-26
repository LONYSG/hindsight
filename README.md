# Hindsight

> "나스닥이 우상향인 걸 알면서도, 당신은 시장을 이길 수 있는가?"

역사적 시점으로 돌아가 그 시점의 실제 뉴스/주가/지표를 보며 매수·매도 판단을 내리고,
**시장 대비 내 수익률(알파)** 과 **최대 낙폭(MDD)** 으로 자신의 투자 성향을 체험하는 시뮬레이터.

---

## 프로젝트 본질

단순한 "수익률 맞추기 게임"이 아니다.
**"당시 불확실성 속에서 내가 어떤 투자자였는가"** 를 체험하는 시뮬레이션이다.
결과보다 과정과 행동 패턴 분석이 핵심.

---

## 기술 스택

| 영역 | 사용 기술 |
|------|-----------|
| Backend | Spring Boot 3.5, Spring Security (JWT), JPA |
| Frontend | React + Vite, lightweight-charts v5, axios |
| Database | **PostgreSQL (Supabase Session Pooler) 단일 DB** |
| Data Pipeline | Python 3.12 + psycopg3 |
| Auth | JWT + Kakao OAuth |
| 외부 API | Tiingo (주가) · FRED + yfinance (거시) · The Guardian (뉴스) · Alpha Vantage (기업 뉴스) · Google Gemini (선별/요약) |
| 자동화 | GitHub Actions (수집·요약·OCI 재시도) |
| 알림 | ntfy (`hindsight_lonysg` 채널) |
| 배포 | Render (백엔드, 임시) → Oracle Cloud Always Free ARM (예정) |

**의도적으로 도입하지 않은 것**: Elasticsearch, Kafka, Kubernetes, Redis, Spring Batch, Prometheus/Grafana
(이전 README/문서에 언급되어 있으나 MVP 단계에서는 PostgreSQL 단일 DB로 충분히 처리 가능하다고 판단해 제거)

---

## 아키텍처

```
[데이터 수집 - Python, GitHub Actions]
Tiingo / FRED / yfinance / Guardian / Alpha Vantage
        ↓
[Gemini API]
  · Guardian 헤드라인 selection (relevance 1~5)
  · title_ko / brief / summary / themes 생성
        ↓
[PostgreSQL (Supabase)]
  · 주가, 지표, 거시지표, 캘린더 이벤트
  · 뉴스 (news 테이블)
  · 플레이 데이터 (세션, 매매, 스냅샷)
        ↓
[Spring Boot API]
  · JWT + Kakao OAuth
  · 플레이 세션 / 매수/매도 / 날짜 점프 / 결과 산출
        ↓
[React Frontend]
  · 캔들스틱 차트, 거시 지표 띠, 뉴스 카드, 매매 UI, 결과 리포트
```

---

## 디렉토리 구조

```
hindsight/
├── backend/          Spring Boot API
├── frontend/         React (Vite)
├── data-pipeline/    Python 데이터 수집기 + Gemini 요약
├── schema/           Flyway 마이그레이션 SQL (V1~V4)
├── docs/dev-log.md   개발 일지
├── CLAUDE.md         프로젝트 컨텍스트 + 작업 원칙
└── .github/workflows/  자동화 워크플로우
```

---

## 로컬 실행

```bash
# 1) 환경 변수
cp .env.example .env                              # backend / frontend 공용
cp data-pipeline/.env.example data-pipeline/.env  # 데이터 파이프라인

# 2) Backend (Java 17 필요)
cd backend && ./gradlew bootRun

# 3) Frontend
cd frontend && npm install && npm run dev

# 4) 데이터 파이프라인 (수동 실행 예시)
cd data-pipeline && source venv/bin/activate
python -c "from collectors.news_collector import collect; collect('2020-02-01','2020-02-29', summarize=False)"
python -c "from collectors.news_collector import re_summarize_all; re_summarize_all(date_from='2020-02-01', date_to='2020-02-29')"
```

---

## 자동 수집 (GitHub Actions)

| 워크플로우 | 스케줄 | 내용 |
|-----------|--------|------|
| `collect_news.yml` | 매일 09:05 KST | 1달치 Guardian + Alpha Vantage 수집 → 해당 월 Gemini 요약 → 상태 커밋 → ntfy 알림 |
| `collect_macro.yml` | 수동 | FRED + yfinance 거시지표 수집 |
| `collect_etf.yml` | 수동 | 섹터 ETF 7개 가격 수집 |
| `collect_calendar.yml` | 수동 | FOMC / CPI / EARNINGS 캘린더 적재 |
| `oracle_retry.yml` | 6h 주기 | OCI Always Free ARM 인스턴스 생성 재시도 |

진행 상태는 `data-pipeline/collection_state.json` 에 `{next_month, end_month}` 로 저장되며,
워크플로우가 매 실행마다 `next_month` 를 한 달 앞으로 밀고 자동 커밋한다.

---

## 자세한 컨텍스트

- **개발 일지** : `docs/dev-log.md` — 의사결정 히스토리 (왜 이렇게 됐나)
- **현재 상태 + 원칙** : `CLAUDE.md` — 새 세션에서 시작할 때 반드시 읽기
