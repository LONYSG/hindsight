# Hindsight 개발 일지

> 작업하면서 내린 결정들과 그 이유를 기록한다.
> "왜 이렇게 했나요?"에 답할 수 있도록.

---

## 2026-05-12

### 1. 프로젝트 뼈대 잡기

**한 것:**
Git 저장소 초기화, README 작성, .gitignore 구성, 디렉토리 구조 생성.

**왜 이렇게 했나:**
- 코드보다 구조가 먼저다. 커밋 히스토리는 처음부터 쌓이기 때문에 나중에 고치기 어렵다.
- 브랜치 전략을 `main / develop / feat·fix·chore 브랜치` 구조로 잡았다. 혼자 작업해도 PR 기반으로 진행한 이유는, GitHub에서 "이 기능이 언제 왜 추가됐는지"를 추적할 수 있고 협업 방식을 따랐다는 것을 보여주기 위해서다.
- 커밋 메시지는 `feat:`, `fix:`, `chore:` 등 Conventional Commits 형식 + 한국어 설명으로 통일. 영어로만 쓰면 나중에 복기할 때 맥락이 잘 안 잡힌다.

**관련 PR:** #1 (chore: 프로젝트 초기 구조 설정)

---

### 2. 로컬 개발환경 구성 (docker-compose)

**한 것:**
`docker-compose.yml`로 PostgreSQL, Redis, Kafka, Elasticsearch를 한 번에 실행할 수 있는 환경 구성.

**왜 이렇게 했나:**
- 팀원 누구나(혹은 면접관이) `docker-compose up -d` 명령 하나로 동일한 환경을 띄울 수 있어야 한다.
- 모든 서비스를 `hindsight-net`이라는 같은 Docker 네트워크에 묶었다. 이렇게 하면 컨테이너끼리 IP 대신 서비스 이름으로 통신할 수 있다. (예: Spring Boot에서 DB 주소를 `postgres`로 쓸 수 있음)
- PostgreSQL, Redis, Elasticsearch에만 named volume을 설정했다. 컨테이너를 재시작해도 데이터가 사라지지 않게.
- Elasticsearch는 기본 보안(xpack)을 껐다. 로컬 개발환경에서 인증서까지 설정하면 불필요하게 복잡해진다. 운영 환경에서는 반드시 켜야 한다.

**나중에 발견한 문제:**
로컬 PC에 이미 PostgreSQL이 설치돼있어서 5432 포트 충돌이 났다. 처음부터 이걸 알았으면 5433으로 설정했을 텐데. → 결국 PostgreSQL 포트를 5433으로 바꿨다.

**관련 PR:** #1 (chore: 로컬 개발환경 docker-compose 구성)

---

### 3. DB 스키마 설계

**한 것:**
11개 테이블 DDL 작성 + 초기 데이터(회사, 시작점) INSERT.
파일명을 Flyway 마이그레이션 규칙(`V1__init_schema.sql`, `V2__seed_data.sql`)으로 지었다.

**왜 이렇게 했나:**

*Flyway 파일명 규칙을 처음부터 적용한 이유:*
나중에 Spring Boot + Flyway를 붙일 때 이 파일을 그대로 쓸 수 있다. 지금 편의대로 만들었다가 나중에 재작업하는 것보다 처음부터 맞게 하는 게 낫다.

*`sim_date` 컬럼명을 쓴 이유:*
`current_date`는 PostgreSQL 예약어라 컬럼명으로 쓸 수 없다. 처음에 이걸 몰랐다가 스키마 적용 중 에러로 발견했다.

*`market_event.company_id`를 NULL 허용으로 설계한 이유:*
FOMC 금리 결정, CPI 발표 같은 거시경제 이벤트는 특정 기업과 무관하다. NULL이면 전체 시장 이벤트, 값이 있으면 특정 기업 이벤트로 구분한다.

*`portfolio_snapshot`을 별도 테이블로 만든 이유:*
수익률 계산을 할 때마다 매매 이력을 전부 다시 계산하면 느리다. 날짜 점프마다 자산 현황을 스냅샷으로 저장해두면 빠르게 조회할 수 있다.

*seed data에 시작점 3개를 넣은 이유:*
"코로나 직전(2020-02)", "금리인상 직전(2022-01)", "트럼프 관세 직전(2025-01)"은 투자 판단이 극명하게 갈리는 역사적 변곡점이다. 유저가 자신의 판단력을 테스트하기 좋은 시나리오들이다.

**관련 PR:** #3

---

### 4. Python 데이터 파이프라인 환경 구성

**한 것:**
`collectors/`, `processors/`, `db/`, `config/` 폴더 구조 잡기, `requirements.txt`, `settings.py`, `.env.example` 작성.

**왜 이렇게 했나:**

*폴더를 역할별로 나눈 이유:*
`collectors/`는 외부 API에서 데이터를 가져오는 것만, `processors/`는 가공하는 것만 담당한다. 역할이 섞이면 나중에 어느 파일을 고쳐야 할지 찾기 어렵다. (단일 책임 원칙)

*`settings.py`를 만든 이유:*
환경변수를 코드 여기저기서 `os.environ.get()`으로 읽으면, 나중에 키 이름이 바뀔 때 전부 찾아서 고쳐야 한다. 한 파일에서 관리하면 수정이 한 곳에서 끝난다.

*`os.environ["KEY"]`와 `os.getenv("KEY", 기본값)`을 나눠 쓴 이유:*
API 키처럼 반드시 있어야 하는 값은 `[]`로 읽어서 없으면 즉시 에러를 낸다. 실수로 키를 빠뜨렸을 때 조용히 넘어가지 않도록. 호스트 주소처럼 기본값이 명확한 것은 `getenv`로 읽는다.

*`.env.example`을 만든 이유:*
실제 키가 담긴 `.env`는 `.gitignore`로 GitHub에 올라가지 않는다. 대신 "이런 환경변수가 필요하다"는 형식만 보여주는 `.env.example`을 커밋해서 새 환경에서 무엇을 채워야 하는지 알려준다.

**관련 PR:** #2

---

### 5. AI 뉴스 요약 모델 선택

**결정:** Gemini 2.5 Flash Lite → Gemini 3.1 Flash Lite

**왜 이렇게 했나:**
처음에 Gemini 2.5 Flash Lite를 선택했는데, 확인해보니 Gemini 3.1 Flash Lite도 API에서 사용 가능했다. 가격이 동일하다면 최신 모델을 쓰는 게 낫다. Claude API는 같은 용도로 10배 비쌌고, "Claude 생태계 통합"이라는 이유는 억지였다.

---

### 6. 주가 데이터 소스 선택 - 험난한 여정

**최종 결정:** Tiingo API

**시도한 소스들과 실패 이유:**

| 소스 | 시도 | 결과 | 실패 이유 |
|------|------|------|-----------|
| yfinance | 1순위 | ❌ | Yahoo Finance가 Cloudflare 보호 추가, 반복 테스트로 IP 차단 |
| Polygon.io | 2순위 | ❌ | 무료 플랜은 최근 2년치만 제공. 코로나 시작점(2020년) 커버 불가 |
| Stooq | 3순위 | ❌ | 최근 API 키 유료화로 변경 |
| Yahoo Finance 직접 URL | 4순위 | ❌ | 2024년부터 로그인 필요 |
| Alpha Vantage | 5순위 | ❌ | `outputsize=full`과 adjusted 가격 모두 유료로 전환됨 |
| **Tiingo** | **6순위** | ✅ | 무료, adjusted 가격, 전체 기간 제공 |

**배운 것:**
2024~2025년부터 무료 금융 데이터 API들이 잇따라 유료화됐다. 처음부터 유료화 리스크가 낮은 소스를 선택하거나, 데이터 소스 교체가 쉽도록 추상화 계층을 두는 게 좋다.

---

### 7. PostgreSQL 연결 문제 해결

**문제:**
psycopg2로 DB 연결 시 `UnicodeDecodeError: 'utf-8' codec can't decode byte 0xb8` 에러.

**원인 파악 과정:**
처음엔 인코딩 문제인 줄 알았다. 로케일, 환경변수, pg_service.conf 등 다 확인했지만 이상 없었다. pg8000으로 바꿔서 시도했더니 진짜 에러가 보였다: `28P01 password authentication failed`. psycopg2가 PostgreSQL의 한글 에러 메시지를 UTF-8로 디코딩하려다 죽은 것이었다.

**진짜 원인:**
로컬 PC에 이미 5432 포트를 쓰는 다른 PostgreSQL이 설치돼있었다. Python에서 `localhost:5432`로 연결하면 Docker 컨테이너가 아닌 그 서비스로 연결됐고, 거기엔 `hindsight` 유저가 없어서 인증 실패.

**해결:**
1. `docker-compose.yml` 포트를 `5432 → 5433`으로 변경
2. psycopg2 → psycopg3(v3) 교체 (SCRAM-SHA-256 인증 안정성 향상, 인코딩 처리 개선)

**교훈:**
에러 메시지가 이상하게 보일 때, 그 메시지 자체가 2차 에러일 수 있다. pg8000처럼 다른 라이브러리로 같은 작업을 해보면 진짜 에러가 드러난다.

---

### 8. 수집 결과

| 테이블 | 기간 | 건수 |
|--------|------|------|
| daily_price (NVDA) | 2019-10-01 ~ 2026-05-11 | 1,661건 |
| daily_indicator | 2019-10-01 ~ 2026-05-11 | 1,661건 |
| daily_macro | 2019-10-01 ~ 2026-05-12 | 1,726건 |

기술지표(RSI, MACD, 일목균형표)는 계산을 위해 실제 시작일보다 80일 앞의 데이터를 다운로드한 뒤, 계산 후 필요한 날짜만 저장했다. (일목균형표 기준선이 26일, 선행스팬B가 52일 필요)

---

## 다음에 할 것

- [ ] `event_detector.py` - 주가 ±3% 급변 / 거래량 급증 이벤트 감지
- [ ] `news_collector.py` - 뉴스 수집 + Gemini 요약 → Elasticsearch 저장
- [ ] FRED API 거시경제 이벤트 캘린더 (FOMC, CPI 발표일)
- [ ] Spring Boot 프로젝트 초기화 (Phase 2)
