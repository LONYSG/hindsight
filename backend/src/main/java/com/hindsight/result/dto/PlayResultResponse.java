package com.hindsight.result.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record PlayResultResponse(
        Long sessionId,
        LocalDate startDate,
        LocalDate endDate,
        BigDecimal seedMoney,
        BigDecimal finalValue,
        BigDecimal myReturn,       // 내 수익률
        BigDecimal stockReturn,    // NVDA 수익률
        BigDecimal sp500Return,    // S&P500 수익률
        BigDecimal nasdaqReturn,   // NASDAQ 수익률
        BigDecimal alpha,          // 알파 (내 수익률 - S&P500)
        int tradeCount             // 총 거래 횟수
) {}
