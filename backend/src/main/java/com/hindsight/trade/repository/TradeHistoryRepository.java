package com.hindsight.trade.repository;

import com.hindsight.trade.entity.TradeHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TradeHistoryRepository extends JpaRepository<TradeHistory, Long> {

    // BUY는 더하고 SELL은 빼서 현재 보유 수량 계산
    @Query("SELECT COALESCE(SUM(CASE WHEN t.action = 'BUY' THEN t.quantity ELSE -t.quantity END), 0) " +
           "FROM TradeHistory t WHERE t.session.id = :sessionId")
    int calculateHeldQuantity(@Param("sessionId") Long sessionId);
}
