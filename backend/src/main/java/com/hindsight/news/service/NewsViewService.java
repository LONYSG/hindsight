package com.hindsight.news.service;

import com.hindsight.global.exception.ResourceNotFoundException;
import com.hindsight.news.dto.NewsViewThemeSummaryResponse;
import com.hindsight.news.dto.NewsViewThemeSummaryResponse.ThemeCount;
import com.hindsight.news.entity.NewsView;
import com.hindsight.news.repository.NewsViewRepository;
import com.hindsight.play.entity.PlaySession;
import com.hindsight.play.repository.PlaySessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class NewsViewService {

    private final NewsViewRepository newsViewRepository;
    private final PlaySessionRepository playSessionRepository;
    private final RestTemplate restTemplate;

    @Value("${elasticsearch.host}") private String esHost;
    @Value("${elasticsearch.port}") private int esPort;
    @Value("${elasticsearch.index}") private String esIndex;

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

        // ES _mget으로 열람한 기사들의 themes 일괄 조회
        String url = "http://%s:%d/%s/_mget".formatted(esHost, esPort, esIndex);
        String body = """
                {"ids": %s}
                """.formatted(toJsonArray(esIds));

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        try {
            ResponseEntity<Map> resp = restTemplate.exchange(
                    url, HttpMethod.POST, new HttpEntity<>(body, headers), Map.class);

            if (resp.getBody() == null) return new NewsViewThemeSummaryResponse(List.of());

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> docs = (List<Map<String, Object>>) resp.getBody().get("docs");

            // theme별 카운트 집계
            Map<String, Integer> counts = new LinkedHashMap<>();
            for (Map<String, Object> doc : docs) {
                Boolean found = (Boolean) doc.get("found");
                if (found == null || !found) continue;
                @SuppressWarnings("unchecked")
                Map<String, Object> source = (Map<String, Object>) doc.get("_source");
                if (source == null) continue;
                @SuppressWarnings("unchecked")
                List<String> themes = (List<String>) source.get("themes");
                if (themes == null) continue;
                for (String t : themes) {
                    if (!"OTHER".equals(t)) counts.merge(t, 1, Integer::sum);
                }
            }

            // 카운트 내림차순 정렬, 상위 5개
            List<ThemeCount> result = counts.entrySet().stream()
                    .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
                    .limit(5)
                    .map(e -> new ThemeCount(e.getKey(), e.getValue()))
                    .collect(Collectors.toList());

            return new NewsViewThemeSummaryResponse(result);

        } catch (Exception e) {
            return new NewsViewThemeSummaryResponse(List.of());
        }
    }

    private String toJsonArray(List<String> ids) {
        return ids.stream()
                .map(id -> "\"" + id + "\"")
                .collect(Collectors.joining(",", "[", "]"));
    }
}
