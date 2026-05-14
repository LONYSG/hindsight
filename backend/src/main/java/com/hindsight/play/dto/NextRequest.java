package com.hindsight.play.dto;

import jakarta.validation.constraints.NotNull;

public record NextRequest(
        @NotNull(message = "날짜 이동 단위를 선택해주세요")
        JumpType jumpType
) {
    public enum JumpType {
        NEXT_DAY, WEEK, MONTH, THREE_MONTHS
    }
}
