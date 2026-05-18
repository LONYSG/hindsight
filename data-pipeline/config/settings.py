import os
from dotenv import load_dotenv

load_dotenv()

# FRED API
FRED_API_KEY = os.environ["FRED_API_KEY"]

# Tiingo API (주가 데이터 - 무료, adjusted 포함, 전체 기간)
TIINGO_API_KEY = os.environ["TIINGO_API_KEY"]

# Gemini API
GEMINI_API_KEY = os.environ["GEMINI_API_KEY"]
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite")

# PostgreSQL
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "localhost")
POSTGRES_PORT = int(os.getenv("POSTGRES_PORT", "5432"))
POSTGRES_DB = os.getenv("POSTGRES_DB", "hindsight")
POSTGRES_USER = os.getenv("POSTGRES_USER", "hindsight")
POSTGRES_PASSWORD = os.environ["POSTGRES_PASSWORD"]

# Elasticsearch
ELASTICSEARCH_HOST = os.getenv("ELASTICSEARCH_HOST", "localhost")
ELASTICSEARCH_PORT = int(os.getenv("ELASTICSEARCH_PORT", "9200"))

# Kafka
KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")

# The Guardian API
GUARDIAN_API_KEY = os.environ["GUARDIAN_API_KEY"]

# Finnhub API (ticker 기반 기업 뉴스)
FINNHUB_API_KEY = os.getenv("FINNHUB_API_KEY", "")

# Alpha Vantage API (ticker 기반 기업 뉴스 + 감성 분석)
ALPHA_VANTAGE_API_KEY = os.getenv("ALPHA_VANTAGE_API_KEY", "")

# NYT API
NYT_API_KEY = os.environ["NYT_API_KEY"]

# Google Cloud / BigQuery (GDELT 뉴스 수집)
GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID", "hindsight-496200")
GCP_KEY_PATH = os.getenv("GCP_KEY_PATH", "gcp-key.json")
