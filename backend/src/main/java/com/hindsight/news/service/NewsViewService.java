package com.hindsight.news.service;

import com.hindsight.data.entity.News;
import com.hindsight.data.repository.NewsRepository;
import com.hindsight.global.exception.ResourceNotFoundException;
import com.hindsight.news.dto.NewsViewThemeSummaryResponse;
import com.hindsight.news.dto.NewsViewThemeSummaryResponse.ThemeCount;
import com.hindsight.news.entity.NewsView;
import com.hindsight.news.repository.NewsViewRepository;
import com.hindsight.play.entity.PlaySession;
import com.hindsight.play.repository.PlaySessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class NewsViewService {

    private final NewsViewRepository newsViewRepository;
    private final PlaySessionRepository playSessionRepository;
    private final NewsRepository newsRepository;

    @Transactional
    public void record(Long sessionId, String newsEsId) {
        PlaySession session = playSessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("세션을 찾을 수 없습니다."));
        newsViewRepository.save(NewsView.builder()
                .session(session)
                .newsEsId(newsEsId)
                .build());
    }

    @Transactional(readOnly = true)
    public NewsViewThemeSummaryResponse getThemeSummary(Long sessionId) {
        List<String> esIds = newsViewRepository.findNewsEsIdsBySessionId(sessionId);
        if (esIds.isEmpty()) return new NewsViewThemeSummaryResponse(List.of());

        List<News> newsList = newsRepository.findByEsIdIn(esIds);

        Map<String, Integer> counts = new LinkedHashMap<>();
        for (News news : newsList) {
            if (news.getThemes() == null) continue;
            for (String theme : news.getThemes()) {
                if (!"OTHER".equals(theme)) counts.merge(theme, 1, Integer::sum);
            }
        }

        List<ThemeCount> result = counts.entrySet().stream()
                .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
                .limit(5)
                .map(e -> new ThemeCount(e.getKey(), e.getValue()))
                .collect(Collectors.toList());

        return new NewsViewThemeSummaryResponse(result);
    }
}
