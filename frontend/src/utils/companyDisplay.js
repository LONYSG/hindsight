// Meta 리브랜딩 이력
// 2021-10-28: Facebook Inc. → Meta Platforms Inc. (사명 변경)
// 2022-06-09: FB → META (티커 변경)

export function getDisplayTicker(ticker, simDate) {
  if (ticker !== 'META') return ticker
  return simDate < '2022-06-09' ? 'FB' : 'META'
}

export function getDisplayName(ticker, simDate) {
  if (ticker !== 'META' && ticker !== 'FB') return null
  return simDate < '2021-10-28' ? 'Facebook' : 'Meta'
}

// company 객체(ticker, name, id 등)를 simDate 기준 역사적 표기로 변환
export function getDisplayCompany(company, simDate) {
  if (!company || company.ticker !== 'META') return company
  return {
    ...company,
    ticker: getDisplayTicker('META', simDate),
    name: getDisplayName('META', simDate),
  }
}
