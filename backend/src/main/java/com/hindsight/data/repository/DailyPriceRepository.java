package com.hindsight.data.repository;

import com.hindsight.data.entity.DailyPrice;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Optional;

public interface DailyPriceRepository extends JpaRepository<DailyPrice, Long> {

    Optional<DailyPrice> findByCompanyIdAndDate(Long companyId, LocalDate date);

    // 해당 날짜 이후 첫 번째 거래일 (주말/공휴일 스킵용)
    Optional<DailyPrice> findFirstByCompanyIdAndDateGreaterThanEqualOrderByDateAsc(Long companyId, LocalDate date);

    // 해당 날짜 이전 마지막 거래일 (전일 종가 계산용)
    Optional<DailyPrice> findFirstByCompanyIdAndDateLessThanOrderByDateDesc(Long companyId, LocalDate date);
}
