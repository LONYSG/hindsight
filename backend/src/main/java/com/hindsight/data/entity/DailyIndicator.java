package com.hindsight.data.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "daily_indicator")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class DailyIndicator {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "company_id", nullable = false)
    private Company company;

    @Column(nullable = false)
    private LocalDate date;

    private BigDecimal rsi;
    private BigDecimal macd;

    @Column(name = "macd_signal")
    private BigDecimal macdSignal;

    @Column(name = "macd_histogram")
    private BigDecimal macdHistogram;

    @Column(name = "ichimoku_tenkan")
    private BigDecimal ichimokuTenkan;

    @Column(name = "ichimoku_kijun")
    private BigDecimal ichimokuKijun;

    @Column(name = "ichimoku_senkou_a")
    private BigDecimal ichimokuSenkouA;

    @Column(name = "ichimoku_senkou_b")
    private BigDecimal ichimokuSenkouB;
}
