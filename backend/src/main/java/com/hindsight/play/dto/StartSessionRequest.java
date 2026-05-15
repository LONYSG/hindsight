package com.hindsight.play.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

public record StartSessionRequest(
        @NotNull(message = "시작점을 선택해주세요")
        Long startPointId,

        @NotNull(message = "시드머니를 입력해주세요")
        @Positive(message = "시드머니는 0보다 커야 합니다")
        BigDecimal seedMoney
) {}
