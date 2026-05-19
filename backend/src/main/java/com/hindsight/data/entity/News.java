package com.hindsight.data.entity;

import jakarta.persistence.*;
import lombok.Getter;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "news")
@Getter
public class News {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "es_id")
    private String esId;

    private String title;

    @Column(name = "title_ko")
    private String titleKo;

    private String brief;

    @Column(columnDefinition = "TEXT")
    private String summary;

    @Column(columnDefinition = "TEXT")
    private String body;

    private String category;

    @Column(name = "source_type")
    private String sourceType;

    @Column(columnDefinition = "text[]")
    private String[] tickers;

    private String source;
    private String url;
    private LocalDate date;

    @Column(name = "published_at", nullable = false)
    private Instant publishedAt;

    private Integer importance;

    @Column(columnDefinition = "text[]")
    private String[] themes;
}
