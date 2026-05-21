package com.hindsight.data.dto;

import com.hindsight.data.entity.Company;
import com.hindsight.data.entity.DailyPrice;

import java.math.BigDecimal;
import java.util.List;

public record EtfSummaryResponse(
        String ticker,
        String name,
        BigDecimal currentClose,
        BigDecimal prevClose,
        List<PricePoint> history
) {
    public record PricePoint(String date, BigDecimal close) {}

    public static EtfSummaryResponse from(Company c, List<DailyPrice> prices) {
        BigDecimal curr = prices.isEmpty() ? null : prices.get(prices.size() - 1).getClose();
        BigDecimal prev = prices.size() < 2 ? null : prices.get(prices.size() - 2).getClose();
        List<PricePoint> history = prices.stream()
                .map(p -> new PricePoint(p.getDate().toString(), p.getClose()))
                .toList();
        return new EtfSummaryResponse(c.getTicker(), c.getName(), curr, prev, history);
    }
}
