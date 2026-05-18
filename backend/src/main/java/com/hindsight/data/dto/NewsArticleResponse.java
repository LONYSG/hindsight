package com.hindsight.data.dto;

import java.util.List;

public record NewsArticleResponse(
        String id,
        String title,
        String titleKo,
        String brief,          // 한 줄 핵심 요약 (카드 collapsed 상태 preview)
        String summary,
        String category,
        String sourceType,     // "company" | null (Guardian = null)
        List<String> tickers,  // 관련 종목 ["NVDA"] — company 뉴스만
        String source,
        String url,
        String date,
        String publishedAt,
        Integer importance,
        List<String> themes
) {}
