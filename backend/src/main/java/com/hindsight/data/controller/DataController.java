package com.hindsight.data.controller;

import com.hindsight.data.dto.CompanyResponse;
import com.hindsight.data.dto.EtfSummaryResponse;
import com.hindsight.data.dto.IndicatorResponse;
import com.hindsight.data.dto.MacroResponse;
import com.hindsight.data.dto.NewsResponse;
import com.hindsight.data.dto.PriceHistoryResponse;
import com.hindsight.data.dto.StartPointResponse;
import com.hindsight.data.repository.CompanyRepository;
import com.hindsight.data.repository.DailyIndicatorRepository;
import com.hindsight.data.repository.DailyMacroRepository;
import com.hindsight.data.repository.DailyPriceRepository;
import com.hindsight.data.repository.StartPointRepository;
import com.hindsight.data.service.NewsSearchService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/data")
@RequiredArgsConstructor
public class DataController {

    private final StartPointRepository startPointRepository;
    private final CompanyRepository companyRepository;
    private final DailyPriceRepository dailyPriceRepository;
    private final DailyIndicatorRepository dailyIndicatorRepository;
    private final DailyMacroRepository dailyMacroRepository;
    private final NewsSearchService newsSearchService;

    @GetMapping("/start-points")
    public List<StartPointResponse> getStartPoints() {
        return startPointRepository.findAllByOrderByIdAsc().stream()
                .map(StartPointResponse::from)
                .toList();
    }

    private static final java.util.Set<String> ETF_TICKERS = java.util.Set.of(
            "SOXX", "XLK", "XLE", "XLF", "XLV", "XLI", "XLY"
    );

    @GetMapping("/companies")
    public List<CompanyResponse> getCompanies() {
        return companyRepository.findAll().stream()
                .filter(c -> !ETF_TICKERS.contains(c.getTicker()))
                .map(CompanyResponse::from)
                .toList();
    }

    @GetMapping("/etf-summary")
    public List<EtfSummaryResponse> getEtfSummary(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return companyRepository.findAll().stream()
                .filter(c -> ETF_TICKERS.contains(c.getTicker()))
                .map(c -> EtfSummaryResponse.from(c,
                        dailyPriceRepository.findByCompanyIdAndDateBetweenOrderByDateAsc(c.getId(), from, to)))
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

    @GetMapping("/macro")
    public List<MacroResponse> getMacro(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return dailyMacroRepository.findByDateBetweenOrderByDateAsc(from, to)
                .stream()
                .map(MacroResponse::from)
                .toList();
    }

    @GetMapping("/news")
    public NewsResponse getNews(
            @RequestParam String date,
            @RequestParam(defaultValue = "3") int minImportance
    ) {
        return newsSearchService.search(LocalDate.parse(date), minImportance);
    }
}
