package com.hindsight.result.repository;

import com.hindsight.result.entity.PlayResult;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PlayResultRepository extends JpaRepository<PlayResult, Long> {

    Optional<PlayResult> findBySessionId(Long sessionId);

    void deleteBySessionId(Long sessionId);
}
