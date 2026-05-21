package com.hindsight.data.repository;

import com.hindsight.data.entity.DailyMacro;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface DailyMacroRepository extends JpaRepository<DailyMacro, Long> {

    Optional<DailyMacro> findByDate(LocalDate date);

    Optional<DailyMacro> findFirstByDateGreaterThanEqualOrderByDateAsc(LocalDate date);

    List<DailyMacro> findByDateBetweenOrderByDateAsc(LocalDate from, LocalDate to);
}
