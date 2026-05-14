package com.hindsight.play.entity;

import com.hindsight.data.entity.Company;
import com.hindsight.data.entity.StartPoint;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "play_session")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PlaySession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // auth.User와 도메인 간 결합 방지 — FK는 DB가 보장, JPA 관계 미설정
    @Column(name = "user_id", nullable = false)
    private Long userId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "start_point_id", nullable = false)
    private StartPoint startPoint;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "company_id", nullable = false)
    private Company company;

    @Column(nullable = false)
    private BigDecimal seedMoney;

    @Column(nullable = false)
    private LocalDate simDate;

    @Column(nullable = false, length = 20)
    private String status;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @Builder
    public PlaySession(Long userId, StartPoint startPoint, Company company, BigDecimal seedMoney) {
        this.userId = userId;
        this.startPoint = startPoint;
        this.company = company;
        this.seedMoney = seedMoney;
        this.simDate = startPoint.getStartDate();
        this.status = "IN_PROGRESS";
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    public void advanceDate(LocalDate newDate) {
        this.simDate = newDate;
        this.updatedAt = LocalDateTime.now();
    }
}
