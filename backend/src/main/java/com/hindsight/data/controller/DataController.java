package com.hindsight.data.controller;

import com.hindsight.data.dto.CompanyResponse;
import com.hindsight.data.dto.IndicatorResponse;
import com.hindsight.data.dto.NewsArticleResponse;
import com.hindsight.data.dto.NewsResponse;
import com.hindsight.data.dto.PriceHistoryResponse;
import com.hindsight.data.dto.StartPointResponse;
import com.hindsight.data.repository.CompanyRepository;
import com.hindsight.data.repository.DailyIndicatorRepository;
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
    private final DailyIndicatorRepository dailyIndicatorRepository;
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

    @GetMapping("/indicators")
    public List<IndicatorResponse> getIndicators(
            @RequestParam Long companyId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return dailyIndicatorRepository
                .findByCompanyIdAndDateBetweenOrderByDateAsc(companyId, from, to)
                .stream()
                .map(i -> new IndicatorResponse(
                        i.getDate().toString(),
                        i.getRsi(), i.getMacd(), i.getMacdSignal(), i.getMacdHistogram(),
                        i.getIchimokuTenkan(), i.getIchimokuKijun(),
                        i.getIchimokuSenkouA(), i.getIchimokuSenkouB()
                ))
                .toList();
    }

    // 거래 캘린더 기준 기업 ID (NVDA)
    private static final Long TRADING_CALENDAR_COMPANY_ID = 2L;

    /**
     * 미국 시장 마감 시각 (UTC) — DST 반영
     * EST (UTC-5): 11월 첫째 일요일 ~ 3월 둘째 일요일 → 21:00 UTC
     * EDT (UTC-4): 3월 둘째 일요일 ~ 11월 첫째 일요일 → 20:00 UTC
     * 반일개장(early close)은 드물고 불규칙해 별도 캘린더 없이 처리 불가 → 미지원
     */
    private static String marketCloseUtc(LocalDate date) {
        return isEDT(date) ? "T20:00:00Z" : "T21:00:00Z";
    }

    private static boolean isEDT(LocalDate date) {
        int year = date.getYear();
        LocalDate dstStart = nthSundayOfMonth(year, 3, 2); // 3월 둘째 일요일
        LocalDate dstEnd   = nthSundayOfMonth(year, 11, 1); // 11월 첫째 일요일
        return !date.isBefore(dstStart) && date.isBefore(dstEnd);
    }

    private static LocalDate nthSundayOfMonth(int year, int month, int n) {
        LocalDate first = LocalDate.of(year, month, 1);
        int dow = first.getDayOfWeek().getValue(); // 1=Mon … 7=Sun
        int daysToFirstSunday = (dow == 7) ? 0 : (7 - dow);
        return first.plusDays(daysToFirstSunday + (long)(n - 1) * 7);
    }

    // 해당 날짜 뉴스 조회 (Elasticsearch)
    // - published_at 범위 기반: (전 거래일 장마감 UTC, 당일 장마감 UTC]
    // - 장후 뉴스 look-ahead bias 방지 + 주말/공휴일 뉴스 자동 이월
    // - DST 반영: EDT 기간(3월둘째일~11월첫째일)은 20:00 UTC, 나머지 21:00 UTC
    // - 정렬: published_at ASC (시간 순, 고정)
    @GetMapping("/news")
    public NewsResponse getNews(
            @RequestParam String date,
            @RequestParam(defaultValue = "3") int minImportance
    ) {
        LocalDate simDate = LocalDate.parse(date);

        // 전 거래일 조회 (주말/공휴일 스킵)
        LocalDate prevTradingDay = dailyPriceRepository
                .findFirstByCompanyIdAndDateLessThanOrderByDateDesc(TRADING_CALENDAR_COMPANY_ID, simDate)
                .map(com.hindsight.data.entity.DailyPrice::getDate)
                .orElse(simDate.minusDays(1));

        // published_at 범위: (전 거래일 장마감 UTC, 당일 장마감 UTC] — DST 반영
        String fromTs = prevTradingDay + marketCloseUtc(prevTradingDay);
        String toTs   = simDate        + marketCloseUtc(simDate);

        String url = "http://%s:%d/%s/_search".formatted(esHost, esPort, esIndex);

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
                  "_source": ["title", "title_ko", "summary", "category", "source", "url", "date", "published_at", "importance", "themes"],
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
                    List<String> themes = (List<String>) src.get("themes");
                    return new NewsArticleResponse(
                            (String) hit.get("_id"),
                            (String) src.get("title"),
                            (String) src.get("title_ko"),
                            (String) src.get("summary"),
                            (String) src.get("category"),
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
