package com.hindsight.data.dto;

import java.util.List;

public record NewsResponse(
        String prevTradingDay,
        List<NewsArticleResponse> articles
) {}
