package com.hindsight.result.service;

import com.hindsight.auth.repository.UserRepository;
import com.hindsight.data.entity.DailyMacro;
import com.hindsight.data.entity.DailyPrice;
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

@Service
@RequiredArgsConstructor
public class ResultService {

    private final PlaySessionRepository playSessionRepository;
    private final PlayResultRepository playResultRepository;
    private final PortfolioSnapshotRepository portfolioSnapshotRepository;
    private final TradeHistoryRepository tradeHistoryRepository;
    private final DailyPriceRepository dailyPriceRepository;
    private final DailyMacroRepository dailyMacroRepository;
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
        var companyId = session.getCompany().getId();

        // 시작일 주가 (첫 거래일)
        DailyPrice startPrice = dailyPriceRepository
                .findFirstByCompanyIdAndDateGreaterThanEqualOrderByDateAsc(companyId, startDate)
                .orElseThrow(() -> new ResourceNotFoundException("시작일 주가 데이터 없음"));

        // 종료일 주가
        DailyPrice endPrice = dailyPriceRepository
                .findByCompanyIdAndDate(companyId, endDate)
                .orElseThrow(() -> new ResourceNotFoundException("종료일 주가 데이터 없음"));

        // 시작일 거시지표
        DailyMacro startMacro = dailyMacroRepository
                .findFirstByDateGreaterThanEqualOrderByDateAsc(startDate)
                .orElseThrow(() -> new ResourceNotFoundException("시작일 거시지표 없음"));

        // 종료일 거시지표
        DailyMacro endMacro = dailyMacroRepository
                .findByDate(endDate)
                .or(() -> dailyMacroRepository.findFirstByDateGreaterThanEqualOrderByDateAsc(endDate))
                .orElseThrow(() -> new ResourceNotFoundException("종료일 거시지표 없음"));

        // 최종 포트폴리오
        var snapshot = portfolioSnapshotRepository
                .findTopBySessionIdOrderByDateDesc(sessionId)
                .orElseThrow();

        BigDecimal finalValue = snapshot.getTotalValue();
        BigDecimal seedMoney  = session.getSeedMoney();

        BigDecimal myReturn     = rate(finalValue, seedMoney);
        BigDecimal stockReturn  = rate(endPrice.getClose(), startPrice.getClose());
        BigDecimal sp500Return  = rate(endMacro.getSp500(), startMacro.getSp500());
        BigDecimal nasdaqReturn = rate(endMacro.getNasdaq(), startMacro.getNasdaq());
        BigDecimal alpha        = myReturn.subtract(sp500Return).setScale(6, RoundingMode.HALF_UP);

        int tradeCount = tradeHistoryRepository.calculateTotalBuyQuantity(sessionId)
                + tradeHistoryRepository.calculateTotalBuyQuantity(sessionId); // 매수+매도 합산 근사

        // 결과 저장
        PlayResult result = PlayResult.builder()
                .session(session)
                .myReturn(myReturn)
                .stockReturn(stockReturn)
                .sp500Return(sp500Return)
                .nasdaqReturn(nasdaqReturn)
                .alpha(alpha)
                .build();
        playResultRepository.save(result);

        // 세션 상태 종료
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

    private PlayResultResponse toResponse(PlaySession session, PlayResult result) {
        var snapshot = portfolioSnapshotRepository
                .findTopBySessionIdOrderByDateDesc(session.getId()).orElseThrow();
        int tradeCount = tradeHistoryRepository.calculateTotalBuyQuantity(session.getId());

        return new PlayResultResponse(
                session.getId(),
                session.getStartPoint().getStartDate(),
                session.getSimDate(),
                session.getSeedMoney(),
                snapshot.getTotalValue(),
                result.getMyReturn(),
                result.getStockReturn(),
                result.getSp500Return(),
                result.getNasdaqReturn(),
                result.getAlpha(),
                tradeCount
        );
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
