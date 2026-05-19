package com.hindsight.data.service;

import com.hindsight.data.dto.NewsResponse;

import java.time.LocalDate;

public interface NewsSearchService {
    NewsResponse search(LocalDate simDate, int minImportance);
}
