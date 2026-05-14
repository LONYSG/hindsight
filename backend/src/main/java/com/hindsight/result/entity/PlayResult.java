package com.hindsight.result.entity;

import com.hindsight.play.entity.PlaySession;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "play_result")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PlayResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    private PlaySession session;

    private BigDecimal myReturn;
    private BigDecimal stockReturn;
    private BigDecimal nasdaqReturn;
    private BigDecimal sp500Return;
    private BigDecimal alpha;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Builder
    public PlayResult(PlaySession session, BigDecimal myReturn, BigDecimal stockReturn,
                      BigDecimal nasdaqReturn, BigDecimal sp500Return, BigDecimal alpha) {
        this.session = session;
        this.myReturn = myReturn;
        this.stockReturn = stockReturn;
        this.nasdaqReturn = nasdaqReturn;
        this.sp500Return = sp500Return;
        this.alpha = alpha;
        this.createdAt = LocalDateTime.now();
    }
}
