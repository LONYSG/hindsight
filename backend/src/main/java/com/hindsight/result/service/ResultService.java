package com.hindsight.result.service;

import com.hindsight.auth.repository.UserRepository;
import com.hindsight.data.entity.DailyMacro;
import com.hindsight.data.repository.CompanyRepository;
import com.hindsight.data.repository.DailyMacroRepository;
import com.hindsight.data.repository.DailyPriceRepository;
import com.hindsight.global.exception.ResourceNotFoundException;
import com.hindsight.play.entity.PlaySession;
import com.hindsight.play.repository.PlaySessionRepository;
import com.hindsight.play.repository.PortfolioSnapshotRepository;
import com.hindsight.result.dto.PlayResultResponse;
import com.hindsight.result.entity.PlayResult;
import com.hindsight.result.repository.PlayResultRepository;
import com.hindsight.trade.repository.TradeHistoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ResultService {

    private final PlaySessionRepository playSessionRepository;
    private final PlayResultRepository playResultRepository;
    private final PortfolioSnapshotRepository portfolioSnapshotRepository;
    private final TradeHistoryRepository tradeHistoryRepository;
    private final DailyPriceRepository dailyPriceRepository;
    private final DailyMacroRepository dailyMacroRepository;
    private final CompanyRepository companyRepository;
    private final UserRepository userRepository;

    @Transactional
    public PlayResultResponse endSession(String email, Long sessionId) {
        PlaySession session = findSessionByOwner(email, sessionId);

        if ("FINISHED".equals(session.getStatus())) {
            return playResultRepository.findBySessionId(sessionId)
                    .map(r -> toResponse(session, r))
                    .orElseThrow();
        }

        var startDate = session.getStartPoint().getStartDate();
        var endDate   = session.getSimDate();

        DailyMacro startMacro = dailyMacroRepository
                .findFirstByDateGreaterThanEqualOrderByDateAsc(startDate)
                .orElseThrow(() -> new ResourceNotFoundException("시작일 거시지표 없음"));

        DailyMacro endMacro = dailyMacroRepository
                .findByDate(endDate)
                .or(() -> dailyMacroRepository.findFirstByDateGreaterThanEqualOrderByDateAsc(endDate))
                .orElseThrow(() -> new ResourceNotFoundException("종료일 거시지표 없음"));

        var snapshot = portfolioSnapshotRepository
                .findTopBySessionIdOrderByDateDesc(sessionId)
                .orElseThrow();

        BigDecimal finalValue   = snapshot.getTotalValue();
        BigDecimal seedMoney    = session.getSeedMoney();
        BigDecimal myReturn     = rate(finalValue, seedMoney);
        BigDecimal nasdaqReturn = rate(endMacro.getNasdaq(), startMacro.getNasdaq());
        BigDecimal sp500Return  = rate(endMacro.getSp500(), startMacro.getSp500());
        BigDecimal alpha        = myReturn.subtract(nasdaqReturn).setScale(6, RoundingMode.HALF_UP);

        int tradeCount = (int) tradeHistoryRepository.countBySessionId(sessionId);

        var snapshots   = portfolioSnapshotRepository.findBySessionIdOrderByDateAsc(sessionId);
        BigDecimal mdd          = calcMdd(snapshots, seedMoney);
        BigDecimal cashRatioAvg = calcCashRatioAvg(snapshots);

        PlayResult result = PlayResult.builder()
                .session(session)
                .myReturn(myReturn)
                .stockReturn(null)
                .sp500Return(sp500Return)
                .nasdaqReturn(nasdaqReturn)
                .alpha(alpha)
                .mdd(mdd)
                .cashRatioAvg(cashRatioAvg)
                .tradeCount(tradeCount)
                .build();
        playResultRepository.save(result);

        session.finish();
        playSessionRepository.save(session);

        return toResponse(session, result);
    }

    @Transactional(readOnly = true)
    public PlayResultResponse getResult(String email, Long sessionId) {
        PlaySession session = findSessionByOwner(email, sessionId);
        PlayResult result = playResultRepository.findBySessionId(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("결과가 없습니다. 게임을 먼저 종료해주세요."));
        return toResponse(session, result);
    }

    // 비로그인 공유 링크용 — 소유자 검증 없이 결과 조회
    public PlayResultResponse getResultPublic(Long sessionId) {
        PlaySession session = playSessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("세션을 찾을 수 없습니다."));
        PlayResult result = playResultRepository.findBySessionId(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("결과가 없습니다."));
        return toResponse(session, result);
    }

    private PlayResultResponse toResponse(PlaySession session, PlayResult result) {
        var snapshot = portfolioSnapshotRepository
                .findTopBySessionIdOrderByDateDesc(session.getId()).orElseThrow();
        int tradeCount = result.getTradeCount() != null
                ? result.getTradeCount()
                : (int) tradeHistoryRepository.countBySessionId(session.getId());

        LocalDate startDate = session.getStartPoint().getStartDate();
        LocalDate endDate   = session.getSimDate();

        String playerName = userRepository.findById(session.getUserId())
                .map(u -> u.getNickname() != null ? u.getNickname() : "익명 투자자")
                .orElse("익명 투자자");

        return new PlayResultResponse(
                session.getId(),
                playerName,
                startDate,
                endDate,
                session.getSeedMoney(),
                snapshot.getTotalValue(),
                result.getMyReturn(),
                result.getNasdaqReturn(),
                result.getAlpha(),
                tradeCount,
                result.getMdd(),
                result.getCashRatioAvg(),
                calcStockReturns(startDate, endDate)
        );
    }

    private List<PlayResultResponse.StockReturn> calcStockReturns(LocalDate startDate, LocalDate endDate) {
        return companyRepository.findAll().stream()
                .map(company -> {
                    var startPrice = dailyPriceRepository
                            .findFirstByCompanyIdAndDateGreaterThanEqualOrderByDateAsc(company.getId(), startDate);
                    var endPrice = dailyPriceRepository
                            .findFirstByCompanyIdAndDateLessThanOrderByDateDesc(company.getId(), endDate.plusDays(1));

                    if (startPrice.isEmpty() || endPrice.isEmpty()) return null;

                    BigDecimal ret = rate(endPrice.get().getClose(), startPrice.get().getClose());
                    return new PlayResultResponse.StockReturn(company.getTicker(), ret);
                })
                .filter(Objects::nonNull)
                .sorted(Comparator.comparing(PlayResultResponse.StockReturn::returnRate).reversed())
                .collect(Collectors.toList());
    }

    private BigDecimal calcMdd(List<com.hindsight.play.entity.PortfolioSnapshot> snapshots, BigDecimal seedMoney) {
        BigDecimal peak = seedMoney;
        BigDecimal maxDrawdown = BigDecimal.ZERO;
        for (var s : snapshots) {
            BigDecimal value = s.getTotalValue();
            if (value.compareTo(peak) > 0) peak = value;
            if (peak.compareTo(BigDecimal.ZERO) > 0) {
                BigDecimal drawdown = peak.subtract(value).divide(peak, 6, RoundingMode.HALF_UP);
                if (drawdown.compareTo(maxDrawdown) > 0) maxDrawdown = drawdown;
            }
        }
        return maxDrawdown;
    }

    private BigDecimal calcCashRatioAvg(List<com.hindsight.play.entity.PortfolioSnapshot> snapshots) {
        if (snapshots.isEmpty()) return BigDecimal.ONE;
        BigDecimal sum = snapshots.stream()
                .filter(s -> s.getTotalValue().compareTo(BigDecimal.ZERO) > 0)
                .map(s -> s.getCash().divide(s.getTotalValue(), 6, RoundingMode.HALF_UP))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return sum.divide(BigDecimal.valueOf(snapshots.size()), 6, RoundingMode.HALF_UP);
    }

    private BigDecimal rate(BigDecimal end, BigDecimal start) {
        if (start == null || start.compareTo(BigDecimal.ZERO) == 0) return BigDecimal.ZERO;
        return end.subtract(start).divide(start, 6, RoundingMode.HALF_UP);
    }

    private PlaySession findSessionByOwner(String email, Long sessionId) {
        var user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("사용자를 찾을 수 없습니다."));
        var session = playSessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("세션을 찾을 수 없습니다."));
        if (!session.getUserId().equals(user.getId()))
            throw new IllegalArgumentException("접근 권한이 없습니다.");
        return session;
    }
}
