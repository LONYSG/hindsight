package com.hindsight.data.controller;

import com.hindsight.data.dto.CompanyResponse;
import com.hindsight.data.dto.PriceHistoryResponse;
import com.hindsight.data.dto.StartPointResponse;
import com.hindsight.data.repository.CompanyRepository;
import com.hindsight.data.repository.DailyPriceRepository;
import com.hindsight.data.repository.StartPointRepository;
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

    // 차트용 주가 히스토리 (시뮬 시작일 ~ 현재 날짜)
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
}
