package com.hindsight.data.dto;

import com.hindsight.data.entity.StartPoint;

import java.time.LocalDate;

public record StartPointResponse(
        Long id,
        String name,
        String description,
        LocalDate startDate
) {
    public static StartPointResponse from(StartPoint sp) {
        return new StartPointResponse(sp.getId(), sp.getName(), sp.getDescription(), sp.getStartDate());
    }
}
