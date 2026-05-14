package com.hindsight.data.dto;

import com.hindsight.data.entity.DailyPrice;

import java.math.BigDecimal;
import java.time.LocalDate;

public record PriceHistoryResponse(
        LocalDate date,
        BigDecimal open,
        BigDecimal high,
        BigDecimal low,
        BigDecimal close,
        Long volume
) {
    public static PriceHistoryResponse from(DailyPrice p) {
        return new PriceHistoryResponse(p.getDate(), p.getOpen(), p.getHigh(), p.getLow(), p.getClose(), p.getVolume());
    }
}
