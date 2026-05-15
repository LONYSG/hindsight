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

---

## 2026-05-13

### 9. 이벤트 감지기 구현

**한 것:**
`processors/event_detector.py` 작성. DB의 주가 데이터를 읽어 PRICE_SPIKE / VOLUME_SPIKE 이벤트를 감지하고 `market_event` 테이블에 저장.

**감지 기준:**
- PRICE_SPIKE: 전일 대비 종가 변동 ±3% 이상
- VOLUME_SPIKE: 거래량이 20일 이동평균의 200% 이상

**NVDA 결과:** PRICE_SPIKE 491건, VOLUME_SPIKE 29건 (총 520건)

**왜 `collectors/`가 아닌 `processors/`에 넣었나:**
외부 API를 호출하지 않고 이미 DB에 있는 데이터를 처리하는 역할이기 때문. 역할에 맞는 디렉토리를 쓰면 나중에 어느 파일을 고쳐야 할지 바로 찾을 수 있다.

**멱등성 처리:**
기존에 저장된 이벤트 목록을 메모리에 불러와 set으로 비교. 재실행해도 중복 저장 없음.

**관련 PR:** #5

---

### 10. 뉴스 수집기 설계 - 험난한 여정

**최종 결정:** Guardian API 단독 + Gemini 헤드라인 선별

**왜 이렇게 됐나 - 시도한 방식들:**

*1차: GDELT + BigQuery*
전세계 뉴스 색인 서비스. BigQuery 공개 데이터셋으로 7년치 무료 접근 가능. 그런데 GDELT는 URL만 있고 기사 제목/본문이 없다. URL을 직접 스크래핑해야 하는데 7년된 기사는 404가 많아 포기.

*2차: Guardian + NYT 조합*
Guardian은 기사 전문 무료 제공, NYT는 초록 제공. 조합해서 쓰려 했는데 NYT API가 하루 단위 쿼리에서 자꾸 0건 반환, 섹션 필터도 작동 안 함. NYT 키워드 검색은 "nvidia"가 한 번만 언급돼도 포함돼서 무관한 기사가 대거 유입. 결국 NYT 제거.

*3차: Guardian 단독 (섹션 기반)*
Guardian `business` 섹션을 쓰면 될 줄 알았는데, Guardian이 영국 매체라 "Boohoo 보너스", "Paddy Power 벌금" 같은 영국 내수 기사가 섞였다. `production-office=us` 필터는 비즈니스 섹션에서 0건. 키워드 필터도 영국 기사가 같은 금융 용어를 써서 소용없었다.

*4차: Gemini 헤드라인 선별 도입 (최종)*
하루치 전체(최대 82건)를 수집한 뒤, 헤드라인만 Gemini에 보내서 "시장 영향 가능성"을 기준으로 선별. 영국 내수 기사 자동 제거, 개수도 유동적으로 결정.

**최종 구조:**

```
[베이스 레이어] Guardian 3개 섹션, 하루씩 쿼리, page-size=200
  business|money / technology / world|us-news|politics
  → 82건 헤드라인 전체를 Gemini에 전달 → 시장 영향도 3점 이상만 저장

[NVDA 레이어] Guardian nvidia 키워드, 월 단위 배치
  → Gemini로 실제 NVDA 관련 여부 재확인 (false positive 제거)
```

**Gemini 선별 프롬프트 핵심:**
"단순히 유명 뉴스를 고르는 게 아니라, 실제로 미국 증시(S&P500, Nasdaq), 주요 산업, 또는 글로벌 자금 흐름에 영향을 줄 가능성이 있는 뉴스만 선별"

**비용:**
Gemini 3.1 Flash Lite 무료 티어 활용. 3개월치 기준 토큰 사용량이 하루 무료 한도(100만 토큰) 이내.

**수집 결과 (2020-02-01 ~ 2020-04-30):**

| 카테고리 | 건수 |
|---|---|
| WORLD | 380건 |
| BUSINESS | 173건 |
| TECHNOLOGY | 32건 |
| NVDA_DIRECT | 4건 |
| **합계** | **589건** |

NVDA_DIRECT가 4건인 건 정상. 2020년 초는 AI 붐 이전이라 NVIDIA 관련 뉴스가 드물었다.

**관련 PR:** #5 (news_collector 포함)

---

### 11. Spring Boot 프로젝트 초기화

**한 것:**
Spring Boot 3.5.0 + Gradle 프로젝트 생성. JWT 인증 구현까지.

**의존성 선택 이유:**
- `spring-boot-starter-security` + `jjwt 0.12.6`: Stateless JWT 인증. 세션 없이 토큰으로 인증하는 표준 방식. REST API에 적합.
- `spring-boot-starter-data-jpa`: DB 접근 추상화. SQL 직접 쓰는 것보다 유지보수가 쉽다.
- `postgresql`: JDBC 드라이버.
- `lombok`: 반복 코드(getter, constructor, builder) 제거.
- `spring-boot-starter-validation`: 요청 파라미터 검증을 어노테이션으로 처리.

**패키지 구조 설계:**
```
com.hindsight
├── auth/        - 인증 (JWT, 회원가입/로그인)
├── play/        - 플레이 세션
├── trade/       - 매수/매도
├── data/        - 주가/뉴스 데이터 조회
├── result/      - 수익률/알파 계산
└── global/      - 공통 설정, 예외 처리
```

도메인별로 controller/service/dto/entity/repository를 각각 패키지 안에 묶었다. 계층별(`controller/`, `service/`) 구조보다 도메인별 구조가 기능을 추가/수정할 때 관련 파일을 한 곳에서 찾을 수 있어 편하다.

**`application.yml`에서 `ddl-auto: validate`를 쓴 이유:**
`create`나 `update`를 쓰면 JPA가 스키마를 자동으로 바꿔버린다. Flyway로 이미 스키마를 정밀하게 설계했는데 JPA가 멋대로 바꾸면 충돌이 생긴다. `validate`는 엔티티와 DB 스키마가 일치하는지 확인만 하고 건드리지 않는다.

**관련 PR:** #6

---

---

## 2026-05-14

### 12. Spring Boot 서버 첫 실행

**한 것:**
Java 17 설치 후 `./gradlew bootRun` 으로 서버 첫 실행 성공. 회원가입/로그인 API 테스트 완료.

**문제:** WSL 환경에 Java 8만 설치되어 있어 Spring Boot 3.5.0 실행 불가 (최소 Java 17 필요).

**해결:** `sudo apt install openjdk-17-jdk` 후 시스템 기본 Java 버전 전환.

**결과:** 회원가입 201, 중복 이메일 400, 로그인 200 + JWT 토큰 정상 동작 확인.

---

### 13. 플레이 세션 API 구현

**한 것:**
게임의 핵심 3개 API 구현.

| API | 설명 |
|---|---|
| `POST /api/play/sessions` | 게임 시작 (시드머니, 시작점, 기업 선택) |
| `GET /api/play/sessions/{id}/state` | 현재 날짜 주가 + 포트폴리오 + 이벤트 조회 |
| `POST /api/play/sessions/{id}/next` | 날짜 점프 (NEXT_DAY / WEEK / MONTH / THREE_MONTHS) |

**엔티티 설계 주요 결정:**

`PlaySession.userId`를 JPA `@ManyToOne`으로 `User`에 연결하지 않고 `Long` 타입으로만 저장한 이유:
`auth` 도메인의 `User` 엔티티를 `play` 도메인이 직접 참조하면 도메인 간 결합이 생긴다. FK는 DB가 보장하고, JPA 관계는 맺지 않는 방식으로 도메인 경계를 지켰다.

`portfolio_snapshot`에 UNIQUE(session_id, date) 제약이 있어, 같은 날 여러 번 매매 시 중복 INSERT 에러가 발생했다. 해결: 매매 전 해당 날짜 스냅샷을 DELETE 후 재삽입.

**관련 PR:** #7

---

### 14. 매수/매도 API

**한 것:**
`POST /api/play/sessions/{id}/trade` 구현. 수량(quantity) 기반 매수/매도.

**핵심 계산:**
- 매수가능수량: `floor(현금 / 종가)`
- 매도가능수량: trade_history의 BUY - SELL 누적
- 매입금액(book value): `평균매입단가 × 보유수량` (가중평균 방식)
- 평가손익: `주식평가금액 - 매입금액`

**포트폴리오 필드 (증권사 MTS 스타일):**
예수금, 주식평가금액, 매입금액, 평가손익, 평가수익률, 총평가금액, 총수익률(시드 대비)

**단위 문제:**
시드머니를 원화로 입력하고 NVDA는 달러라 단위가 섞이는 문제 발견.
**결정: 달러 통일.** 시드머니를 달러($1K / $10K / $50K / $100K)로 선택하도록 변경.

---

### 15. React 프론트엔드 구현

**한 것:**
Vite + React 프로젝트 초기화 후 3개 페이지 구현.

**페이지 구성:**
- `LoginPage`: 로그인/회원가입 탭 전환
- `SetupPage`: 시작점/기업/시드머니 선택
- `PlayPage`: 탭 기반 플레이 화면 (시세/주문/잔고/뉴스)
- `ResultPage`: 수익률 비교 + 알파 결과 화면

**기술 결정:**

*Vite 프록시 설정:*
`/api` → `http://localhost:8080` 프록시. 프론트(5173)와 백엔드(8080) 포트가 달라서 생기는 CORS 문제를 이 방법으로 해결. 브라우저 요청은 Vite 서버를 거쳐 백엔드로 전달되므로 CORS 정책에 걸리지 않는다.

*JWT 자동 첨부:*
axios 인터셉터로 모든 요청에 `Authorization: Bearer <token>` 자동 추가. 401 응답 시 로그인 페이지로 자동 리다이렉트.

*`useIsMobile` 훅:*
768px 기준으로 PC/모바일 레이아웃 전환. 모든 컴포넌트가 이 훅 하나로 반응형 처리.

*max-width 480px 중앙정렬:*
무신사 등 모바일 우선 서비스처럼 PC에서도 앱처럼 보이게. 양쪽에 여백이 생겨 집중감 향상.

*Inter 폰트:*
Google Fonts에서 로드. 기본 시스템 폰트보다 가독성 좋고 현대적.

---

### 16. 탭 기반 PlayPage 재설계

**왜 탭으로 바꿨나:**
초기 구현은 모든 정보(주가, 포트폴리오, 주문창, 뉴스)를 한 페이지에 세로로 나열해서 스크롤이 길었다. 실제 MTS 앱처럼 탭으로 분리해서 각 기능에 집중.

**구조:**
```
[헤더: 날짜 + 이벤트 배지 + 종료 버튼]  ← 고정
[탭바: 시세 / 주문 / 잔고 / 뉴스]        ← 고정
[탭 컨텐츠]                               ← 스크롤 없음
[날짜 이동: 다음날 / 1주일 / 1달 / 3달]  ← 고정
```

---

### 17. 캔들스틱 차트

**라이브러리:** TradingView `lightweight-charts` v5

*recharts를 쓰지 않은 이유:*
recharts는 라인/바 차트에 적합하지만 캔들스틱 지원이 약하다. lightweight-charts는 실제 증권 차트 라이브러리라 OHLC 캔들봉을 네이티브로 지원하고 성능도 좋다.

**주의:** v5에서 API 변경 - `chart.addCandlestickSeries()` → `chart.addSeries(CandlestickSeries, options)`. 버전 변경 시 반드시 확인.

**색상:** 상승 빨강(#f43f5e), 하락 파랑(#3b82f6) - 한국 증권사 MTS 스타일.

---

### 18. 뉴스 탭 ES 연동

**한 것:**
`GET /api/data/news?date=YYYY-MM-DD&minImportance=3` 구현.
RestTemplate으로 Spring Boot → ES REST API 직접 호출.

**장전/장중/장후 배지:**
Guardian의 `published_at` (ISO 타임스탬프)를 파싱해서 미국 장 시간 기준으로 분류.
- 장전: UTC 14:30 미만 (EST 09:30 전)
- 장중: UTC 14:30 ~ 21:00
- 장후: UTC 21:00 이후

중요도 별점(★)도 함께 표시. "약한 신호 보기" 토글로 importance 2점짜리도 확인 가능.

---

### 19. 결과 화면 (ResultPage)

**한 것:**
게임 종료 시 수익률 계산 + 알파 산출 + 결과 화면 표시.

**알파 계산:**
`α = 내 수익률 - S&P500 수익률`

**benchmark 데이터 출처:**
`daily_macro` 테이블의 `sp500`, `nasdaq` 필드.

**JPA 컬럼명 주의사항:**
Spring의 `SpringPhysicalNamingStrategy`는 숫자 뒤에 오는 대문자에는 언더스코어를 붙이지 않는다. `sp500Return` → `sp500return` (틀림). 해결: `@Column(name = "sp500_return")` 명시.

---

### 20. 프로젝트 철학 정립 (ChatGPT 세션 인사이트)

오늘 사용자와 ChatGPT 간 대화에서 중요한 설계 원칙들이 도출됐다.

**핵심 철학:**
> "과거 특정 시점의 투자자가 되어, 당시 존재했던 정보만으로 투자 판단을 체험하는 것"

이 프로젝트는 차트 리플레이 앱이 아니라 **역사적 투자 판단 시뮬레이션**이다.

**뉴스 시스템 설계 원칙:**
- **저장은 넓게, 플레이는 압축**: importance >= 2까지 저장, 기본 플레이에서는 >= 3만 노출
- **Precision < Recall**: 약한 신호를 놓치는 것이 노이즈를 포함하는 것보다 위험
- **importance는 정답 힌트가 아님**: UI 강조/이벤트 크기 조절용

**Hindsight 시스템 결정:**
현재 단계에서 hindsight significance는 **구현하지 않는다.**

이유:
- 단일 뉴스 → 주가 인과관계 단정은 위험 (correlation ≠ causation)
- Flash 모델로 장기 역사 significance 판단은 신뢰성이 낮음
- MVP에서는 "당시 정보 환경 체험"이 핵심

미래 Hindsight Layer 설계안 (Phase 4 이후):
```
Raw News: headline, summary, timestamp, importance (당시 기준)
Scenario Layer: scenario_id, historical_significance, retrospective_commentary
```
같은 뉴스도 시나리오(AI 붐, 코로나, 금리인상)마다 significance가 다를 수 있다.

---

### 21. 뉴스 선별 프롬프트 전면 개편

**변경 이유:**
기존 프롬프트는 너무 엄격해서 약한 신호를 놓쳤다. "3점 이상만" 고정 필터를 "2점 이상 저장, 3점 이상 노출" 구조로 변경.

**응답 형식 변경:**
```
기존: 3,7,12,18
신규: 3|5, 7|4, 12|3  (번호|중요도)
```

importance 점수를 선별 단계에서부터 저장하게 됨.

**요약 프롬프트 분리:**
- `_TITLE_KO_PROMPT`: 헤드라인 한국어 번역 전용
- `_SUMMARY_PROMPT`: 본문 요약 전용

두 프롬프트 모두 사용자가 직접 작성. 형식 제약 엄격히 명시 ("요약:", 번호 목록 금지 등).

---

### 22. 뉴스 재수집 결정

**이유:**
- 기존 3개월치 데이터는 구 프롬프트로 수집 (importance 없음, 엄격한 필터)
- 새 프롬프트 + importance 점수 포함 재수집 필요

**재수집 절차:**
```bash
# 1. ES 초기화
venv/bin/python3 -c "from collectors.news_collector import reset_index; reset_index()"

# 2. 수집 (Guardian API, summarize=False)
venv/bin/python3 -c "from collectors.news_collector import collect; collect('2020-02-01','2020-04-30', summarize=False)"

# 3. 요약 + 제목번역 (Gemini, 하루 ~250건 처리 가능)
venv/bin/python3 -c "from collectors.news_collector import re_summarize_all; re_summarize_all()"
```

---

## 다음에 할 것

- [ ] 뉴스 재수집 실행 (1, 2단계: Guardian API, Gemini 쿼터 무관)
- [ ] 요약 재실행 (3단계: Gemini 쿼터 리셋 후, 하루 ~250건)
- [ ] PR 머지 → develop 반영 ✅ (오늘 완료)
- [ ] FOMC/CPI 캘린더 이벤트 수집 (market_event 테이블)
- [ ] 인프라 (docker-compose 정리, GitHub Actions CI/CD)
