package com.hindsight.result.controller;

import com.hindsight.result.dto.PlayResultResponse;
import com.hindsight.result.service.ResultService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/play/sessions")
@RequiredArgsConstructor
public class ResultController {

    private final ResultService resultService;

    @PostMapping("/{sessionId}/end")
    public PlayResultResponse endSession(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long sessionId
    ) {
        return resultService.endSession(userDetails.getUsername(), sessionId);
    }

    @GetMapping("/{sessionId}/result")
    public PlayResultResponse getResult(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long sessionId
    ) {
        return resultService.getResult(userDetails.getUsername(), sessionId);
    }
}
