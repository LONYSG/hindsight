package com.hindsight.auth.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "\"user\"")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column
    private String passwordHash;

    @Column(unique = true)
    private Long kakaoId;

    @Column(length = 100)
    private String nickname;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Builder
    public User(String email, String passwordHash) {
        this.email = email;
        this.passwordHash = passwordHash;
        this.createdAt = LocalDateTime.now();
    }

    public void updateNickname(String nickname) { this.nickname = nickname; }

    public static User ofKakao(Long kakaoId, String email, String nickname) {
        User user = new User();
        user.kakaoId = kakaoId;
        user.email = email;
        user.nickname = nickname;
        user.createdAt = LocalDateTime.now();
        return user;
    }
}
