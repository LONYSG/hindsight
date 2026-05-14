package com.hindsight.play.repository;

import com.hindsight.play.entity.PortfolioSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Optional;

public interface PortfolioSnapshotRepository extends JpaRepository<PortfolioSnapshot, Long> {

    Optional<PortfolioSnapshot> findTopBySessionIdOrderByDateDesc(Long sessionId);

    // 같은 날 매수/매도 시 기존 스냅샷 교체
    @Modifying
    @Query("DELETE FROM PortfolioSnapshot p WHERE p.session.id = :sessionId AND p.date = :date")
    void deleteBySessionIdAndDate(@Param("sessionId") Long sessionId, @Param("date") LocalDate date);
}
