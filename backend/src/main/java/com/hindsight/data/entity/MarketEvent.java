package com.hindsight.data.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Entity
@Table(name = "market_event")
@Getter
@NoArgsConstructor
public class MarketEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // company_id nullable: null이면 FOMC/CPI 등 매크로 이벤트
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "company_id")
    private Company company;

    @Column(nullable = false)
    private LocalDate date;

    @Column(nullable = false, length = 20)
    private String eventType;

    private String summary;
}
