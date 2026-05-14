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
            BigDecimal cash,           // 예수금
            int stockQuantity,         // 보유 수량
            BigDecimal avgBuyPrice,    // 평균 매입단가
            BigDecimal bookValue,      // 매입금액 (평균단가 × 보유수량)
            BigDecimal stockValue,     // 주식 평가금액 (현재가 × 보유수량)
            BigDecimal unrealizedPnl,  // 평가손익 (평가금액 - 매입금액)
            BigDecimal unrealizedRate, // 평가수익률
            BigDecimal totalValue,     // 총평가금액 (예수금 + 주식평가금액)
            BigDecimal returnRate      // 총수익률 (시드 대비)
    ) {}

    public record EventInfo(
            String eventType,
            String summary
    ) {}
}
