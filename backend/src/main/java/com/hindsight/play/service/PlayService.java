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
import com.hindsight.trade.dto.TradeRequest;
import com.hindsight.trade.entity.TradeHistory;
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

    @Transactional
    public SessionStateResponse trade(String email, Long sessionId, TradeRequest request) {
        PlaySession session = findSessionByOwner(email, sessionId);

        DailyPrice price = dailyPriceRepository
                .findByCompanyIdAndDate(session.getCompany().getId(), session.getSimDate())
                .orElseThrow(() -> new IllegalArgumentException("현재 날짜의 주가 데이터가 없습니다."));

        PortfolioSnapshot current = portfolioSnapshotRepository
                .findTopBySessionIdOrderByDateDesc(sessionId)
                .orElseThrow(() -> new IllegalStateException("포트폴리오 스냅샷이 없습니다."));

        int heldQuantity = tradeHistoryRepository.calculateHeldQuantity(sessionId);
        BigDecimal closePrice = price.getClose();
        int quantity = request.quantity();
        BigDecimal totalCost = closePrice.multiply(BigDecimal.valueOf(quantity));

        BigDecimal newCash;
        BigDecimal newStockValue;
        BigDecimal ratio;

        if (request.action() == TradeRequest.Action.BUY) {
            if (totalCost.compareTo(current.getCash()) > 0)
                throw new IllegalArgumentException("현금이 부족합니다. (필요: " + totalCost.toPlainString() + "원)");
            ratio = totalCost.divide(current.getCash(), 4, RoundingMode.HALF_UP);
            newCash = current.getCash().subtract(totalCost);
            newStockValue = closePrice.multiply(BigDecimal.valueOf(heldQuantity + quantity));
        } else {
            if (quantity > heldQuantity)
                throw new IllegalArgumentException("보유 수량이 부족합니다. (보유: " + heldQuantity + "주)");
            ratio = BigDecimal.valueOf(quantity).divide(BigDecimal.valueOf(heldQuantity), 4, RoundingMode.HALF_UP);
            newCash = current.getCash().add(totalCost);
            newStockValue = closePrice.multiply(BigDecimal.valueOf(heldQuantity - quantity));
        }

        tradeHistoryRepository.save(TradeHistory.builder()
                .session(session)
                .date(session.getSimDate())
                .action(request.action().name())
                .quantity(quantity)
                .price(closePrice)
                .ratio(ratio)
                .build());

        // 같은 날 여러 번 매매 가능 → 기존 당일 스냅샷 교체
        portfolioSnapshotRepository.deleteBySessionIdAndDate(sessionId, session.getSimDate());
        portfolioSnapshotRepository.save(PortfolioSnapshot.builder()
                .session(session)
                .date(session.getSimDate())
                .cash(newCash)
                .stockValue(newStockValue)
                .build());

        return buildState(session);
    }

    SessionStateResponse buildState(PlaySession session) {
        LocalDate simDate = session.getSimDate();
        Long companyId = session.getCompany().getId();
        Long sessionId = session.getId();

        DailyPrice price = dailyPriceRepository.findByCompanyIdAndDate(companyId, simDate)
                .orElseThrow(() -> new ResourceNotFoundException("주가 데이터가 없습니다: " + simDate));

        BigDecimal changeRate = dailyPriceRepository
                .findFirstByCompanyIdAndDateLessThanOrderByDateDesc(companyId, simDate)
                .map(prev -> price.getClose().subtract(prev.getClose())
                        .divide(prev.getClose(), 6, RoundingMode.HALF_UP))
                .orElse(BigDecimal.ZERO);

        List<MarketEvent> events = marketEventRepository.findByDateAndCompany(simDate, companyId);

        PortfolioSnapshot snapshot = portfolioSnapshotRepository
                .findTopBySessionIdOrderByDateDesc(sessionId)
                .orElseThrow(() -> new IllegalStateException("포트폴리오 스냅샷이 없습니다."));

        int heldQuantity = tradeHistoryRepository.calculateHeldQuantity(sessionId);

        // 평균 매입단가 계산
        int totalBuyQty = tradeHistoryRepository.calculateTotalBuyQuantity(sessionId);
        BigDecimal totalBuyCost = tradeHistoryRepository.calculateTotalBuyCost(sessionId);
        BigDecimal avgBuyPrice = totalBuyQty > 0
                ? totalBuyCost.divide(BigDecimal.valueOf(totalBuyQty), 4, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;
        BigDecimal bookValue = avgBuyPrice.multiply(BigDecimal.valueOf(heldQuantity));
        BigDecimal unrealizedPnl = snapshot.getStockValue().subtract(bookValue);
        BigDecimal unrealizedRate = bookValue.compareTo(BigDecimal.ZERO) > 0
                ? unrealizedPnl.divide(bookValue, 6, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;
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
                        snapshot.getCash(), heldQuantity, avgBuyPrice, bookValue,
                        snapshot.getStockValue(), unrealizedPnl, unrealizedRate,
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
