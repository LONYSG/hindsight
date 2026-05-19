package com.hindsight.data.service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;

// 미국 시장 마감 시각 계산 (DST 반영)
// EDT (UTC-4): 3월 둘째 일요일 ~ 11월 첫째 일요일 → 20:00 UTC
// EST (UTC-5): 나머지                              → 21:00 UTC
class MarketCloseUtil {

    static Instant marketClose(LocalDate date) {
        int hour = isEDT(date) ? 20 : 21;
        return date.atTime(LocalTime.of(hour, 0)).toInstant(ZoneOffset.UTC);
    }

    private static boolean isEDT(LocalDate date) {
        int year = date.getYear();
        LocalDate dstStart = nthSundayOfMonth(year, 3, 2);
        LocalDate dstEnd   = nthSundayOfMonth(year, 11, 1);
        return !date.isBefore(dstStart) && date.isBefore(dstEnd);
    }

    private static LocalDate nthSundayOfMonth(int year, int month, int n) {
        LocalDate first = LocalDate.of(year, month, 1);
        int dow = first.getDayOfWeek().getValue(); // 1=Mon … 7=Sun
        int daysToFirstSunday = (dow == 7) ? 0 : (7 - dow);
        return first.plusDays(daysToFirstSunday + (long)(n - 1) * 7);
    }
}
