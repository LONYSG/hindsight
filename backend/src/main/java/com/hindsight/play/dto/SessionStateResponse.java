package com.hindsight.play.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record SessionStateResponse(
        Long sessionId,
        LocalDate simDate,
        PriceInfo price,
        PortfolioInfo portfolio,
        List<EventInfo> events
) {
    public record PriceInfo(
            BigDecimal open,
            BigDecimal high,
            BigDecimal low,
            BigDecimal close,
            long volume,
            BigDecimal changeRate  // 전일 종가 대비 변동률 (소수, 예: 0.025 = +2.5%)
    ) {}

    public record PortfolioInfo(
            BigDecimal cash,
            int stockQuantity,
            BigDecimal stockValue,
            BigDecimal totalValue,
            BigDecimal returnRate  // 시드머니 대비 수익률
    ) {}

    public record EventInfo(
            String eventType,
            String summary
    ) {}
}
