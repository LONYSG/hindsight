package com.hindsight.data.controller;

import com.hindsight.data.dto.CompanyResponse;
import com.hindsight.data.dto.NewsArticleResponse;
import com.hindsight.data.dto.PriceHistoryResponse;
import com.hindsight.data.dto.StartPointResponse;
import com.hindsight.data.repository.CompanyRepository;
import com.hindsight.data.repository.DailyPriceRepository;
import com.hindsight.data.repository.StartPointRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/data")
@RequiredArgsConstructor
public class DataController {

    private final StartPointRepository startPointRepository;
    private final CompanyRepository companyRepository;
    private final DailyPriceRepository dailyPriceRepository;
    private final RestTemplate restTemplate;

    @Value("${elasticsearch.host}") private String esHost;
    @Value("${elasticsearch.port}") private int esPort;
    @Value("${elasticsearch.index}") private String esIndex;

    @GetMapping("/start-points")
    public List<StartPointResponse> getStartPoints() {
        return startPointRepository.findAll().stream()
                .map(StartPointResponse::from)
                .toList();
    }

    @GetMapping("/companies")
    public List<CompanyResponse> getCompanies() {
        return companyRepository.findAll().stream()
                .map(CompanyResponse::from)
                .toList();
    }

    @GetMapping("/prices")
    public List<PriceHistoryResponse> getPriceHistory(
            @RequestParam Long companyId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return dailyPriceRepository
                .findByCompanyIdAndDateBetweenOrderByDateAsc(companyId, from, to)
                .stream()
                .map(PriceHistoryResponse::from)
                .toList();
    }

    // 해당 날짜 뉴스 조회 (Elasticsearch)
    // minImportance: 최소 중요도 (기본 3). importance 필드 없는 레거시 기사는 항상 포함.
    @GetMapping("/news")
    public List<NewsArticleResponse> getNews(
            @RequestParam String date,
            @RequestParam(defaultValue = "3") int minImportance
    ) {
        String url = "http://%s:%d/%s/_search".formatted(esHost, esPort, esIndex);

        // importance >= minImportance 이거나, importance 필드 자체가 없는 기사(레거시) 포함
        String body = """
                {
                  "query": {
                    "bool": {
                      "must": [{ "term": { "date": "%s" } }],
                      "should": [
                        { "range": { "importance": { "gte": %d } } },
                        { "bool": { "must_not": { "exists": { "field": "importance" } } } }
                      ],
                      "minimum_should_match": 1
                    }
                  },
                  "_source": ["title", "title_ko", "summary", "category", "source", "url", "date", "published_at", "importance"],
                  "size": 50,
                  "sort": [{ "importance": { "order": "desc", "missing": 3 } }, { "category": "asc" }]
                }
                """.formatted(date, minImportance);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        ResponseEntity<Map> resp = restTemplate.exchange(
                url, HttpMethod.POST, new HttpEntity<>(body, headers), Map.class);

        if (resp.getBody() == null) return List.of();

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> hits =
                (List<Map<String, Object>>) ((Map<?, ?>) resp.getBody().get("hits")).get("hits");

        return hits.stream()
                .map(hit -> {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> src = (Map<String, Object>) hit.get("_source");
                    Object imp = src.get("importance");
                    return new NewsArticleResponse(
                            (String) src.get("title"),
                            (String) src.get("title_ko"),
                            (String) src.get("summary"),
                            (String) src.get("category"),
                            (String) src.get("source"),
                            (String) src.get("url"),
                            (String) src.get("date"),
                            (String) src.get("published_at"),
                            imp != null ? ((Number) imp).intValue() : null
                    );
                })
                .toList();
    }
}
