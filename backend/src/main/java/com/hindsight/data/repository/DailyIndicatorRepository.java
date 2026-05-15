package com.hindsight.data.repository;

import com.hindsight.data.entity.DailyIndicator;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface DailyIndicatorRepository extends JpaRepository<DailyIndicator, Long> {
    List<DailyIndicator> findByCompanyIdAndDateBetweenOrderByDateAsc(Long companyId, LocalDate from, LocalDate to);
}
