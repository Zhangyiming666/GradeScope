import { z } from 'zod'

export const courseSchema = z.object({
  name: z.string().min(1).max(60),
  code: z.string().min(1).max(20),
  credits: z.number().gt(0).lte(30),
  targetUniversityScore: z.number().min(0).max(100).optional()
})

export const componentSchema = z
  .object({
    name: z.string().min(1).max(40),
    weightPercent: z.number().min(0).max(100),
    earnedPoints: z.number().min(0).optional(),
    maxPoints: z.number().gt(0),
    scoreStatus: z.enum(['actual', 'predicted', 'unknown'])
  })
  .superRefine((value, context) => {
    if (value.earnedPoints !== undefined && value.earnedPoints > value.maxPoints) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['earnedPoints'],
        message: '当前得分不能超过满分'
      })
    }

    if (value.scoreStatus !== 'unknown' && value.earnedPoints === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['earnedPoints'],
        message: '已公布或预测项目必须填写得分'
      })
    }
  })

export const termSchema = z.object({
  name: z.string().min(1),
  sortOrder: z.number().int()
})
