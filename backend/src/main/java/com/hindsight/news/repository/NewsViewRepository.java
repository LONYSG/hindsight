package com.hindsight.news.repository;

import com.hindsight.news.entity.NewsView;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface NewsViewRepository extends JpaRepository<NewsView, Long> {

    @Query("SELECT n.newsEsId FROM NewsView n WHERE n.session.id = :sessionId")
    List<String> findNewsEsIdsBySessionId(@Param("sessionId") Long sessionId);
}
