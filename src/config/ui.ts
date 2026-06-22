export const navigationItems = [
  { label: 'Dashboard', href: '/' },
  { label: '课程', href: '/courses' },
  { label: '成绩数据库', href: '/database' }
] as const

export const statusLabels = {
  not_started: '未开始',
  in_progress: '进行中',
  completed: '已完成'
} as const

export const componentStatusLabels = {
  actual: '已公布',
  predicted: '预测',
  unknown: '未知'
} as const

export const gradeBadgeClasses = {
  A: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'A-': 'bg-violet-50 text-violet-700 border-violet-200',
  'B+': 'bg-blue-50 text-blue-700 border-blue-200',
  B: 'bg-sky-50 text-sky-700 border-sky-200',
  'B-': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  C: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  D: 'bg-amber-50 text-amber-700 border-amber-200',
  F: 'bg-red-50 text-red-700 border-red-200',
  HD: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  CR: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  P: 'bg-amber-50 text-amber-700 border-amber-200'
} as const
