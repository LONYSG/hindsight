package com.hindsight.play.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record SessionStateResponse(
        Long sessionId,
        LocalDate simDate,
        List<HoldingInfo> holdings,   // 보유 종목별 현황
        PortfolioInfo portfolio,       // 포트폴리오 총합
        List<EventInfo> events
) {
    // 보유 종목별 현황 (보유 수량 > 0인 기업만)
    public record HoldingInfo(
            Long companyId,
            String ticker,
            String name,
            BigDecimal currentPrice,
            BigDecimal changeRate,
            int quantity,
            BigDecimal avgBuyPrice,
            BigDecimal bookValue,
            BigDecimal stockValue,
            BigDecimal unrealizedPnl,
            BigDecimal unrealizedRate
    ) {}

    // 포트폴리오 총합
    public record PortfolioInfo(
            BigDecimal cash,
            BigDecimal totalStockValue,
            BigDecimal totalValue,
            BigDecimal returnRate
    ) {}

    public record EventInfo(
            String eventType,
            String summary
    ) {}
}
