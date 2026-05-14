package com.hindsight.trade.repository;

import com.hindsight.trade.entity.TradeHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TradeHistoryRepository extends JpaRepository<TradeHistory, Long> {

    // 현재 보유 수량: BUY 합산 - SELL 합산
    @Query("SELECT COALESCE(SUM(CASE WHEN t.action = 'BUY' THEN t.quantity ELSE -t.quantity END), 0) " +
           "FROM TradeHistory t WHERE t.session.id = :sessionId")
    int calculateHeldQuantity(@Param("sessionId") Long sessionId);

    // 평균 매입단가 계산용: 전체 매수 총액
    @Query("SELECT COALESCE(SUM(t.quantity * t.price), 0) FROM TradeHistory t " +
           "WHERE t.session.id = :sessionId AND t.action = 'BUY'")
    java.math.BigDecimal calculateTotalBuyCost(@Param("sessionId") Long sessionId);

    // 평균 매입단가 계산용: 전체 매수 수량
    @Query("SELECT COALESCE(SUM(t.quantity), 0) FROM TradeHistory t " +
           "WHERE t.session.id = :sessionId AND t.action = 'BUY'")
    int calculateTotalBuyQuantity(@Param("sessionId") Long sessionId);
}
