package com.hindsight.trade.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record TradeRequest(
        @NotNull(message = "기업을 선택해주세요")
        Long companyId,

        @NotNull(message = "매매 방향을 선택해주세요")
        Action action,

        @NotNull(message = "수량을 입력해주세요")
        @Min(value = 1, message = "최소 1주 이상이어야 합니다")
        Integer quantity
) {
    public enum Action { BUY, SELL }
}
