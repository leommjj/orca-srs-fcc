import type { IRCard } from "../srs/incrementalReadingCollector"
import { calculateIRStats } from "../srs/incrementalReadingManagerUtils"

const { useMemo } = window.React

type IRStatisticsProps = {
  cards: IRCard[]
}

export default function IRStatistics({ cards }: IRStatisticsProps) {
  const stats = useMemo(() => calculateIRStats(cards), [cards])
  const dueCount = stats.overdueCount + stats.todayCount

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
      gap: "12px"
    }}>
      <div style={{
        padding: "14px",
        borderRadius: "10px",
        border: "1px solid var(--orca-color-border-1)",
        backgroundColor: "var(--orca-color-bg-1)"
      }}>
        <div style={{ fontSize: "12px", color: "var(--orca-color-text-3)" }}>总卡片数</div>
        <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--orca-color-text-1)" }}>
          {stats.total}
        </div>
      </div>

      <div style={{
        padding: "14px",
        borderRadius: "10px",
        border: "1px solid var(--orca-color-primary-3)",
        backgroundColor: "var(--orca-color-primary-1)"
      }}>
        <div style={{ fontSize: "12px", color: "var(--orca-color-primary-6)" }}>新卡</div>
        <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--orca-color-primary-6)" }}>
          {stats.newCount}
        </div>
      </div>

      <div style={{
        padding: "14px",
        borderRadius: "10px",
        border: "1px solid var(--orca-color-danger-5)",
        backgroundColor: "var(--orca-color-danger-1)"
      }}>
        <div style={{ fontSize: "12px", color: "var(--orca-color-danger-6)" }}>到期（已逾期+今天）</div>
        <div style={{
          fontSize: "28px",
          fontWeight: 700,
          color: "var(--orca-color-danger-6)"
        }}>
          {dueCount}
        </div>
        <div style={{ fontSize: "12px", color: "var(--orca-color-text-3)" }}>
          <span style={{ color: "var(--orca-color-danger-6)" }}>已逾期 {stats.overdueCount}</span>
          <span style={{ margin: "0 6px" }}>/</span>
          <span style={{ color: "var(--orca-color-warning-6)" }}>今天 {stats.todayCount}</span>
        </div>
      </div>

      <div style={{
        padding: "14px",
        borderRadius: "10px",
        border: "1px solid var(--orca-color-warning-3)",
        backgroundColor: "var(--orca-color-warning-1)"
      }}>
        <div style={{ fontSize: "12px", color: "var(--orca-color-warning-6)" }}>未来7天到期</div>
        <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--orca-color-warning-6)" }}>
          {stats.upcoming7Count}
        </div>
      </div>
    </div>
  )
}
