package com.hindsight.news.controller;

import com.hindsight.news.dto.NewsViewRequest;
import com.hindsight.news.dto.NewsViewThemeSummaryResponse;
import com.hindsight.news.service.NewsViewService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/play/sessions/{sessionId}/news-view")
@RequiredArgsConstructor
public class NewsViewController {

    private final NewsViewService newsViewService;

    @PostMapping
    public ResponseEntity<Void> record(
            @PathVariable Long sessionId,
            @RequestBody NewsViewRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {

        newsViewService.record(sessionId, request.newsEsId());
        return ResponseEntity.ok().build();
    }

    @GetMapping("/themes")
    public ResponseEntity<NewsViewThemeSummaryResponse> getThemeSummary(
            @PathVariable Long sessionId,
            @AuthenticationPrincipal UserDetails userDetails) {

        return ResponseEntity.ok(newsViewService.getThemeSummary(sessionId));
    }
}
