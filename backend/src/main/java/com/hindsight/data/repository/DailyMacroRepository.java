package com.hindsight.data.repository;

import com.hindsight.data.entity.DailyMacro;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Optional;

public interface DailyMacroRepository extends JpaRepository<DailyMacro, Long> {

    Optional<DailyMacro> findByDate(LocalDate date);

    // 해당 날짜 이후 첫 번째 데이터 (주말/공휴일 스킵)
    Optional<DailyMacro> findFirstByDateGreaterThanEqualOrderByDateAsc(LocalDate date);
}
