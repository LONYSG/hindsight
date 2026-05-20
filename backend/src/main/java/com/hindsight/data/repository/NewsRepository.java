package com.hindsight.data.repository;

import com.hindsight.data.entity.News;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface NewsRepository extends JpaRepository<News, Long> {

    List<News> findByEsIdIn(List<String> esIds);

    @Query("""
        SELECT n FROM News n
        WHERE n.publishedAt > :from AND n.publishedAt <= :to
          AND (n.importance IS NULL OR n.importance >= :minImportance)
        ORDER BY n.publishedAt ASC
        """)
    List<News> findByPublishedAtRange(
            @Param("from") Instant from,
            @Param("to") Instant to,
            @Param("minImportance") int minImportance,
            Pageable pageable
    );
}
