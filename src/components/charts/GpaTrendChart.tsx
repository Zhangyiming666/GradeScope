import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import type { TrendPoint } from '../../utils/gpaMath'
import { formatGpa, formatScore } from '../../utils/format'

interface GpaTrendChartProps {
  points: TrendPoint[]
  metric: 'gpa' | 'average'
}

interface ChartPoint {
  termName: string
  cumulativeCredits: number
  value?: number
}

export function GpaTrendChart({ points, metric }: GpaTrendChartProps) {
  const isGpa = metric === 'gpa'
  const formatValue = isGpa ? formatGpa : formatScore
  const lineName = isGpa ? '累计 GPA' : '累计均分'
  const data: ChartPoint[] = points.map((point) => ({
    termName: point.termName,
    cumulativeCredits: point.cumulativeCredits,
    value: isGpa ? point.cumulativeGpa : point.cumulativeAverageScore
  }))

  return (
    <div className="h-72" aria-label={isGpa ? 'GPA 趋势图' : '均分趋势图'}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 24, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="#E6EBF3" vertical={false} />
          <XAxis dataKey="termName" tick={{ fill: '#33415C', fontSize: 12 }} tickLine={false} axisLine={false} />
          <YAxis
            domain={isGpa ? [2, 4] : [60, 100]}
            tick={{ fill: '#33415C', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <Tooltip
            formatter={(value: number, name) => {
              const label = String(name)
              return [formatValue(value), label]
            }}
            labelFormatter={(label) => `学期：${label}`}
            contentStyle={{ borderColor: '#E6EBF3', borderRadius: 12 }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="value"
            name={lineName}
            stroke={isGpa ? '#2563EB' : '#16A34A'}
            strokeWidth={2.5}
            dot={{ r: 4 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
