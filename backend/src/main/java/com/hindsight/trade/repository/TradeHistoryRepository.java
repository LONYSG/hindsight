package com.hindsight.trade.repository;

import com.hindsight.trade.entity.TradeHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;

public interface TradeHistoryRepository extends JpaRepository<TradeHistory, Long> {

    // 특정 기업 보유 수량
    @Query("SELECT COALESCE(SUM(CASE WHEN t.action = 'BUY' THEN t.quantity ELSE -t.quantity END), 0) " +
           "FROM TradeHistory t WHERE t.session.id = :sessionId AND t.company.id = :companyId")
    int calculateHeldQuantity(@Param("sessionId") Long sessionId, @Param("companyId") Long companyId);

    // 특정 기업 전체 매수 총액 (평균 매입단가용)
    @Query("SELECT COALESCE(SUM(t.quantity * t.price), 0) FROM TradeHistory t " +
           "WHERE t.session.id = :sessionId AND t.company.id = :companyId AND t.action = 'BUY'")
    BigDecimal calculateTotalBuyCost(@Param("sessionId") Long sessionId, @Param("companyId") Long companyId);

    // 특정 기업 전체 매수 수량 (평균 매입단가용)
    @Query("SELECT COALESCE(SUM(t.quantity), 0) FROM TradeHistory t " +
           "WHERE t.session.id = :sessionId AND t.company.id = :companyId AND t.action = 'BUY'")
    int calculateTotalBuyQuantity(@Param("sessionId") Long sessionId, @Param("companyId") Long companyId);

    // 보유 중인 기업 ID 목록 (수량 > 0)
    @Query("SELECT DISTINCT t.company.id FROM TradeHistory t WHERE t.session.id = :sessionId " +
           "GROUP BY t.company.id " +
           "HAVING SUM(CASE WHEN t.action = 'BUY' THEN t.quantity ELSE -t.quantity END) > 0")
    List<Long> findHeldCompanyIds(@Param("sessionId") Long sessionId);

    // 총 거래 횟수
    long countBySessionId(Long sessionId);

    List<TradeHistory> findBySessionId(Long sessionId);

    void deleteBySessionId(Long sessionId);
}
