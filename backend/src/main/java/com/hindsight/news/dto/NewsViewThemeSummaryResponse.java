package com.hindsight.news.dto;

import java.util.List;

public record NewsViewThemeSummaryResponse(List<ThemeCount> themes) {
    public record ThemeCount(String theme, int count) {}
}
