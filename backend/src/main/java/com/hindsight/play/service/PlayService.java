package com.hindsight.play.service;

import com.hindsight.auth.repository.UserRepository;
import com.hindsight.data.entity.DailyPrice;
import com.hindsight.data.entity.MarketEvent;
import com.hindsight.data.repository.CompanyRepository;
import com.hindsight.data.repository.DailyPriceRepository;
import com.hindsight.data.repository.MarketEventRepository;
import com.hindsight.data.repository.StartPointRepository;
import com.hindsight.global.exception.ResourceNotFoundException;
import com.hindsight.play.dto.NextRequest;
import com.hindsight.play.dto.SessionStateResponse;
import com.hindsight.play.dto.StartSessionRequest;
import com.hindsight.play.entity.PlaySession;
import com.hindsight.play.entity.PortfolioSnapshot;
import com.hindsight.play.repository.PlaySessionRepository;
import com.hindsight.play.repository.PortfolioSnapshotRepository;
import com.hindsight.trade.repository.TradeHistoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PlayService {

    private final PlaySessionRepository playSessionRepository;
    private final PortfolioSnapshotRepository portfolioSnapshotRepository;
    private final TradeHistoryRepository tradeHistoryRepository;
    private final StartPointRepository startPointRepository;
    private final CompanyRepository companyRepository;
    private final DailyPriceRepository dailyPriceRepository;
    private final MarketEventRepository marketEventRepository;
    private final UserRepository userRepository;

    @Transactional
    public SessionStateResponse startSession(String email, StartSessionRequest request) {
        var user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("사용자를 찾을 수 없습니다."));
        var startPoint = startPointRepository.findById(request.startPointId())
                .orElseThrow(() -> new ResourceNotFoundException("시작점을 찾을 수 없습니다."));
        var company = companyRepository.findById(request.companyId())
                .orElseThrow(() -> new ResourceNotFoundException("기업을 찾을 수 없습니다."));

        // 시작일 이후 첫 번째 실제 거래일 찾기 (DB에 주가 데이터가 있는 날)
        LocalDate firstTradingDay = dailyPriceRepository
                .findFirstByCompanyIdAndDateGreaterThanEqualOrderByDateAsc(company.getId(), startPoint.getStartDate())
                .map(DailyPrice::getDate)
                .orElseThrow(() -> new IllegalArgumentException("해당 시점 이후 주가 데이터가 없습니다."));

        PlaySession session = PlaySession.builder()
                .userId(user.getId())
                .startPoint(startPoint)
                .company(company)
                .seedMoney(request.seedMoney())
                .build();
        session.advanceDate(firstTradingDay);
        playSessionRepository.save(session);

        // 초기 포트폴리오: 전액 현금, 주식 0
        PortfolioSnapshot snapshot = PortfolioSnapshot.builder()
                .session(session)
                .date(firstTradingDay)
                .cash(request.seedMoney())
                .stockValue(BigDecimal.ZERO)
                .build();
        portfolioSnapshotRepository.save(snapshot);

        return buildState(session);
    }

    @Transactional(readOnly = true)
    public SessionStateResponse getState(String email, Long sessionId) {
        PlaySession session = findSessionByOwner(email, sessionId);
        return buildState(session);
    }

    @Transactional
    public SessionStateResponse next(String email, Long sessionId, NextRequest request) {
        PlaySession session = findSessionByOwner(email, sessionId);

        LocalDate targetDate = calcTargetDate(session.getSimDate(), request.jumpType());
        LocalDate nextTradingDay = dailyPriceRepository
                .findFirstByCompanyIdAndDateGreaterThanEqualOrderByDateAsc(session.getCompany().getId(), targetDate)
                .map(DailyPrice::getDate)
                .orElseThrow(() -> new IllegalArgumentException("더 이상 주가 데이터가 없습니다. 게임이 종료되었습니다."));

        session.advanceDate(nextTradingDay);

        // 새 날짜 종가 기준으로 포트폴리오 재계산
        DailyPrice price = dailyPriceRepository
                .findByCompanyIdAndDate(session.getCompany().getId(), nextTradingDay)
                .orElseThrow(() -> new IllegalStateException("주가 데이터 오류"));

        PortfolioSnapshot prev = portfolioSnapshotRepository
                .findTopBySessionIdOrderByDateDesc(sessionId)
                .orElseThrow(() -> new IllegalStateException("포트폴리오 스냅샷이 없습니다."));

        int heldQuantity = tradeHistoryRepository.calculateHeldQuantity(sessionId);
        BigDecimal newStockValue = price.getClose().multiply(BigDecimal.valueOf(heldQuantity));

        PortfolioSnapshot snapshot = PortfolioSnapshot.builder()
                .session(session)
                .date(nextTradingDay)
                .cash(prev.getCash())
                .stockValue(newStockValue)
                .build();
        portfolioSnapshotRepository.save(snapshot);

        return buildState(session);
    }

    private SessionStateResponse buildState(PlaySession session) {
        LocalDate simDate = session.getSimDate();
        Long companyId = session.getCompany().getId();

        DailyPrice price = dailyPriceRepository.findByCompanyIdAndDate(companyId, simDate)
                .orElseThrow(() -> new ResourceNotFoundException("주가 데이터가 없습니다: " + simDate));

        // 전일 종가로 변동률 계산
        BigDecimal changeRate = dailyPriceRepository
                .findFirstByCompanyIdAndDateLessThanOrderByDateDesc(companyId, simDate)
                .map(prev -> price.getClose().subtract(prev.getClose())
                        .divide(prev.getClose(), 6, RoundingMode.HALF_UP))
                .orElse(BigDecimal.ZERO);

        List<MarketEvent> events = marketEventRepository.findByDateAndCompany(simDate, companyId);

        PortfolioSnapshot snapshot = portfolioSnapshotRepository
                .findTopBySessionIdOrderByDateDesc(session.getId())
                .orElseThrow(() -> new IllegalStateException("포트폴리오 스냅샷이 없습니다."));

        int heldQuantity = tradeHistoryRepository.calculateHeldQuantity(session.getId());
        BigDecimal returnRate = snapshot.getTotalValue()
                .subtract(session.getSeedMoney())
                .divide(session.getSeedMoney(), 6, RoundingMode.HALF_UP);

        return new SessionStateResponse(
                session.getId(),
                simDate,
                new SessionStateResponse.PriceInfo(
                        price.getOpen(), price.getHigh(), price.getLow(),
                        price.getClose(), price.getVolume(), changeRate
                ),
                new SessionStateResponse.PortfolioInfo(
                        snapshot.getCash(), heldQuantity, snapshot.getStockValue(),
                        snapshot.getTotalValue(), returnRate
                ),
                events.stream()
                        .map(e -> new SessionStateResponse.EventInfo(e.getEventType(), e.getSummary()))
                        .toList()
        );
    }

    private PlaySession findSessionByOwner(String email, Long sessionId) {
        var user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("사용자를 찾을 수 없습니다."));
        PlaySession session = playSessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("플레이 세션을 찾을 수 없습니다."));
        if (!session.getUserId().equals(user.getId())) {
            throw new IllegalArgumentException("접근 권한이 없습니다.");
        }
        return session;
    }

    private LocalDate calcTargetDate(LocalDate current, NextRequest.JumpType jumpType) {
        return switch (jumpType) {
            case NEXT_DAY -> current.plusDays(1);
            case WEEK -> current.plusWeeks(1);
            case MONTH -> current.plusMonths(1);
            case THREE_MONTHS -> current.plusMonths(3);
        };
    }
}
