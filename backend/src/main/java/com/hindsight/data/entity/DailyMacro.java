package com.hindsight.data.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "daily_macro")
@Getter
@NoArgsConstructor
public class DailyMacro {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private LocalDate date;

    private BigDecimal fedRate;
    private BigDecimal us10yYield;
    private BigDecimal usdKrw;
    private BigDecimal sp500;
    private BigDecimal nasdaq;
}
