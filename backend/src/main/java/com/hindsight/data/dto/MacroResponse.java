package com.hindsight.data.dto;

import com.hindsight.data.entity.DailyMacro;

import java.math.BigDecimal;

public record MacroResponse(
        String date,
        BigDecimal sp500,
        BigDecimal nasdaq,
        BigDecimal fedRate,
        BigDecimal us10yYield,
        BigDecimal us2yYield,
        BigDecimal usdKrw,
        BigDecimal dxy,
        BigDecimal vix,
        BigDecimal wtiOil,
        BigDecimal gold,
        BigDecimal btc
) {
    public static MacroResponse from(DailyMacro m) {
        return new MacroResponse(
                m.getDate().toString(),
                m.getSp500(),
                m.getNasdaq(),
                m.getFedRate(),
                m.getUs10yYield(),
                m.getUs2yYield(),
                m.getUsdKrw(),
                m.getDxy(),
                m.getVix(),
                m.getWtiOil(),
                m.getGold(),
                m.getBtc()
        );
    }
}
