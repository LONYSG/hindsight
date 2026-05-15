package com.hindsight.data.dto;

import java.math.BigDecimal;

public record IndicatorResponse(
        String date,
        BigDecimal rsi,
        BigDecimal macd,
        BigDecimal macdSignal,
        BigDecimal macdHistogram
) {}
