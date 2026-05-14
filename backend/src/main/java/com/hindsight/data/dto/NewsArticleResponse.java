package com.hindsight.data.dto;

public record NewsArticleResponse(
        String title,       // 영문 원제
        String titleKo,     // 한국어 제목 (재요약 후 채워짐)
        String summary,
        String category,
        String source,
        String url,
        String date,
        String publishedAt,
        Integer importance  // 당시 투자자 중요도 1~5 (재수집 후 채워짐)
) {}
