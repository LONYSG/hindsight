package com.hindsight.play.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "portfolio_snapshot")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PortfolioSnapshot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    private PlaySession session;

    @Column(nullable = false)
    private LocalDate date;

    @Column(nullable = false)
    private BigDecimal cash;

    @Column(nullable = false)
    private BigDecimal stockValue;

    @Column(nullable = false)
    private BigDecimal totalValue;

    @Builder
    public PortfolioSnapshot(PlaySession session, LocalDate date, BigDecimal cash, BigDecimal stockValue) {
        this.session = session;
        this.date = date;
        this.cash = cash;
        this.stockValue = stockValue;
        this.totalValue = cash.add(stockValue);
    }
}
