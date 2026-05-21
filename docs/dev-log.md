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

---

## 2026-05-15

### 23. 전체 UI 라이트모드 전환

**한 것:**
LoginPage, SetupPage, PlayPage, ResultPage 및 모든 탭(PriceTab, PortfolioTab, NewsTab, OrderBottomSheet)의 다크모드 → 라이트모드 전환.

**색상 팔레트:**
- 배경: `#f5f6f8` (페이지), `#ffffff` (카드/패널)
- 테두리: `#e8eaed` / `#e5e7eb`
- 텍스트 주요: `#111827`, 보조: `#6b7280`, 음소거: `#9ca3af`
- 가격 상승(빨강): `#f43f5e`, 하락(파랑): `#3b82f6` — 한국 MTS 관례 유지

**차트(lightweight-charts) 라이트 테마:**
`layout.background.color: '#ffffff'`, grid `#f3f4f6`, crosshair `#d1d5db`

**강조색 변경:**
초록 강조(`#4ade80` / `#000`) → `#16a34a` / `#fff`. 밝은 배경 위에서 가독성 확보.

---

### 24. PlayPage 헤더 전면 재설계

**변경 전:**
- "시뮬레이션 날짜" 라벨 + 날짜 두 줄 표시
- 이벤트 배지 다수가 헤더에 직접 노출 → 공간 낭비 + 정보 과다
- "종 료" 버튼 텍스트 세로 줄바꿈 (whiteSpace 미지정)

**변경 후:**
- 날짜 한 줄 형식: `2020.02.15 (토)` (요일 자동 계산)
- 🔔 종 아이콘 + 빨간 배지(이벤트 수) → 클릭 시 드롭다운 패널
- 이벤트 설명 구체화: `NVDA 주가급변`, `NVDA 거래량급증`, `FOMC 금리 결정`, `NVDA Q4 실적발표`
  - `EventInfo`에 `companyTicker` 필드 추가 (백엔드)
- 종료 버튼: `whiteSpace: nowrap` + `flexShrink: 0`

**탭 잔상 버그 수정:**
비활성 탭 `tabBtn`에 `borderBottom: '2px solid transparent'` 명시.
React 인라인 스타일에서 `border: none` shorthand가 이전에 명시 설정된 `borderBottom`을 완전히 덮어쓰지 못하는 브라우저 동작 때문이었음.

---

### 25. PriceTab % 계산 버그 수정

**문제:**
PRICE_SPIKE는 "전일 종가 대비 당일 종가 ±3% 이상"으로 감지하는데, 차트 헤더의 % 표시는 `(close - open) / open` (당일 시가 대비)을 쓰고 있었음.
예: 71.05 → 73.52면 전일 대비 3.47%인데 화면엔 1.43%로 표시.

**수정:**
`prevClose` state 추가. 데이터 로드 시 마지막 캔들 직전 캔들의 close를 저장.
변동률 = `(today.close - prevClose) / prevClose`. 전일 데이터가 없으면 당일 open 기준 폴백.

---

### 26. 차트 줌 레벨 유지

**문제:**
날짜 점프할 때마다 `fitContent()` 호출 → 줌이 리셋됨.

**수정:**
`prevSelectedId` ref 추가. 종목 변경 시에만 `fitContent()`, 날짜 점프 시에는 `scrollToRealTime()` 사용.
줌(visible bar 수) 유지 + 최신 캔들로 자동 스크롤.

---

### 27. 바텀시트 주문창 maxWidth 수정

**문제:**
OrderBottomSheet의 `maxWidth: 760`이 App.jsx 셸(`maxWidth: 480`)보다 커서 PC 넓은 화면에서 양쪽 삐져나옴.

**원인:**
`position: fixed`는 viewport 기준으로 위치하므로 부모 셸의 maxWidth 제약을 받지 않음.

**수정:** `maxWidth: 760` → `maxWidth: 480`. `left: '50%'` + `transform: 'translateX(-50%)'`로 셸과 완벽 정렬.

---

### 28. 뉴스 시스템 전면 개선

**핵심 문제: look-ahead bias**
장후(after-hours) 뉴스가 당일에 그대로 노출되면 투자자가 "미래 정보"를 보고 매매하는 부정행위 가능.

**해결: published_at 범위 기반 쿼리**

```
노출 범위: (전 거래일 장마감 UTC, 당일 장마감 UTC]
```

`date` 필드 기반 쿼리 → `published_at` 범위 쿼리로 완전 교체.
- 장후 뉴스 당일 노출 차단
- 주말/공휴일 뉴스 다음 거래일 자동 이월
- `DailyPriceRepository.findFirstByCompanyIdAndDateLessThanOrderByDateDesc()`로 전 거래일 조회

**DST(서머타임) 반영:**
미국 DST는 2007년부터 고정: 3월 둘째 일요일 ~ 11월 첫째 일요일 = EDT(UTC-4), 장마감 20:00 UTC.
나머지 = EST(UTC-5), 장마감 21:00 UTC.
`nthSundayOfMonth()` 헬퍼로 연도별 정확한 DST 전환일 계산. 백엔드 + 프론트 모두 적용.

**반일 개장(early close):** 추수감사절 다음날 등 불규칙한 날. 별도 캘린더 없이는 처리 불가 → 미지원 명시.

**정렬 변경:**
`importance DESC` → `published_at ASC` (시간순 고정).
같은 날짜 안에서도 시간 흐름대로 표시 → 정정 보도가 올바른 위치에 노출.

**날짜 구분선 추가:**
기사들을 `date` 필드로 그룹핑, 각 그룹에 날짜 구분선 표시.
- `simDate`: 배지 없음 (오늘)
- 토요일: `토요일` 배지 (노란색)
- 일요일: `일요일` 배지 (노란색)
- 평일 비거래일(공휴일): `공휴일` 배지 (핑크색)
- 이전 거래일: `전일 장후` 배지 (파란색) — `prevTradingDay` 백엔드에서 전달

**장전/장중/장후 배지:**
오늘(simDate) 기사에만 표시. 비거래일(주말/공휴일) 기사에는 표시 안 함.

**NewsResponse DTO 신설:**
`{ prevTradingDay: string, articles: [...] }` 구조. 프론트가 `prevTradingDay`를 알아야 "전일 장후" vs "공휴일"을 정확히 구분 가능.

**중요도 필터 버튼:**
기존 "약한 신호 보기" 토글 → 4단계 필터 버튼으로 교체.
`전체 / ★★★ 이상(기본) / ★★★★ 이상 / ★★★★★만`

**summary 프롬프트 개선:**
"일반 문단 형태" → "의미 전환 시에만 `\n\n` 문단 분리". 다음 `re_summarize_all()` 실행 시 적용.
프론트 파싱도 `split('\n')` → `split(/\n\s*\n/)` 로 변경.

**금요일 장후 뉴스 부재:**
Guardian은 영국 매체라 UTC 오전~오후(한국/영국 업무시간)에만 발행. 미국 장마감(21:00 UTC = 오후 4시 EST) 이후 기사가 없음. 데이터 특성상 정상.

---

---

## 2026-05-18

### 29. 뉴스 시스템 2계층 구조 전환

**한 것:**
뉴스를 Guardian(글로벌 거시) + Alpha Vantage(기업 전용) 2계층으로 분리.

- `company_news_collector.py` 신규 작성 (Alpha Vantage NEWS_SENTIMENT API)
- M7 기업 뉴스 155건 수집 (2020년 2월)
- ES 매핑에 `source_type`, `tickers` 필드 추가
- NewsTab 서브탭 분리: 🌎 시장 / 📈 기업 (ticker chip 필터 포함)

**왜 이렇게 했나:**
Guardian은 UK 매체라 M7 기업 뉴스 밀도가 낮음. 주제 분포 확인 시 AI: 2건, SEMICONDUCTOR: 0건 수준. Guardian은 거시/지정학에 특화하고, 기업 뉴스는 ticker 기반 소스를 별도로 추가하는 게 맞음. 유저 입장에서 "시장 전체 흐름"과 "내 보유 종목 이슈"는 다른 맥락으로 소비하기 때문에 UI도 탭으로 분리.

---

### 30. 뉴스 프롬프트 전면 개선

**한 것:**
`_SELECTION_PROMPT`: importance → relevance 개념 전환
- 기준: "시장 충격도" → "당시 투자자가 참고할 이유가 있는가"
- hindsight bias 방어 문구 추가: "향후 주가 상승 예측이 아닙니다"

`_SUMMARY_PROMPT`: brief 필드 추가
- brief: 1문장 팩트 중심 요약 (카드 collapsed preview용)
- summary 첫 문장 압축 규칙 추가

`re_score_all()` 신규 추가: 날짜별 importance 재점수화 (Gemini 1회/일)
`re_summarize_all()` 개선: brief 없는 건만 처리 → 중단 후 재실행 시 이어서 가능

---

### 31. 결과 화면 고도화

**한 것:**
- 제목 "게임 결과" → "투자 결과 리포트"
- M7 종목별 수익률 비교 추가 (백엔드 calcStockReturns)
- 알파 기준 S&P500 → NASDAQ으로 변경
- 0 기준 발산 바 차트 (양수 오른쪽, 음수 왼쪽)
- 투자 성향 뱃지 추가 (안정 추구형, 현금 방어형 등)
- 로딩 스피너 추가 + error 상태 분리

---

### 32. M7 주가/데이터 확장

**한 것:**
- AAPL/MSFT/GOOGL/AMZN/META/TSLA 주가 2020-12-31까지 확장 (각 191건)
- 이벤트 감지 확장 (TSLA 89건 등 총 252건)
- 거시지표(daily_macro)는 이미 2026년까지 있어 문제없음

---

### 33. 주요 버그 수정

**MDD 계산 오류:**
날짜 점프 시 최종 날짜 스냅샷만 저장하던 문제. 1달 점프 시 중간 낙폭이 기록 안 됨.
→ 점프 구간 모든 거래일 스냅샷 저장으로 수정 (PlayService.next)

**버튼 테두리 잔상:**
React 인라인 스타일에서 `border` shorthand + `borderColor` longhand 혼용 시 deselect 때 브라우저 기본값(검정)으로 fallback.
→ borderWidth/borderStyle/borderColor 분리 + 항상 명시적으로 값 지정

**100% 매수 후 잔액 부족 플래시:**
체결 직후 cash 감소 → maxBuy=0 → 경고 메시지 순간 표시.
→ 체결 성공 msg 있을 때 경고 억제

---

---

## 2026-05-21

### 34. GitHub Actions 뉴스 수집 자동화

**한 것:**
`.github/workflows/collect_news.yml` 작성. 매일 09:05 KST(00:05 UTC)에 자동 실행.

**설계 결정:**

`collection_state.json` 파일로 진행 상태를 추적한다.
```json
{"next_month": "2020-06", "end_month": "2021-10"}
```
워크플로우가 끝날 때마다 `next_month`를 3개월 앞으로 업데이트하고 자동 커밋.
다음 날 실행 시 이어서 진행 → 사람이 개입 없이 2년치 데이터를 일주일에 걸쳐 자동 수집.

**Alpha Vantage 한도 최대 활용:**
무료 플랜: 하루 25 req. M7(7개 티커) × 3개월 = 21 req/회차. 1회 실행에 3달치가 딱 맞음.
요약(Gemini)은 별도 단계로 분리해서 수집과 요약 비용/실패가 독립됨.

**`workflow_dispatch` vs `schedule` 분기:**
수동 실행 시 입력값(start/end 기간)을 직접 지정하고, `collection_state.json`을 업데이트하지 않음.
자동 실행 시에만 state 파일 갱신 + 커밋.

**Python 버전 이슈:**
`pandas-ta==0.4.71b0`이 Python 3.12를 요구한다는 걸 Actions 실패 후 발견.
`python-version: '3.12'`로 고정하고 `pandas>=2.3.2`로 하한 변경.

---

### 35. GitHub Actions Oracle ARM 재시도 자동화

**한 것:**
`.github/workflows/oracle_retry.yml` 작성. 6시간마다 ARM 인스턴스 생성을 재시도.

**배경:**
OCI Always Free ARM 인스턴스는 용량 부족 시 즉시 실패한다. 직접 스크립트를 돌려두는 방법은 PC를 켜놔야 하고, EC2 등 유료 서버를 쓰면 본말전도. GitHub Actions의 6시간 스케줄로 무료 재시도가 가능.

**기술적 문제들:**

*OCI private key 처리:*
PEM 파일에는 줄바꿈이 있어 GitHub Secret에 그대로 넣으면 손상된다.
해결: `base64` 인코딩으로 단일 줄로 변환해 Secret 저장 → Actions에서 `base64 -d`로 복원.
```bash
echo "$OCI_PRIVATE_KEY" | base64 -d > ~/.oci/oci_api_key.pem
```

*YAML heredoc 충돌:*
Python 멀티라인 문자열을 `run:` 블록 안 heredoc으로 쓰면 YAML 들여쓰기와 충돌.
해결: `echo` 문장으로 한 줄씩 OCI config 작성.

*`bash -e`와 oci capacity error:*
OCI CLI가 용량 부족 시 non-zero exit 코드 반환 → `bash -e`가 워크플로우 전체 종료.
해결: `|| true` 추가로 실패해도 계속 진행.

*기존 인스턴스 체크:*
이미 RUNNING 상태 인스턴스가 있으면 생성 시도 없이 종료. `oci compute instance list`로 상태 확인.

**timeout: 350min:**
GitHub Actions 기본 timeout 6h인데, cron 간격도 6h라서 겹칠 수 있음.
350분(~5.8h)으로 설정해 다음 실행 전에 반드시 종료되게.

---

### 36. FOMC/CPI/실적발표 캘린더 이벤트 수집

**한 것:**
`data-pipeline/collectors/calendar_collector.py` 신규 작성.

**이벤트 유형별 처리:**

| 유형 | 건수 | company_id |
|------|------|-----------|
| FOMC | 40건 (2020-2024, 연 8회) | NULL |
| CPI | 56건 (2020-2024, 월별) | NULL |
| EARNINGS | M7 기업별 ~20분기 | 기업 ticker 조회 |

FOMC/CPI는 특정 기업과 무관한 거시 이벤트 → `company_id = NULL`. DB 스키마 설계 시 이미 이를 고려해 nullable로 만들었음.

**이벤트 요약 텍스트:**
- FOMC: `연준 기준금리: 0.25% (동결/인상/인하)` 패턴
- CPI: `CPI 발표 — 예정` (실제 발표값은 수집 당시 미래라 미지정)
- EARNINGS: 실적 발표 예정 텍스트

**백엔드 EventInfo 확장:**
`companyTicker` 필드 추가 → 이벤트 드롭다운에 `NVDA 주가급변`, `NVDA Q4 실적발표` 등 구체적 표시.

---

### 37. daily_macro 거시지표 확장

**한 것:**
`daily_macro` 테이블에 6개 컬럼 추가. 백엔드 엔티티/DTO/API 연동.

| 필드 | 소스 | 설명 |
|------|------|------|
| `dxy` | FRED (DTWEXBGS) | 달러 인덱스 |
| `vix` | FRED (VIXCLS) | 시장 공포지수 |
| `wti_oil` | FRED (DCOILWTICO) | WTI 원유 $/배럴 |
| `gold` | yfinance (GC=F) | 금 현물 $/온스 |
| `btc` | yfinance (BTC-USD) | 비트코인 USD |
| `us_2y_yield` | FRED (DGS2) | 미국 2년물 국채 금리 |

**Gold 소스 문제:**
처음에 FRED `GOLDAMGBD228NLBM` 사용 시도 → 해당 시리즈 없음. yfinance `GC=F`(금 선물)로 전환. 선물이라 현물 대비 소폭 차이 있지만 방향성은 동일해 문제없음.

**Supabase 마이그레이션:**
로컬 Docker에는 Flyway가 자동으로 V4 마이그레이션을 실행하지만, Supabase는 별도 적용 필요.
`collect_macro.yml` 워크플로우에 마이그레이션 스텝 추가 → 컬럼 생성 후 데이터 수집.

---

### 38. 섹터 ETF 시스템 추가

**한 것:**
SOXX, XLK, XLE, XLF, XLV, XLI, XLY 7개 섹터 ETF를 시스템에 추가.

**설계 결정:**

*ETF는 거래 불가, 지표로만 표시:*
처음엔 M7 종목과 동일한 종목 선택 칩에 ETF를 넣었다가 제거. ETF는 매수/매도 대상이 아닌 "섹터 흐름을 읽는 지표"로만 사용. MacroSheet의 "섹터 ETF" 섹션으로 이동.

*company 테이블에 INSERT:*
`daily_price`가 `company_id` FK를 쓰는 구조라, 가격 저장을 위해서는 company 테이블 등록이 필요. `V4__add_market_indicators.sql`에 ETF 7개 INSERT 포함.

*DataController에서 제외:*
`/api/data/companies` 엔드포인트에서 ETF를 거르는 필터 추가.
`/api/data/etf-summary` 엔드포인트 신설: from~to 기간의 ETF 가격 이력 + currentClose/prevClose 반환.

---

### 39. MacroTicker 컴포넌트 — CSS 무한 스크롤 띠

**한 것:**
PriceTab 상단에 시장 지표를 자동으로 흐르는 띠로 표시. hover/touch 시 일시정지.

**핵심 기술 문제: 끊김 없는 무한 루프**

아이템 목록을 2번 렌더링 후 `-50% translateX` 애니메이션으로 루프:
```
[아이템 1~N] [아이템 1~N(복사본)]
                 ↑ translateX(-50%) 도달 시 원점 복귀
```

핵심 트릭은 `.ticker-track`에 `width: max-content`. 이게 없으면 flex 컨테이너가 viewport 너비로 축소되고, `translateX(-50%)`가 viewport의 절반만큼 이동 → 루프 지점에서 점프가 발생.

**버그 발견:** `animation-play-state: paused` 후 재개 시 처음부터 다시 시작되는 문제.
원인: `onMouseLeave` 시 `paused` class 제거 → CSS 애니메이션 재시작.
해결: `className`을 React state로 관리 + CSS에서 `.paused` 상태를 `animation-play-state: paused`로 제어.
(`animation` shorthand 재선언이 아닌 `animation-play-state`만 변경해야 현재 위치 유지.)

**금리 vs 가격 변화량 표시:**
FED 금리가 1%→2%이면 "▲100%"가 아니라 "+1.00%p"가 맞다.
`isRate: true` 플래그로 분기: 금리는 절대차(%p), 가격은 상대%(%).
변화 없음(flat): `—` (회색) — 특히 FEDFUNDS는 월 데이터라 일간 변화가 0인 날이 많음.

---

### 40. MacroSheet 컴포넌트 — 바텀시트 상세 보기

**한 것:**
MacroTicker의 `≡` 버튼 클릭 시 하단에서 슬라이드업되는 시트.
거시 지표 + 섹터 ETF 목록 → 클릭 시 lightweight-charts LineSeries 차트.

**설계:**
- `maxHeight: 65vh` — 화면 하단 고정, 너무 크면 콘텐츠가 가려짐
- 차트 고도: 260px 고정 (autoSize로 하면 부모 flex 높이 계산이 꼬임)
- 차트가 열려있는 동안 목록이 동시에 안 보이도록 selected state로 분기

**ETF 색상 / 설명 하드코딩:**
SOXX→#6366f1(인디고), XLK→#3b82f6(파랑) 등 8개 색상. 섹터마다 직관적 색상 부여.

---

### 41. 한국 MTS 색상 통일

**문제:**
lightweight-charts 기본 상승=초록, 하락=빨강이고, MacroSheet/MacroTicker는 반대(빨강=상승)를 쓰고 있었음. 같은 화면에 초록/빨강이 혼재.

**결정:**
`upColor: '#f43f5e'` (빨강), `downColor: '#3b82f6'` (파랑) — 한국 증권사 MTS 표준.
캔들 차트, 등락률 배지, MacroTicker 변동 색상 전부 통일.

*종목 선택 칩 테두리:*
기존에 upColor(`#f43f5e`)를 선택 강조색으로 재사용 → 색이 공유되어 혼란.
선택 강조 전용 색상 `#22c55e`(초록)으로 분리.

---

### 42. 드래그 스크롤 구현

**한 것:**
종목 선택 칩 영역(가로 스크롤)에 마우스 드래그로 스크롤 가능하도록 `dragHandlers()` 유틸 추가.

**구현:**
```javascript
const dragHandlers = (ref) => ({
  onMouseDown: e => { isDragging=true; startX=e.pageX; scrollLeft=ref.current.scrollLeft },
  onMouseMove: e => { if(!isDragging) return; ref.current.scrollLeft = scrollLeft - (e.pageX - startX) },
  onMouseUp/onMouseLeave: () => isDragging=false
})
```

`onWheel`: `e.preventDefault()` + `ref.scrollLeft += e.deltaY` — 세로 휠을 가로 스크롤로 변환.

**주의:** `onWheel`에 `{ passive: false }` 옵션이 필요한데 React에서는 `addEventListener`로 별도 등록 필요 없이 `onWheel` 핸들러에서 `preventDefault()`만 해도 동작.

---

## 다음에 할 것

- [ ] 뉴스 재처리 완료 (`re_summarize_all()`) — 2020년 6월~ 수집분
- [ ] Guardian 뉴스 자동 수집 진행 중 (2020-06~, 매일 3달치 자동)
- [ ] M7 기업 뉴스 자동 수집 진행 중 (Alpha Vantage, 매일 3달치)
- [ ] Oracle ARM 인스턴스 대기 중 (GitHub Actions 6h 주기 재시도)
- [ ] Oracle 확보 후: Docker 환경 설정, Spring Boot Render → OCI 이전
- [ ] 투자 성향 분석 고도화 (보유 기간, 손절/익절 패턴)
- [ ] 전문가 비교 (버핏 등 하드코딩, 결과 화면 추가)
- [ ] 인프라 (docker-compose 정리, GitHub Actions CI/CD)
