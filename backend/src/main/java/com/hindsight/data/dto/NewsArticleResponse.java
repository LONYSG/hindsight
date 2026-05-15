package com.hindsight.data.dto;

import java.util.List;

public record NewsArticleResponse(
        String id,          // ES _id (news_view 이벤트 기록용)
        String title,       // 영문 원제
        String titleKo,     // 한국어 제목
        String summary,
        String category,
        String source,
        String url,
        String date,
        String publishedAt,
        Integer importance, // 당시 투자자 중요도 1~5
        List<String> themes // 투자 테마 태그
) {}
