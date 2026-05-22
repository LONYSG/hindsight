package com.hindsight.play.service;

import com.hindsight.auth.repository.UserRepository;
import com.hindsight.data.entity.Company;
import com.hindsight.data.entity.DailyPrice;
import com.hindsight.data.entity.MarketEvent;
import com.hindsight.data.repository.CompanyRepository;
import com.hindsight.data.repository.DailyPriceRepository;
import com.hindsight.data.repository.MarketEventRepository;
import com.hindsight.data.repository.StartPointRepository;
import com.hindsight.global.exception.ResourceNotFoundException;
import com.hindsight.play.dto.NextRequest;
import com.hindsight.play.dto.SessionStateResponse;
import com.hindsight.play.dto.SessionSummaryResponse;
import com.hindsight.play.dto.StartSessionRequest;
import com.hindsight.play.entity.PlaySession;
import com.hindsight.play.entity.PortfolioSnapshot;
import com.hindsight.play.repository.PlaySessionRepository;
import com.hindsight.play.repository.PortfolioSnapshotRepository;
import com.hindsight.result.repository.PlayResultRepository;
import com.hindsight.trade.dto.TradeRequest;
import com.hindsight.trade.entity.TradeHistory;
import com.hindsight.trade.repository.TradeHistoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PlayService {

    // 거래일 기준 참조 기업 (미국 상장 M7 공통 거래 캘린더)
    private static final Long REFERENCE_COMPANY_ID = 2L; // NVDA

    private final PlaySessionRepository playSessionRepository;
    private final PortfolioSnapshotRepository portfolioSnapshotRepository;
    private final TradeHistoryRepository tradeHistoryRepository;
    private final PlayResultRepository playResultRepository;
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
        if (!startPoint.isAvailable())
            throw new IllegalArgumentException("아직 준비 중인 시나리오입니다.");

        // 시작점 이후 첫 거래일 (NVDA 기준, M7 전체 공통 캘린더)
        LocalDate firstTradingDay = dailyPriceRepository
                .findFirstByCompanyIdAndDateGreaterThanEqualOrderByDateAsc(REFERENCE_COMPANY_ID, startPoint.getStartDate())
                .map(DailyPrice::getDate)
                .orElseThrow(() -> new IllegalArgumentException("해당 시점 이후 주가 데이터가 없습니다."));

        PlaySession session = PlaySession.builder()
                .userId(user.getId())
                .startPoint(startPoint)
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
    public List<SessionSummaryResponse> listSessions(String email) {
        var user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("사용자를 찾을 수 없습니다."));
        return playSessionRepository.findByUserIdOrderByCreatedAtDesc(user.getId()).stream()
                .map(s -> {
                    PortfolioSnapshot snap = portfolioSnapshotRepository
                            .findTopBySessionIdOrderByDateDesc(s.getId()).orElse(null);
                    BigDecimal returnRate = snap != null
                            ? snap.getTotalValue().subtract(s.getSeedMoney())
                                  .divide(s.getSeedMoney(), 4, RoundingMode.HALF_UP)
                            : BigDecimal.ZERO;
                    String alias = s.getAlias() != null ? s.getAlias() : s.getStartPoint().getName();
                    return new SessionSummaryResponse(
                            s.getId(),
                            alias,
                            s.getStartPoint().getName(),
                            s.getStartPoint().getStartDate(),
                            s.getSeedMoney(),
                            s.getSimDate(),
                            s.getStatus(),
                            s.getCreatedAt(),
                            returnRate
                    );
                })
                .toList();
    }

    @Transactional
    public void updateAlias(String email, Long sessionId, String alias) {
        PlaySession session = findSessionByOwner(email, sessionId);
        if (alias == null || alias.isBlank()) throw new IllegalArgumentException("별칭을 입력해주세요.");
        if (alias.length() > 30) throw new IllegalArgumentException("별칭은 30자 이내로 입력해주세요.");
        session.updateAlias(alias.trim());
    }

    @Transactional
    public void deleteSession(String email, Long sessionId) {
        PlaySession session = findSessionByOwner(email, sessionId);
        portfolioSnapshotRepository.deleteAll(portfolioSnapshotRepository.findBySessionIdOrderByDateAsc(sessionId));
        tradeHistoryRepository.deleteBySessionId(sessionId);
        playResultRepository.deleteBySessionId(sessionId);
        playSessionRepository.delete(session);
    }

    @Transactional(readOnly = true)
    public SessionStateResponse getState(String email, Long sessionId) {
        return buildState(findSessionByOwner(email, sessionId));
    }

    @Transactional
    public SessionStateResponse next(String email, Long sessionId, NextRequest request) {
        PlaySession session = findSessionByOwner(email, sessionId);

        LocalDate targetDate = calcTargetDate(session.getSimDate(), request.jumpType());
        LocalDate nextTradingDay = dailyPriceRepository
                .findFirstByCompanyIdAndDateGreaterThanEqualOrderByDateAsc(REFERENCE_COMPANY_ID, targetDate)
                .map(DailyPrice::getDate)
                .orElseThrow(() -> new IllegalArgumentException("더 이상 주가 데이터가 없습니다. 게임이 종료되었습니다."));

        session.advanceDate(nextTradingDay);

        List<Long> heldCompanyIds = tradeHistoryRepository.findHeldCompanyIds(sessionId);

        PortfolioSnapshot prev = portfolioSnapshotRepository
                .findTopBySessionIdOrderByDateDesc(sessionId)
                .orElseThrow(() -> new IllegalStateException("포트폴리오 스냅샷이 없습니다."));
        BigDecimal cash = prev.getCash();

        // 점프 구간의 모든 거래일 스냅샷 저장 — MDD 계산 정확도 보장
        LocalDate cursor = prev.getDate().plusDays(1);
        List<PortfolioSnapshot> snapshots = new ArrayList<>();
        while (!cursor.isAfter(nextTradingDay)) {
            BigDecimal stockValue = BigDecimal.ZERO;
            for (Long companyId : heldCompanyIds) {
                int qty = tradeHistoryRepository.calculateHeldQuantity(sessionId, companyId);
                BigDecimal price = dailyPriceRepository
                        .findByCompanyIdAndDate(companyId, cursor)
                        .map(DailyPrice::getClose)
                        .orElse(null);
                if (price != null) {
                    stockValue = stockValue.add(price.multiply(BigDecimal.valueOf(qty)));
                }
            }
            // 해당 날짜 주가 데이터가 있는 거래일만 저장
            boolean isTradingDay = heldCompanyIds.isEmpty() ||
                    dailyPriceRepository.findByCompanyIdAndDate(REFERENCE_COMPANY_ID, cursor).isPresent();
            if (isTradingDay || cursor.equals(nextTradingDay)) {
                snapshots.add(PortfolioSnapshot.builder()
                        .session(session)
                        .date(cursor)
                        .cash(cash)
                        .stockValue(stockValue)
                        .build());
            }
            cursor = cursor.plusDays(1);
        }
        portfolioSnapshotRepository.saveAll(snapshots);

        return buildState(session);
    }

    @Transactional
    public SessionStateResponse trade(String email, Long sessionId, TradeRequest request) {
        PlaySession session = findSessionByOwner(email, sessionId);
        Company company = companyRepository.findById(request.companyId())
                .orElseThrow(() -> new ResourceNotFoundException("기업을 찾을 수 없습니다."));

        DailyPrice price = dailyPriceRepository
                .findByCompanyIdAndDate(company.getId(), session.getSimDate())
                .orElseThrow(() -> new IllegalArgumentException(
                        company.getTicker() + " 주가 데이터가 없습니다. (날짜: " + session.getSimDate() + ")"));

        PortfolioSnapshot current = portfolioSnapshotRepository
                .findTopBySessionIdOrderByDateDesc(sessionId)
                .orElseThrow(() -> new IllegalStateException("포트폴리오 스냅샷이 없습니다."));

        int heldQty = tradeHistoryRepository.calculateHeldQuantity(sessionId, company.getId());
        BigDecimal closePrice = price.getClose();
        int quantity = request.quantity();
        BigDecimal totalCost = closePrice.multiply(BigDecimal.valueOf(quantity));

        BigDecimal newCash;
        BigDecimal ratio;

        if (request.action() == TradeRequest.Action.BUY) {
            if (totalCost.compareTo(current.getCash()) > 0)
                throw new IllegalArgumentException("현금이 부족합니다.");
            ratio = totalCost.divide(current.getCash(), 4, RoundingMode.HALF_UP);
            newCash = current.getCash().subtract(totalCost);
        } else {
            if (quantity > heldQty)
                throw new IllegalArgumentException("보유 수량이 부족합니다. (보유: " + heldQty + "주)");
            ratio = BigDecimal.valueOf(quantity).divide(BigDecimal.valueOf(heldQty), 4, RoundingMode.HALF_UP);
            newCash = current.getCash().add(totalCost);
        }

        tradeHistoryRepository.save(TradeHistory.builder()
                .session(session)
                .company(company)
                .date(session.getSimDate())
                .action(request.action().name())
                .quantity(quantity)
                .price(closePrice)
                .ratio(ratio)
                .build());

        // 전체 포트폴리오 평가금액 재계산
        List<Long> heldCompanyIds = tradeHistoryRepository.findHeldCompanyIds(sessionId);
        BigDecimal totalStockValue = BigDecimal.ZERO;
        for (Long cId : heldCompanyIds) {
            int qty = tradeHistoryRepository.calculateHeldQuantity(sessionId, cId);
            BigDecimal p = dailyPriceRepository
                    .findByCompanyIdAndDate(cId, session.getSimDate())
                    .map(DailyPrice::getClose)
                    .orElse(BigDecimal.ZERO);
            totalStockValue = totalStockValue.add(p.multiply(BigDecimal.valueOf(qty)));
        }

        portfolioSnapshotRepository.deleteBySessionIdAndDate(sessionId, session.getSimDate());
        portfolioSnapshotRepository.save(PortfolioSnapshot.builder()
                .session(session)
                .date(session.getSimDate())
                .cash(newCash)
                .stockValue(totalStockValue)
                .build());

        return buildState(session);
    }

    SessionStateResponse buildState(PlaySession session) {
        LocalDate simDate = session.getSimDate();
        Long sessionId = session.getId();

        PortfolioSnapshot snapshot = portfolioSnapshotRepository
                .findTopBySessionIdOrderByDateDesc(sessionId)
                .orElseThrow(() -> new IllegalStateException("포트폴리오 스냅샷이 없습니다."));

        // 보유 종목별 HoldingInfo 계산
        List<Long> heldCompanyIds = tradeHistoryRepository.findHeldCompanyIds(sessionId);
        List<SessionStateResponse.HoldingInfo> holdings = new ArrayList<>();

        for (Long companyId : heldCompanyIds) {
            Company company = companyRepository.findById(companyId).orElse(null);
            if (company == null) continue;

            DailyPrice price = dailyPriceRepository
                    .findByCompanyIdAndDate(companyId, simDate).orElse(null);
            if (price == null) continue;

            BigDecimal changeRate = dailyPriceRepository
                    .findFirstByCompanyIdAndDateLessThanOrderByDateDesc(companyId, simDate)
                    .map(prev -> price.getClose().subtract(prev.getClose())
                            .divide(prev.getClose(), 6, RoundingMode.HALF_UP))
                    .orElse(BigDecimal.ZERO);

            int qty = tradeHistoryRepository.calculateHeldQuantity(sessionId, companyId);
            int totalBuyQty = tradeHistoryRepository.calculateTotalBuyQuantity(sessionId, companyId);
            BigDecimal totalBuyCost = tradeHistoryRepository.calculateTotalBuyCost(sessionId, companyId);
            BigDecimal avgBuyPrice = totalBuyQty > 0
                    ? totalBuyCost.divide(BigDecimal.valueOf(totalBuyQty), 4, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO;
            BigDecimal bookValue = avgBuyPrice.multiply(BigDecimal.valueOf(qty));
            BigDecimal stockValue = price.getClose().multiply(BigDecimal.valueOf(qty));
            BigDecimal unrealizedPnl = stockValue.subtract(bookValue);
            BigDecimal unrealizedRate = bookValue.compareTo(BigDecimal.ZERO) > 0
                    ? unrealizedPnl.divide(bookValue, 6, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO;

            holdings.add(new SessionStateResponse.HoldingInfo(
                    companyId, company.getTicker(), company.getName(),
                    price.getClose(), changeRate, qty,
                    avgBuyPrice, bookValue, stockValue, unrealizedPnl, unrealizedRate
            ));
        }

        BigDecimal returnRate = snapshot.getTotalValue()
                .subtract(session.getSeedMoney())
                .divide(session.getSeedMoney(), 6, RoundingMode.HALF_UP);

        // 이벤트: 세션 보유 기업 + 매크로(company IS NULL) 이벤트 전체
        List<MarketEvent> events = marketEventRepository.findByDate(simDate);

        return new SessionStateResponse(
                sessionId,
                simDate,
                session.getStartPoint().getStartDate(),
                holdings,
                new SessionStateResponse.PortfolioInfo(
                        snapshot.getCash(),
                        snapshot.getStockValue(),
                        snapshot.getTotalValue(),
                        returnRate
                ),
                events.stream()
                        .map(e -> new SessionStateResponse.EventInfo(
                                e.getEventType(),
                                e.getCompany() != null ? e.getCompany().getTicker() : null,
                                e.getSummary()))
                        .toList()
        );
    }

    private PlaySession findSessionByOwner(String email, Long sessionId) {
        var user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("사용자를 찾을 수 없습니다."));
        PlaySession session = playSessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("플레이 세션을 찾을 수 없습니다."));
        if (!session.getUserId().equals(user.getId()))
            throw new IllegalArgumentException("접근 권한이 없습니다.");
        return session;
    }

    private LocalDate calcTargetDate(LocalDate current, NextRequest.JumpType jumpType) {
        return switch (jumpType) {
            case NEXT_DAY      -> current.plusDays(1);
            case WEEK          -> current.plusWeeks(1);
            case MONTH         -> current.plusMonths(1);
            case THREE_MONTHS  -> current.plusMonths(3);
        };
    }
}
