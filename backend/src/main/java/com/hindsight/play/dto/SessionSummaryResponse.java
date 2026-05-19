package com.hindsight.play.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record SessionSummaryResponse(
        Long sessionId,
        String startPointName,
        LocalDate startDate,
        BigDecimal seedMoney,
        LocalDate simDate,
        String status,
        LocalDateTime createdAt,
        BigDecimal returnRate
) {}
