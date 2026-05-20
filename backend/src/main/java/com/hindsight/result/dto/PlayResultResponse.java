package com.hindsight.result.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record PlayResultResponse(
        Long sessionId,
        String playerName,
        LocalDate startDate,
        LocalDate endDate,
        BigDecimal seedMoney,
        BigDecimal finalValue,
        BigDecimal myReturn,
        BigDecimal nasdaqReturn,
        BigDecimal alpha,
        int tradeCount,
        BigDecimal mdd,
        BigDecimal cashRatioAvg,
        List<StockReturn> stockReturns
) {
    public record StockReturn(String ticker, BigDecimal returnRate) {}
}
