"""
데이터 파이프라인 환경 설정.

원칙:
- 필수 값(API 키)은 os.environ["..."] 으로 읽어 미설정 시 즉시 실패하도록 한다.
- 선택값은 os.getenv("...", default) 으로 읽는다.
"""
import os
from dotenv import load_dotenv

load_dotenv()

# ─── 외부 API ─────────────────────────────────────────────────
# Tiingo (주가, 무료, adjusted 가격, 전체 기간 제공)
TIINGO_API_KEY        = os.environ["TIINGO_API_KEY"]

# FRED (거시지표 - 기준금리/국채/달러인덱스/VIX/WTI 등)
FRED_API_KEY          = os.environ["FRED_API_KEY"]

# The Guardian (글로벌 거시 뉴스)
GUARDIAN_API_KEY      = os.environ["GUARDIAN_API_KEY"]

# Alpha Vantage (ticker 기반 기업 뉴스, NEWS_SENTIMENT API, 25 req/day)
ALPHA_VANTAGE_API_KEY = os.environ["ALPHA_VANTAGE_API_KEY"]

# Google Gemini (헤드라인 선별 + 한국어 번역/요약/themes 태깅, 무료 1,500 req/day)
GEMINI_API_KEY        = os.environ["GEMINI_API_KEY"]
GEMINI_MODEL          = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite")

# ─── PostgreSQL (Supabase Session Pooler) ─────────────────────
# 모든 데이터(주가/지표/뉴스/플레이/이벤트)를 PostgreSQL 단일 DB로 통합 운영한다.
# 로컬 Docker DB는 사용하지 않는다 — 2026-05 Supabase 단일화 결정.
POSTGRES_HOST     = os.environ["POSTGRES_HOST"]
POSTGRES_PORT     = int(os.getenv("POSTGRES_PORT", "5432"))
POSTGRES_DB       = os.getenv("POSTGRES_DB", "postgres")
POSTGRES_USER     = os.environ["POSTGRES_USER"]
POSTGRES_PASSWORD = os.environ["POSTGRES_PASSWORD"]
