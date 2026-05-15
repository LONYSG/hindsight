package com.hindsight.news.entity;

import com.hindsight.play.entity.PlaySession;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "news_view")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class NewsView {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    private PlaySession session;

    @Column(name = "news_es_id", nullable = false)
    private String newsEsId;

    @Column(name = "viewed_at", nullable = false)
    private LocalDateTime viewedAt;

    @Builder
    public NewsView(PlaySession session, String newsEsId) {
        this.session = session;
        this.newsEsId = newsEsId;
        this.viewedAt = LocalDateTime.now();
    }
}
