package com.hindsight.data.dto;

public record NewsArticleResponse(
        String title,
        String summary,
        String category,
        String source,
        String url,
        String date
) {}
