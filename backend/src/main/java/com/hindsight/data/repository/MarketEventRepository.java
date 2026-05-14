package com.hindsight.data.repository;

import com.hindsight.data.entity.MarketEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface MarketEventRepository extends JpaRepository<MarketEvent, Long> {

    // 특정 날짜의 기업 이벤트(PRICE_SPIKE 등) + 매크로 이벤트(FOMC 등, company IS NULL) 함께 조회
    @Query("SELECT e FROM MarketEvent e WHERE e.date = :date AND (e.company.id = :companyId OR e.company IS NULL)")
    List<MarketEvent> findByDateAndCompany(@Param("date") LocalDate date, @Param("companyId") Long companyId);
}
