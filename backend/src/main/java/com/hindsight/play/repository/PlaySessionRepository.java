package com.hindsight.play.repository;

import com.hindsight.play.entity.PlaySession;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PlaySessionRepository extends JpaRepository<PlaySession, Long> {

    List<PlaySession> findByUserIdOrderByCreatedAtDesc(Long userId);
}
