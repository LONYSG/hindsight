package com.hindsight.auth.controller;

import com.hindsight.auth.dto.KakaoLoginRequest;
import com.hindsight.auth.dto.LoginRequest;
import com.hindsight.auth.dto.SignupRequest;
import com.hindsight.auth.dto.TokenResponse;
import com.hindsight.auth.entity.User;
import com.hindsight.auth.repository.UserRepository;
import com.hindsight.global.exception.ResourceNotFoundException;
import java.util.Map;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.transaction.annotation.Transactional;
import com.hindsight.auth.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final UserRepository userRepository;

    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    public void signup(@Valid @RequestBody SignupRequest request) {
        authService.signup(request);
    }

    @PostMapping("/login")
    public TokenResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @PostMapping("/kakao")
    public TokenResponse kakaoLogin(@RequestBody KakaoLoginRequest request) {
        return authService.kakaoLogin(request.code());
    }

    @GetMapping("/me")
    public Map<String, Object> getMe(@AuthenticationPrincipal UserDetails userDetails) {
        User user = userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new ResourceNotFoundException("사용자를 찾을 수 없습니다."));
        return Map.of(
                "email", user.getEmail(),
                "nickname", user.getNickname() != null ? user.getNickname() : ""
        );
    }

    @Transactional
    @PatchMapping("/me/nickname")
    public Map<String, String> updateNickname(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Map<String, String> body) {
        User user = userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new ResourceNotFoundException("사용자를 찾을 수 없습니다."));
        String nickname = body.get("nickname");
        if (nickname == null || nickname.isBlank()) throw new IllegalArgumentException("닉네임을 입력해주세요.");
        if (nickname.length() > 20) throw new IllegalArgumentException("닉네임은 20자 이내로 입력해주세요.");
        user.updateNickname(nickname.trim());
        return Map.of("nickname", user.getNickname());
    }
}
