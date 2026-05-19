package com.hindsight.data.service;

import com.hindsight.data.dto.NewsArticleResponse;
import com.hindsight.data.dto.NewsResponse;
import com.hindsight.data.repository.DailyPriceRepository;
import com.hindsight.data.repository.NewsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;

@Service
@Profile("postgres")
@RequiredArgsConstructor
public class PostgresNewsService implements NewsSearchService {

    private static final Long TRADING_CALENDAR_COMPANY_ID = 2L;

    private final NewsRepository newsRepository;
    private final DailyPriceRepository dailyPriceRepository;

    @Override
    @Transactional(readOnly = true)
    public NewsResponse search(LocalDate simDate, int minImportance) {
        LocalDate prevTradingDay = dailyPriceRepository
                .findFirstByCompanyIdAndDateLessThanOrderByDateDesc(TRADING_CALENDAR_COMPANY_ID, simDate)
                .map(p -> p.getDate())
                .orElse(simDate.minusDays(1));

        Instant from = MarketCloseUtil.marketClose(prevTradingDay);
        Instant to   = MarketCloseUtil.marketClose(simDate);

        List<NewsArticleResponse> articles = newsRepository
                .findByPublishedAtRange(from, to, minImportance, PageRequest.of(0, 150))
                .stream()
                .map(n -> new NewsArticleResponse(
                        n.getEsId() != null ? n.getEsId() : String.valueOf(n.getId()),
                        n.getTitle(),
                        n.getTitleKo(),
                        n.getBrief(),
                        n.getSummary(),
                        n.getCategory(),
                        n.getSourceType(),
                        n.getTickers() != null ? Arrays.asList(n.getTickers()) : List.of(),
                        n.getSource(),
                        n.getUrl(),
                        n.getDate() != null ? n.getDate().toString() : null,
                        n.getPublishedAt().toString(),
                        n.getImportance(),
                        n.getThemes() != null ? Arrays.asList(n.getThemes()) : List.of()
                ))
                .toList();

        return new NewsResponse(prevTradingDay.toString(), articles);
    }
}
