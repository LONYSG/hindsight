package com.hindsight.auth.dto;

public record TokenResponse(String accessToken, boolean hasNickname) {}
