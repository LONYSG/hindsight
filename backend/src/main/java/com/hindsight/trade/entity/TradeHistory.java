package com.hindsight.trade.entity;

import com.hindsight.data.entity.Company;
import com.hindsight.play.entity.PlaySession;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "trade_history")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class TradeHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    private PlaySession session;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "company_id", nullable = false)
    private Company company;

    @Column(nullable = false)
    private LocalDate date;

    @Column(nullable = false, length = 10)
    private String action; // BUY | SELL

    @Column(nullable = false)
    private Integer quantity;

    @Column(nullable = false)
    private BigDecimal price;

    private BigDecimal ratio;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Builder
    public TradeHistory(PlaySession session, Company company, LocalDate date,
                        String action, Integer quantity, BigDecimal price, BigDecimal ratio) {
        this.session = session;
        this.company = company;
        this.date = date;
        this.action = action;
        this.quantity = quantity;
        this.price = price;
        this.ratio = ratio;
        this.createdAt = LocalDateTime.now();
    }
}
