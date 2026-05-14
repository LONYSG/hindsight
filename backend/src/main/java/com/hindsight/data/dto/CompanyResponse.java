package com.hindsight.data.dto;

import com.hindsight.data.entity.Company;

public record CompanyResponse(
        Long id,
        String ticker,
        String name,
        String exchange
) {
    public static CompanyResponse from(Company c) {
        return new CompanyResponse(c.getId(), c.getTicker(), c.getName(), c.getExchange());
    }
}
