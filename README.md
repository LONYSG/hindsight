# Hindsight

> "나스닥이 우상향인 걸 알면서도, 당신은 시장을 이길 수 있는가?"

역사적 시점으로 돌아가 실제 뉴스와 주가 데이터를 보며 투자 판단을 내리고,  
**시장 대비 내 수익률(알파)** 을 측정하는 주식 투자 시뮬레이터.

---

## 프로젝트 소개

유저는 특정 역사적 시점(예: 코로나 직전 2020년 2월)을 선택해 플레이를 시작합니다.  
그 시점의 실제 주가, 거래량, 기술적 지표, 뉴스를 보며 매수/매도 판단을 내리고,  
최종적으로 **내 수익률 vs 해당 주식 vs 나스닥 vs S&P500** 을 비교해 알파 점수를 산출합니다.

### 핵심 지표: 알파(Alpha)

단순 수익률이 아닌 **시장 대비 초과수익률** 이 이 서비스의 핵심입니다.

```
α = Rp - [Rf + β(Rm - Rf)]

Rp: 유저 수익률
Rm: 시장 수익률 (나스닥/S&P500)
Rf: 무위험수익률 (미국 10년 국채)
β:  포트폴리오 베타
```

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| Backend | Spring Boot, Spring Security (JWT), Spring Batch |
| Database | PostgreSQL, Redis, Elasticsearch |
| Data Pipeline | Python, Kafka |
| Frontend | React |
| Infrastructure | Docker, Kubernetes, GitHub Actions, ArgoCD |
| Monitoring | Prometheus, Grafana |
| 외부 API | yfinance, FRED API, SEC EDGAR, NewsAPI, Claude API |

---

## 아키텍처

```
[데이터 수집 - Python]
yfinance / FRED / NewsAPI
        ↓
[Kafka]
        ↓
[Spring Batch]
  → PostgreSQL (주가, 지표, 거시지표)
  → Claude API 요약 → Elasticsearch (뉴스)
        ↓
[Spring Boot API]
  - JWT 인증
  - 플레이 세션 관리
  - 매수/매도 처리
  - 수익률/알파 계산
        ↓
[React Frontend]
  - 주가 차트
  - 뉴스 요약 카드
  - 매수/매도 UI
  - 결과 대시보드
```

---

## 디렉토리 구조

```
hindsight/
├── backend/          # Spring Boot API 서버
├── frontend/         # React 클라이언트
├── data-pipeline/    # Python 데이터 수집 스크립트
├── k8s/              # Kubernetes manifests
└── docker-compose.yml
```

---

## 로컬 실행 방법

```bash
# 인프라 실행 (PostgreSQL, Redis, Kafka, Elasticsearch)
docker-compose up -d

# 데이터 수집
cd data-pipeline
python collect.py

# Backend 실행
cd backend
./gradlew bootRun

# Frontend 실행
cd frontend
npm install && npm start
```

> 상세한 환경 설정은 각 디렉토리의 README를 참고하세요.

---

## 개발 현황

| Phase | 내용 | 상태 |
|-------|------|------|
| Phase 1 | 데이터 파이프라인 | 🔲 진행 예정 |
| Phase 2 | Spring Boot API + React | 🔲 진행 예정 |
| Phase 3 | 인프라 (Docker, K8s, CI/CD) | 🔲 진행 예정 |
| Phase 4 | 알파 고도화, 랭킹 시스템 | 🔲 진행 예정 |
