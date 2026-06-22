import type { Course, GradingProfile } from '../types/domain'

export const DEFAULT_GRADING_PROFILE_ID = 'default-linear-profile'
export const UTS_GRADING_PROFILE_ID = 'uts-linear-profile'

const shuGradeBands: GradingProfile['gradeBands'] = [
  { min: 90, max: 100, label: 'A' },
  { min: 85, max: 89.999999, label: 'A-' },
  { min: 80, max: 84.999999, label: 'B+' },
  { min: 75, max: 79.999999, label: 'B' },
  { min: 70, max: 74.999999, label: 'B-' },
  { min: 65, max: 69.999999, label: 'C' },
  { min: 60, max: 64.999999, label: 'D' },
  { min: 0, max: 59.999999, label: 'F' }
]

const shuGpaBands: GradingProfile['gpaBands'] = [
  { min: 90, max: 100, gpa: 4.0 },
  { min: 85, max: 89.999999, gpa: 3.7 },
  { min: 80, max: 84.999999, gpa: 3.3 },
  { min: 75, max: 79.999999, gpa: 3.0 },
  { min: 70, max: 74.999999, gpa: 2.7 },
  { min: 65, max: 69.999999, gpa: 2.5 },
  { min: 60, max: 64.999999, gpa: 1.5 },
  { min: 0, max: 59.999999, gpa: 0.0 }
]

const utsGradeBands: GradingProfile['gradeBands'] = [
  { min: 85, max: 100, label: 'HD' },
  { min: 75, max: 84.999999, label: 'D' },
  { min: 65, max: 74.999999, label: 'CR' },
  { min: 50, max: 64.999999, label: 'P' },
  { min: 0, max: 49.999999, label: 'F' }
]

export const defaultGradingProfile: GradingProfile = {
  id: DEFAULT_GRADING_PROFILE_ID,
  name: '默认上海大学课程成绩规则',
  linearConversion: {
    multiplier: 1,
    offset: 0,
    min: 0,
    max: 100
  },
  gradeBands: shuGradeBands,
  gpaBands: shuGpaBands
}

export const utsGradingProfile: GradingProfile = {
  ...defaultGradingProfile,
  id: UTS_GRADING_PROFILE_ID,
  name: 'UTS 课程换算规则',
  linearConversion: {
    multiplier: 0.8,
    offset: 20,
    min: 0,
    max: 100
  },
  gradeBands: utsGradeBands
}

export const gradingProfiles = [defaultGradingProfile, utsGradingProfile]

export function getProfileForCourse(course: Course, profiles: GradingProfile[]): GradingProfile {
  return profiles.find((profile) => profile.id === course.gradingProfileId) ?? defaultGradingProfile
}

export function isUtsCourse(course: Course): boolean {
  return course.courseType === 'uts' || course.gradingProfileId === UTS_GRADING_PROFILE_ID
}
