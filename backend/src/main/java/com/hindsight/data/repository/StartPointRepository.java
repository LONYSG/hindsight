package com.hindsight.data.repository;

import com.hindsight.data.entity.StartPoint;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StartPointRepository extends JpaRepository<StartPoint, Long> {
    List<StartPoint> findAllByOrderByIdAsc();
}
