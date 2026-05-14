package com.hindsight.play.repository;

import com.hindsight.play.entity.PortfolioSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PortfolioSnapshotRepository extends JpaRepository<PortfolioSnapshot, Long> {

    Optional<PortfolioSnapshot> findTopBySessionIdOrderByDateDesc(Long sessionId);
}
