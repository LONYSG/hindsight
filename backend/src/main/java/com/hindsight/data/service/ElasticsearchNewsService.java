package com.hindsight.data.service;

import com.hindsight.data.dto.NewsArticleResponse;
import com.hindsight.data.dto.NewsResponse;
import com.hindsight.data.repository.DailyPriceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Service
@Profile("elasticsearch")
@RequiredArgsConstructor
public class ElasticsearchNewsService implements NewsSearchService {

    private static final Long TRADING_CALENDAR_COMPANY_ID = 2L;

    private final DailyPriceRepository dailyPriceRepository;
    private final RestTemplate restTemplate;

    @Value("${elasticsearch.host}") private String esHost;
    @Value("${elasticsearch.port}") private int esPort;
    @Value("${elasticsearch.index}") private String esIndex;

    @Override
    public NewsResponse search(LocalDate simDate, int minImportance) {
        LocalDate prevTradingDay = dailyPriceRepository
                .findFirstByCompanyIdAndDateLessThanOrderByDateDesc(TRADING_CALENDAR_COMPANY_ID, simDate)
                .map(p -> p.getDate())
                .orElse(simDate.minusDays(1));

        String fromTs = MarketCloseUtil.marketClose(prevTradingDay).toString();
        String toTs   = MarketCloseUtil.marketClose(simDate).toString();

        String url  = "http://%s:%d/%s/_search".formatted(esHost, esPort, esIndex);
        String body = """
                {
                  "query": {
                    "bool": {
                      "must": [
                        { "range": { "published_at": { "gt": "%s", "lte": "%s" } } }
                      ],
                      "should": [
                        { "range": { "importance": { "gte": %d } } },
                        { "bool": { "must_not": { "exists": { "field": "importance" } } } }
                      ],
                      "minimum_should_match": 1
                    }
                  },
                  "_source": ["title","title_ko","brief","summary","category","source_type","tickers","source","url","date","published_at","importance","themes"],
                  "size": 150,
                  "sort": [{ "published_at": { "order": "asc" } }]
                }
                """.formatted(fromTs, toTs, minImportance);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        ResponseEntity<Map> resp = restTemplate.exchange(
                url, HttpMethod.POST, new HttpEntity<>(body, headers), Map.class);

        if (resp.getBody() == null) return new NewsResponse(prevTradingDay.toString(), List.of());

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> hits =
                (List<Map<String, Object>>) ((Map<?, ?>) resp.getBody().get("hits")).get("hits");

        List<NewsArticleResponse> articles = hits.stream()
                .map(hit -> {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> src = (Map<String, Object>) hit.get("_source");
                    Object imp = src.get("importance");
                    @SuppressWarnings("unchecked")
                    List<String> themes  = (List<String>) src.get("themes");
                    @SuppressWarnings("unchecked")
                    List<String> tickers = (List<String>) src.get("tickers");
                    return new NewsArticleResponse(
                            (String) hit.get("_id"),
                            (String) src.get("title"),
                            (String) src.get("title_ko"),
                            (String) src.get("brief"),
                            (String) src.get("summary"),
                            (String) src.get("category"),
                            (String) src.get("source_type"),
                            tickers != null ? tickers : List.of(),
                            (String) src.get("source"),
                            (String) src.get("url"),
                            (String) src.get("date"),
                            (String) src.get("published_at"),
                            imp != null ? ((Number) imp).intValue() : null,
                            themes != null ? themes : List.of()
                    );
                })
                .toList();

        return new NewsResponse(prevTradingDay.toString(), articles);
    }

}
