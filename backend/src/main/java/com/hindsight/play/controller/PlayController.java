package com.hindsight.play.controller;

import com.hindsight.play.dto.NextRequest;
import com.hindsight.play.dto.SessionStateResponse;
import com.hindsight.play.dto.StartSessionRequest;
import com.hindsight.play.service.PlayService;
import com.hindsight.trade.dto.TradeRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/play/sessions")
@RequiredArgsConstructor
public class PlayController {

    private final PlayService playService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SessionStateResponse startSession(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody StartSessionRequest request
    ) {
        return playService.startSession(userDetails.getUsername(), request);
    }

    @GetMapping("/{sessionId}/state")
    public SessionStateResponse getState(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long sessionId
    ) {
        return playService.getState(userDetails.getUsername(), sessionId);
    }

    @PostMapping("/{sessionId}/next")
    public SessionStateResponse next(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long sessionId,
            @Valid @RequestBody NextRequest request
    ) {
        return playService.next(userDetails.getUsername(), sessionId, request);
    }

    @PostMapping("/{sessionId}/trade")
    public SessionStateResponse trade(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long sessionId,
            @Valid @RequestBody TradeRequest request
    ) {
        return playService.trade(userDetails.getUsername(), sessionId, request);
    }
}
