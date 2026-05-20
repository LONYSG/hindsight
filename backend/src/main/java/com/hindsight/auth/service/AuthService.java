package com.hindsight.auth.service;

import com.hindsight.auth.dto.LoginRequest;
import com.hindsight.auth.dto.SignupRequest;
import com.hindsight.auth.dto.TokenResponse;
import com.hindsight.auth.entity.User;
import com.hindsight.auth.repository.UserRepository;
import com.hindsight.auth.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;
    private final RestTemplate restTemplate;

    @Value("${kakao.rest-api-key}")
    private String kakaoRestApiKey;

    @Value("${kakao.client-secret}")
    private String kakaoClientSecret;

    @Value("${kakao.redirect-uri}")
    private String kakaoRedirectUri;

    @Transactional
    public void signup(SignupRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            throw new IllegalArgumentException("이미 사용 중인 이메일입니다.");
        }
        userRepository.save(User.builder()
                .email(request.email())
                .passwordHash(passwordEncoder.encode(request.password()))
                .build());
    }

    public TokenResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new BadCredentialsException("이메일 또는 비밀번호가 올바르지 않습니다."));

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new BadCredentialsException("이메일 또는 비밀번호가 올바르지 않습니다.");
        }

        return new TokenResponse(tokenProvider.generateToken(user.getEmail()), user.getPasswordHash() != null);
    }

    @Transactional
    public TokenResponse kakaoLogin(String code) {
        String accessToken = fetchKakaoAccessToken(code);
        Map<String, Object> userInfo = fetchKakaoUserInfo(accessToken);

        Long kakaoId = ((Number) userInfo.get("id")).longValue();
        @SuppressWarnings("unchecked")
        Map<String, Object> kakaoAccount = (Map<String, Object>) userInfo.get("kakao_account");
        @SuppressWarnings("unchecked")
        Map<String, Object> properties = (Map<String, Object>) userInfo.get("properties");

        String email = kakaoAccount != null ? (String) kakaoAccount.get("email") : null;
        if (email == null) email = "kakao_" + kakaoId + "@hindsight.local";

        String nickname = properties != null ? (String) properties.get("nickname") : null;
        if (nickname == null) nickname = "투자자" + kakaoId % 10000;

        String finalEmail = email;
        String finalNickname = nickname;
        User user = userRepository.findByKakaoId(kakaoId)
                .orElseGet(() -> userRepository.save(User.ofKakao(kakaoId, finalEmail, finalNickname)));

        return new TokenResponse(tokenProvider.generateToken(user.getEmail()), user.getNickname() != null);
    }

    private String fetchKakaoAccessToken(String code) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
        params.add("grant_type", "authorization_code");
        params.add("client_id", kakaoRestApiKey);
        params.add("client_secret", kakaoClientSecret);
        params.add("redirect_uri", kakaoRedirectUri);
        params.add("code", code);

        try {
            ResponseEntity<Map> response = restTemplate.postForEntity(
                    "https://kauth.kakao.com/oauth/token",
                    new HttpEntity<>(params, headers),
                    Map.class
            );
            return (String) response.getBody().get("access_token");
        } catch (HttpClientErrorException e) {
            throw new IllegalArgumentException("카카오 인증 코드가 유효하지 않습니다: " + e.getResponseBodyAsString());
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> fetchKakaoUserInfo(String accessToken) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);

        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                    "https://kapi.kakao.com/v2/user/me",
                    HttpMethod.GET,
                    new HttpEntity<>(headers),
                    Map.class
            );
            return response.getBody();
        } catch (HttpClientErrorException e) {
            throw new IllegalArgumentException("카카오 사용자 정보 조회 실패: " + e.getResponseBodyAsString());
        }
    }
}
