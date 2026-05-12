import psycopg
from contextlib import contextmanager
from config import settings


@contextmanager
def get_connection():
    """
    PostgreSQL 연결을 context manager로 제공한다.
    with 블록 정상 종료 시 commit, 예외 발생 시 rollback 후 연결을 닫는다.
    psycopg2 대신 psycopg(v3)를 사용한다.
    """
    conn = psycopg.connect(
        host=settings.POSTGRES_HOST,
        port=settings.POSTGRES_PORT,
        dbname=settings.POSTGRES_DB,
        user=settings.POSTGRES_USER,
        password=settings.POSTGRES_PASSWORD
    )
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
